from decimal import Decimal
import csv
import io
from django.db.models import Count, Sum
from django.db.utils import ProgrammingError
from django.http import HttpResponse
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from apps.accounts.models import MemberProfile
from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee, IsAdminOrCommitteeOrHOS
from .models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle
from .serializers import (
    SavingsLedgerSerializer, MemberBalanceSerializer,
    PostSavingsSerializer, SavingsChangeRequestSerializer,
    ApproveSavingsChangeSerializer, TermlyDuesCycleSerializer,
    CreateDuesCycleSerializer,
)
from .services import (
    post_savings_entry, post_termly_dues,
    apply_savings_change, get_or_create_balance,
)


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

        if len(entries) == 1:
            return Response(SavingsLedgerSerializer(entries[0]).data, status=status.HTTP_201_CREATED)
        return Response(SavingsLedgerSerializer(entries, many=True).data, status=status.HTTP_201_CREATED)


class MemberLedgerView(generics.ListAPIView):
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

        # Allow if admin/committee OR the user is viewing their own balance
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

            # Check if user is admin or committee
            if request.user.role in ("admin", "committee"):
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
                # Non-privileged users see zero totals
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


# apps/savings/views.py - Make sure this view exists
class MyLedgerView(generics.ListAPIView):
    serializer_class = SavingsLedgerSerializer

    def get_queryset(self):
        try:
            profile = self.request.user.member_profile
            return SavingsLedger.objects.filter(member=profile).order_by("-hijri_year", "-hijri_month", "-created_at")
        except Exception:
            return SavingsLedger.objects.none()
        

class SavingsChangeRequestListCreateView(generics.ListCreateAPIView):
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
        # Get current loan balance
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
    permission_classes = [IsAdmin]   # or IsAdminOrCommittee if committee can also approve

    def post(self, request, pk):
        try:
            change_req = SavingsChangeRequest.objects.get(pk=pk, status="pending")
        except SavingsChangeRequest.DoesNotExist:
            return Response({"error": "Request not found or not pending."}, status=status.HTTP_404_NOT_FOUND)

        # Prevent self‑approval
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