from decimal import Decimal
import csv
import io
from django.db.models import Count, Sum
from django.db.utils import ProgrammingError
from django.http import HttpResponse
from apps.loans.models import LoanApplication, LoanStatus
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.core.cache import cache
from rest_framework.throttling import UserRateThrottle

from apps.accounts.models import MemberProfile, MembershipStatus
from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee, IsAdminOrCommitteeOrHOS
from apps.audit.utils import log_action, get_client_ip
from utils.hijri import hijri_month_display
from .models import LedgerEntryType, SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle
from .serializers import (
    SavingsLedgerSerializer, MemberBalanceSerializer,
    PostSavingsSerializer, SavingsChangeRequestSerializer,
    ApproveSavingsChangeSerializer, TermlyDuesCycleSerializer,
    CreateDuesCycleSerializer,
)
from .services import (
    post_debit_entry, post_savings_entry, post_termly_dues,
    apply_savings_change, get_or_create_balance, post_special_savings_entry, post_repayment
)

def invalidate_dashboard_cache():
    cache.delete("dashboard_summary_admin_stats")


class PostSavingsView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = PostSavingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        members = d["_members"]

        entries = []
        for member in members:
            entries.append(
                post_savings_entry(
                    member=member,
                    amount=d["amount"],
                    hijri_month=d["hijri_month"],
                    hijri_year=d["hijri_year"],
                    posted_by=request.user,
                )
            )
        invalidate_dashboard_cache()

        for entry in entries:
            log_action(
                user=request.user,
                action="POST_SAVINGS",
                description=f"Posted ordinary savings of ₦{d['amount']} to {entry.member.full_name}",
                object_type="SavingsLedger",
                object_id=entry.id,
                object_name=entry.member.full_name,
                request_ip=get_client_ip(request),
            )

        if len(entries) == 1:
            return Response(SavingsLedgerSerializer(entries[0]).data, status=status.HTTP_201_CREATED)
        return Response(SavingsLedgerSerializer(entries, many=True).data, status=status.HTTP_201_CREATED)


class MemberLedgerView(generics.ListAPIView):
    throttle_classes = [UserRateThrottle]
    serializer_class = SavingsLedgerSerializer
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["hijri_year", "hijri_month", "entry_type"]
    ordering         = ["hijri_year", "hijri_month", "created_at"]

    def get_permissions(self):
        user = self.request.user
        if user.is_authenticated and user.role in ("admin", "committee", "head_of_school"):
            return [IsAdminOrCommitteeOrHOS()]
        return [IsAuthenticated()]

    def get_queryset(self):
        member_id = self.kwargs["member_id"]
        user = self.request.user
        if user.role in ("admin", "committee", "head_of_school"):
            qs = SavingsLedger.objects.filter(member_id=member_id).select_related("member")
        else:
            qs = SavingsLedger.objects.filter(
                member_id=member_id, member__user=user
            ).select_related("member")
        date_from = self.request.query_params.get("date_from")
        date_to   = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(gregorian_date__gte=date_from)
        if date_to:
            qs = qs.filter(gregorian_date__lte=date_to)
        return qs


class MemberBalanceView(APIView):
    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role not in ("admin", "committee"):
            if member.user != request.user:
                return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        balance = get_or_create_balance(member)
        return Response(MemberBalanceSerializer(balance).data)


class SavingsSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.member_profile
        except MemberProfile.DoesNotExist:
            profile = None

        member_data = None

        try:
            if profile is not None:
                member_balance = get_or_create_balance(profile)
                member_data = MemberBalanceSerializer(member_balance).data

            if request.user.role == "admin":
                summary = MemberBalance.objects.aggregate(
                    total_savings=Sum("total_savings"),
                    total_committed=Sum("suretyship_committed"),
                    member_count=Count("id"),
                )
                total_savings = summary["total_savings"] or Decimal("0.00")
                total_committed = summary["total_committed"] or Decimal("0.00")
                total_available = total_savings - total_committed
                member_count = summary["member_count"] or 0
            else:
                total_savings = Decimal("0.00")
                total_committed = Decimal("0.00")
                total_available = Decimal("0.00")
                member_count = 0

        except ProgrammingError:
            total_savings = Decimal("0.00")
            total_committed = Decimal("0.00")
            total_available = Decimal("0.00")
            member_count = 0
            member_data = None

        return Response({
            "member": member_data,
            "cooperative": {
                "total_savings": str(total_savings),
                "total_committed": str(total_committed),
                "total_available": str(total_available),
                "member_count": member_count,
            },
        })

class MyBalanceView(APIView):
    def get(self, request):
        try:
            profile = request.user.member_profile
        except Exception:
            return Response({"error": "No member profile found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            balance = get_or_create_balance(profile)
        except ProgrammingError:
            balance = MemberBalance(
                member=profile,
                total_savings=Decimal("0.00"),
                suretyship_committed=Decimal("0.00"),
                updated_at=None,
            )

        return Response(MemberBalanceSerializer(balance).data)


class MyLedgerView(generics.ListAPIView):
    serializer_class = SavingsLedgerSerializer

    def get_queryset(self):
        try:
            profile = self.request.user.member_profile
            return SavingsLedger.objects.filter(member=profile).order_by("-hijri_year", "-hijri_month", "-created_at")
        except Exception:
            return SavingsLedger.objects.none()


class SavingsChangeRequestListCreateView(generics.ListCreateAPIView):
    throttle_classes = [UserRateThrottle]
    serializer_class = SavingsChangeRequestSerializer
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ["status"]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "committee"):
            return SavingsChangeRequest.objects.select_related("member").all()
        try:
            return SavingsChangeRequest.objects.filter(member__user=user)
        except Exception:
            return SavingsChangeRequest.objects.none()

    def perform_create(self, serializer):
        from decimal import Decimal
        profile = self.request.user.member_profile
        balance = get_or_create_balance(profile)
        from apps.loans.models import LoanApplication, LoanStatus
        active_loan = LoanApplication.objects.filter(
            applicant=profile, status=LoanStatus.ACTIVE
        ).first()
        loan_balance = active_loan.outstanding_balance if active_loan else Decimal("0.00")

        serializer.save(
            member=profile,
            current_amount=profile.approved_monthly_contribution,
            savings_balance_at_request=balance.total_savings,
            loan_balance_at_request=loan_balance,
        )


class ApproveSavingsChangeView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            change_req = SavingsChangeRequest.objects.get(pk=pk, status="pending")
        except SavingsChangeRequest.DoesNotExist:
            return Response({"error": "Request not found or not pending."}, status=status.HTTP_404_NOT_FOUND)

        if change_req.member.user == request.user:
            return Response(
                {"error": "You cannot approve your own savings change request. Another admin/committee member must approve it."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ApproveSavingsChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        result = apply_savings_change(
            change_request=change_req,
            approved_by=request.user,
            hijri_month=d["effective_hijri_month"],
            hijri_year=d["effective_hijri_year"],
        )
        invalidate_dashboard_cache()

        log_action(
            user=request.user,
            action="APPROVE_SAVINGS_CHANGE",
            description=f"Approved savings change for {change_req.member.full_name} from ₦{change_req.current_amount} to ₦{change_req.requested_amount}",
            object_type="SavingsChangeRequest",
            object_id=change_req.id,
            object_name=change_req.member.full_name,
            request_ip=get_client_ip(request),
        )

        return Response(SavingsChangeRequestSerializer(result).data)


class RejectSavingsChangeView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            change_req = SavingsChangeRequest.objects.get(pk=pk, status="pending")
        except SavingsChangeRequest.DoesNotExist:
            return Response({"error": "Request not found or not pending."}, status=status.HTTP_404_NOT_FOUND)
        change_req.status = "rejected"
        change_req.save(update_fields=["status"])

        log_action(
            user=request.user,
            action="REJECT_SAVINGS_CHANGE",
            description=f"Rejected savings change for {change_req.member.full_name}",
            object_type="SavingsChangeRequest",
            object_id=change_req.id,
            object_name=change_req.member.full_name,
            request_ip=get_client_ip(request),
        )

        return Response(SavingsChangeRequestSerializer(change_req).data)


class PendingChangeRequestsCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role in ("admin", "committee"):
            count = SavingsChangeRequest.objects.filter(status="pending").count()
        else:
            count = 0
        return Response({"count": count})


class DuesCycleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdmin]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["is_posted", "hijri_year"]

    def get_serializer_class(self):
        return CreateDuesCycleSerializer if self.request.method == "POST" else TermlyDuesCycleSerializer

    def get_queryset(self):
        return TermlyDuesCycle.objects.all().order_by("-hijri_year", "-hijri_month")

    def create(self, request, *args, **kwargs):
        from utils.hijri import hijri_month_display
        serializer = CreateDuesCycleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        cycle = TermlyDuesCycle.objects.create(
            name=d["name"],
            amount=d["amount"],
            description=d["description"],
            hijri_month=d["hijri_month"],
            hijri_year=d["hijri_year"],
            hijri_display=hijri_month_display(d["hijri_month"], d["hijri_year"]),
            posted_by=request.user,
        )
        if d["member_ids"]:
            members = MemberProfile.objects.filter(pk__in=d["member_ids"])
            cycle.target_members.set(members)

        log_action(
            user=request.user,
            action="CREATE_DUES_CYCLE",
            description=f"Created dues cycle '{cycle.name}' of ₦{cycle.amount}",
            object_type="TermlyDuesCycle",
            object_id=cycle.id,
            object_name=cycle.name,
            request_ip=get_client_ip(request),
        )

        return Response(TermlyDuesCycleSerializer(cycle).data, status=status.HTTP_201_CREATED)


class PostDuesCycleView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            cycle = TermlyDuesCycle.objects.get(pk=pk)
        except TermlyDuesCycle.DoesNotExist:
            return Response({"error": "Dues cycle not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = post_termly_dues(cycle=cycle, posted_by=request.user)
            invalidate_dashboard_cache()

            log_action(
                user=request.user,
                action="POST_DUES",
                description=f"Posted dues cycle '{cycle.name}' of ₦{cycle.amount} to {len(result['successes'])} members",
                object_type="TermlyDuesCycle",
                object_id=cycle.id,
                object_name=cycle.name,
                new_values={"successes": len(result["successes"]), "failures": len(result["failures"])},
                request_ip=get_client_ip(request),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": f"Dues posted successfully.",
            "posted_to": len(result["successes"]),
            "failed": len(result["failures"]),
            "failures": result["failures"],
        })


class LedgerExportView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        qs = SavingsLedger.objects.filter(member_id=member_id).order_by(
            "hijri_year", "hijri_month", "created_at"
        )

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        hijri_month = request.query_params.get("hijri_month")
        hijri_year = request.query_params.get("hijri_year")

        if date_from:
            qs = qs.filter(gregorian_date__gte=date_from)
        if date_to:
            qs = qs.filter(gregorian_date__lte=date_to)
        if hijri_month:
            try:
                qs = qs.filter(hijri_month=int(hijri_month))
            except ValueError:
                pass
        if hijri_year:
            try:
                qs = qs.filter(hijri_year=int(hijri_year))
            except ValueError:
                pass

        export_format = request.query_params.get("format", "csv").lower()

        if export_format == "pdf":
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.pdfgen import canvas
            except ImportError:
                return Response(
                    {"error": "PDF export requires reportlab. Please install it."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            buffer = io.BytesIO()
            page_width, page_height = letter
            pdf = canvas.Canvas(buffer, pagesize=letter)
            y = page_height - 72
            pdf.setFont("Helvetica-Bold", 14)
            pdf.drawString(72, y, "Savings Ledger Export")
            pdf.setFont("Helvetica", 10)
            y -= 18
            pdf.drawString(72, y, f"Member: {member.file_number} — {member.full_name}")
            y -= 14
            pdf.drawString(72, y, f"Export date: {timezone.localdate().isoformat()}")
            y -= 24

            headers = ["Hijri", "Type", "Details", "Credit", "Debit", "Balance", "Date"]
            col_x = [72, 130, 200, 340, 400, 460, 520]
            for idx, header in enumerate(headers):
                pdf.drawString(col_x[idx], y, header)
            y -= 16
            pdf.setFont("Helvetica", 9)

            for entry in qs:
                if y < 72:
                    pdf.showPage()
                    y = page_height - 72
                    pdf.setFont("Helvetica", 9)

                pdf.drawString(col_x[0], y, entry.hijri_display)
                pdf.drawString(col_x[1], y, entry.entry_type.replace("_", " "))
                pdf.drawString(col_x[2], y, entry.details[:24])
                pdf.drawRightString(col_x[3] + 36, y, f"{entry.credit or 0:.2f}")
                pdf.drawRightString(col_x[4] + 36, y, f"{entry.debit or 0:.2f}")
                pdf.drawRightString(col_x[5] + 40, y, f"{entry.balance:.2f}")
                pdf.drawString(col_x[6], y, entry.gregorian_date.isoformat())
                y -= 14

            pdf.save()
            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = (
                f'attachment; filename="savings-ledger-{member.file_number}.pdf"'
            )
            return response

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "hijri_month", "hijri_year", "hijri_display", "entry_type",
            "details", "credit", "debit", "balance", "gregorian_date",
        ])
        for entry in qs:
            writer.writerow([
                entry.hijri_month,
                entry.hijri_year,
                entry.hijri_display,
                entry.entry_type,
                entry.details,
                str(entry.credit or ""),
                str(entry.debit or ""),
                str(entry.balance),
                entry.gregorian_date.isoformat(),
            ])

        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="savings-ledger-{member.file_number}.csv"'
        )
        return response


class BulkSavingsReportView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request):
        qs = SavingsLedger.objects.select_related("member").order_by(
            "member__file_number", "hijri_year", "hijri_month", "created_at"
        )

        member_id = request.query_params.get("member_id")
        member_ids = request.query_params.get("member_ids")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        hijri_month = request.query_params.get("hijri_month")
        hijri_year = request.query_params.get("hijri_year")
        entry_type = request.query_params.get("entry_type")

        if member_id:
            try:
                qs = qs.filter(member_id=int(member_id))
            except ValueError:
                pass
        if member_ids:
            try:
                ids = [int(i) for i in member_ids.split(",") if i.strip().isdigit()]
                if ids:
                    qs = qs.filter(member_id__in=ids)
            except ValueError:
                pass
        if date_from:
            qs = qs.filter(gregorian_date__gte=date_from)
        if date_to:
            qs = qs.filter(gregorian_date__lte=date_to)
        if hijri_month:
            try:
                qs = qs.filter(hijri_month=int(hijri_month))
            except ValueError:
                pass
        if hijri_year:
            try:
                qs = qs.filter(hijri_year=int(hijri_year))
            except ValueError:
                pass
        if entry_type:
            qs = qs.filter(entry_type=entry_type)

        export_format = request.query_params.get("format", "csv").lower()

        if export_format == "pdf":
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.pdfgen import canvas
            except ImportError:
                return Response(
                    {"error": "PDF export requires reportlab. Please install it."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            buffer = io.BytesIO()
            page_width, page_height = letter
            pdf = canvas.Canvas(buffer, pagesize=letter)
            y = page_height - 72
            pdf.setFont("Helvetica-Bold", 14)
            pdf.drawString(72, y, "Bulk Savings Report")
            pdf.setFont("Helvetica", 10)
            y -= 18
            filters_description = []
            if member_id:
                filters_description.append(f"Member ID: {member_id}")
            if member_ids:
                filters_description.append(f"Member IDs: {member_ids}")
            if entry_type:
                filters_description.append(f"Entry Type: {entry_type}")
            if date_from:
                filters_description.append(f"From: {date_from}")
            if date_to:
                filters_description.append(f"To: {date_to}")
            if filters_description:
                pdf.drawString(72, y, "; ".join(filters_description))
                y -= 14
            pdf.drawString(72, y, f"Generated: {timezone.localdate().isoformat()}")
            y -= 24

            headers = [
                "File #", "Member", "Hijri", "Type", "Credit", "Debit", "Balance", "Date",
            ]
            col_x = [72, 130, 260, 330, 400, 460, 520, 580]
            for idx, header in enumerate(headers):
                pdf.drawString(col_x[idx], y, header)
            y -= 16
            pdf.setFont("Helvetica", 8)

            for entry in qs:
                if y < 72:
                    pdf.showPage()
                    y = page_height - 72
                    pdf.setFont("Helvetica", 8)

                pdf.drawString(col_x[0], y, entry.member.file_number)
                pdf.drawString(col_x[1], y, entry.member.full_name[:18])
                pdf.drawString(col_x[2], y, entry.hijri_display)
                pdf.drawString(col_x[3], y, entry.entry_type.replace("_", " "))
                pdf.drawRightString(col_x[4] + 40, y, f"{entry.credit or 0:.2f}")
                pdf.drawRightString(col_x[5] + 40, y, f"{entry.debit or 0:.2f}")
                pdf.drawRightString(col_x[6] + 40, y, f"{entry.balance:.2f}")
                pdf.drawString(col_x[7], y, entry.gregorian_date.isoformat())
                y -= 12

            pdf.save()
            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = (
                f'attachment; filename="bulk-savings-report.pdf"'
            )
            return response

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "member_file_number",
            "member_name",
            "hijri_month",
            "hijri_year",
            "hijri_display",
            "entry_type",
            "details",
            "credit",
            "debit",
            "balance",
            "gregorian_date",
        ])
        for entry in qs:
            writer.writerow([
                entry.member.file_number,
                entry.member.full_name,
                entry.hijri_month,
                entry.hijri_year,
                entry.hijri_display,
                entry.entry_type,
                entry.details,
                str(entry.credit or ""),
                str(entry.debit or ""),
                str(entry.balance),
                entry.gregorian_date.isoformat(),
            ])

        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="bulk-savings-report.csv"'
        )
        return response


class BatchMonthlyDeductionView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        hijri_month = request.data.get("hijri_month")
        hijri_year = request.data.get("hijri_year")
        preview = request.data.get("preview", True)
        member_id = request.data.get("member_id") 

        if not hijri_month or not hijri_year:
            return Response({"error": "hijri_month and hijri_year required."}, status=400)

        members = MemberProfile.objects.filter(membership_status=MembershipStatus.ACTIVE)
        if member_id:
            try:
                members = members.filter(pk=member_id)
                if not members.exists():
                    return Response({"error": "Member not found."}, status=404)
            except ValueError:
                return Response({"error": "Invalid member_id."}, status=400)

        results = []

        for member in members:
            contribution = member.approved_monthly_contribution or Decimal('0.00')
            active_loan = LoanApplication.objects.filter(
                applicant=member, status=LoanStatus.ACTIVE
            ).first()
            loan_repayment = active_loan.proposed_monthly_repayment if active_loan else Decimal('0.00')
            total_debit = contribution + loan_repayment

            existing_savings = SavingsLedger.objects.filter(
                member=member,
                hijri_month=hijri_month,
                hijri_year=hijri_year,
                entry_type=LedgerEntryType.ORDINARY_SAVINGS,
            ).exists()

            result_item = {
                "member_id": member.id,
                "file_number": member.file_number,
                "name": member.full_name,
                "contribution": str(contribution),
                "loan_repayment": str(loan_repayment),
                "total_debit": str(total_debit),
                "existing_savings": existing_savings,
            }
            if existing_savings:
                result_item["warning"] = (
                    f"Savings already posted for {member.full_name} in {hijri_month}/{hijri_year}. "
                    "Proceeding will post a duplicate."
                )
            results.append(result_item)

        if preview:
            return Response({
                "preview": True,
                "single_member": bool(member_id),
                "total_members": len(results),
                "deductions": results,
            })

        posted_by = request.user
        for item in results:
            member = MemberProfile.objects.get(pk=item["member_id"])
            if Decimal(item["contribution"]) > 0:
                post_savings_entry(
                    member=member,
                    amount=Decimal(item["contribution"]),
                    hijri_month=hijri_month,
                    hijri_year=hijri_year,
                    posted_by=posted_by,
                    entry_type=LedgerEntryType.ORDINARY_SAVINGS,
                    details=f"Monthly contribution {hijri_month}/{hijri_year}",
                )
            if Decimal(item["loan_repayment"]) > 0:
                active_loan = LoanApplication.objects.filter(
                    applicant=member, status=LoanStatus.ACTIVE
                ).first()
                if active_loan:
                    post_repayment(
                        loan=active_loan,
                        amount=Decimal(item["loan_repayment"]),
                        hijri_month=hijri_month,
                        hijri_year=hijri_year,
                        posted_by=posted_by,
                    )

        invalidate_dashboard_cache()

        log_action(
            user=request.user,
            action="BATCH_DEDUCTION",
            description=f"Processed monthly deductions for {len(results)} members (contribution + loan repayment)",
            object_type="BatchOperation",
            object_id=0,
            object_name="BatchMonthlyDeduction",
            new_values={"total_members": len(results)},
            request_ip=get_client_ip(request),
        )

        return Response({
            "preview": False,
            "single_member": bool(member_id),
            "total_members": len(results),
            "deductions": results,
        })


class FullWithdrawalView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        if member.membership_status not in ["exited", "inactive"]:
            return Response(
                {"error": "Full withdrawal is only allowed for deactivated members."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        balance = get_or_create_balance(member)
        if balance.available_balance <= 0:
            return Response({"error": "No available balance to withdraw."}, status=status.HTTP_400_BAD_REQUEST)

        from utils.hijri import current_hijri
        h_month, h_year = current_hijri()

        try:
            entry = post_debit_entry(
                member=member,
                amount=balance.available_balance,
                hijri_month=h_month,
                hijri_year=h_year,
                posted_by=request.user,
                entry_type=LedgerEntryType.ADJUSTMENT,
                details=f"Full withdrawal — member deactivated",
            )
            invalidate_dashboard_cache()

            log_action(
                user=request.user,
                action="FULL_WITHDRAWAL",
                description=f"Full withdrawal of ₦{balance.available_balance} for {member.full_name} (deactivated)",
                object_type="SavingsLedger",
                object_id=entry.id,
                object_name=member.full_name,
                request_ip=get_client_ip(request),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": f"Withdrew ₦{balance.available_balance} from {member.full_name}.",
            "new_balance": str(balance.available_balance),
        })


class MoveToSpecialView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id, is_special_saver=True)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found or not a special saver."}, status=404)

        amount = Decimal(request.data.get("amount", "0"))
        if amount <= 0:
            return Response({"error": "Amount must be positive."}, status=400)

        balance = get_or_create_balance(member)
        if amount > balance.available_balance:
            return Response({"error": "Insufficient available balance."}, status=400)

        balance.total_savings -= amount
        balance.special_savings += amount
        balance.save()

        from utils.hijri import current_hijri
        h_month, h_year = current_hijri()
        entry = SavingsLedger.objects.create(
            member=member,
            hijri_month=h_month,
            hijri_year=h_year,
            hijri_display=hijri_month_display(h_month, h_year),
            entry_type="adjustment",
            details=f"Locked ₦{amount} into special fixed savings",
            debit=None,
            credit=None,
            balance=balance.total_savings,
            posted_by=request.user,
            verified_by_name=request.user.staff_id,
            verified_by_role=request.user.role,
        )
        invalidate_dashboard_cache()

        log_action(
            user=request.user,
            action="MOVE_TO_SPECIAL",
            description=f"Moved ₦{amount} to special savings for {member.full_name}",
            object_type="SavingsLedger",
            object_id=entry.id,
            object_name=member.full_name,
            request_ip=get_client_ip(request),
        )

        return Response({"message": f"₦{amount} moved to special savings.", "special_savings": str(balance.special_savings)})


class WithdrawSpecialView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id, is_special_saver=True)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found or not a special saver."}, status=404)

        amount_raw = request.data.get("amount")
        hijri_month = request.data.get("hijri_month")
        hijri_year = request.data.get("hijri_year")

        if not all([amount_raw, hijri_month, hijri_year]):
            return Response(
                {"error": "amount, hijri_month, hijri_year are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            amount = Decimal(str(amount_raw))
        except Exception:
            return Response({"error": "Invalid amount."}, status=400)

        balance = get_or_create_balance(member)
        if amount <= 0 or amount > balance.special_savings:
            return Response(
                {"error": f"Amount must be between 0 and {balance.special_savings}."},
                status=400
            )

        balance.special_savings -= amount
        balance.save()

        from utils.hijri import hijri_month_display
        h_month = int(hijri_month)
        h_year = int(hijri_year)
        entry = SavingsLedger.objects.create(
            member=member,
            hijri_month=h_month,
            hijri_year=h_year,
            hijri_display=hijri_month_display(h_month, h_year),
            entry_type="adjustment",
            details=f"Withdrew ₦{amount} from special fixed savings",
            debit=None,
            credit=None,
            balance=balance.total_savings,
            posted_by=request.user,
            verified_by_name=request.user.staff_id,
            verified_by_role=request.user.role,
        )
        invalidate_dashboard_cache()

        log_action(
            user=request.user,
            action="WITHDRAW_SPECIAL",
            description=f"Withdrew ₦{amount} from special savings for {member.full_name}",
            object_type="SavingsLedger",
            object_id=entry.id,
            object_name=member.full_name,
            request_ip=get_client_ip(request),
        )

        return Response({
            "message": f"₦{amount} withdrawn from special savings.",
            "special_savings": str(balance.special_savings),
        })
    

class ReconciliationView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request):
        hijri_month = request.query_params.get("hijri_month")
        hijri_year = request.query_params.get("hijri_year")

        qs = SavingsLedger.objects.all()

        if hijri_month:
            try:
                qs = qs.filter(hijri_month=int(hijri_month))
            except ValueError:
                pass
        if hijri_year:
            try:
                qs = qs.filter(hijri_year=int(hijri_year))
            except ValueError:
                pass

        total_credit = qs.aggregate(total=Sum("credit"))["total"] or Decimal("0.00")
        total_debit = qs.aggregate(total=Sum("debit"))["total"] or Decimal("0.00")
        difference = total_credit - total_debit

        return Response({
            "total_credit": str(total_credit),
            "total_debit": str(total_debit),
            "difference": str(difference),
            "is_balanced": total_credit == total_debit,
        })


class PostSpecialSavingsView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        member_id  = request.data.get("member_id")
        amount_raw = request.data.get("amount")
        hijri_month = request.data.get("hijri_month")
        hijri_year  = request.data.get("hijri_year")
        details     = request.data.get("details", "")

        if not all([member_id, amount_raw, hijri_month, hijri_year]):
            return Response(
                {"error": "member_id, amount, hijri_month, and hijri_year are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            amount = Decimal(str(amount_raw))
        except Exception:
            return Response({"error": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entry = post_special_savings_entry(
                member=member,
                amount=amount,
                hijri_month=int(hijri_month),
                hijri_year=int(hijri_year),
                posted_by=request.user,
                details=details,
            )
            invalidate_dashboard_cache()

            log_action(
                user=request.user,
                action="POST_SPECIAL_SAVINGS",
                description=f"Locked ₦{amount} into special savings for {member.full_name}",
                object_type="SavingsLedger",
                object_id=entry.id,
                object_name=member.full_name,
                request_ip=get_client_ip(request),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        balance = get_or_create_balance(member)
        return Response({
            "message": f"₦{amount} moved to special savings for {member.full_name}.",
            "entry_id": entry.id,
            "special_savings": str(balance.special_savings),
            "total_savings": str(balance.total_savings),
            "available_balance": str(balance.available_balance),
        }, status=status.HTTP_201_CREATED)