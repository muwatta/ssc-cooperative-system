from decimal import Decimal
import csv
import io
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from django.db.models import Sum

from apps.sureties.models import SuretyRecord, SuretyStatus
from apps.sureties.services import check_surety_eligibility
from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee, IsAdminOrCommitteeOrHOS, IsHeadOfSchool, CanApproveLoan
from apps.accounts.models import MemberProfile
from apps.savings.services import get_or_create_balance
from apps.savings.models import SavingsLedger, MemberBalance
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus, LoanDraft
from .serializers import (
    LoanApplicationSerializer, LoanDraftSerializer, SubmitLoanSerializer,
    CommitteeDecisionSerializer, AdminFinalApprovalSerializer,
    PostRepaymentSerializer, LoanRepaymentLedgerSerializer,
    LoanEligibilitySerializer, LoanSettingsSerializer,
)
from .services import (
    check_loan_eligibility, calculate_max_borrowable,
    get_loan_configuration, submit_loan_application, create_surety_records,
    committee_approve_loan, committee_reject_loan,
    admin_final_approve_loan,
    post_repayment, handle_default_or_exit,
)
from utils.hijri import current_hijri
from utils.hijri import hijri_month_display
import json

class LoanEligibilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.member_profile
        except Exception:
            return Response({"error": "No member profile."}, status=status.HTTP_404_NOT_FOUND)

        result     = check_loan_eligibility(profile)
        max_borrow = calculate_max_borrowable(profile)
        config     = get_loan_configuration()

        balance = get_or_create_balance(profile)
        self_surety_max = (balance.available_balance * config.self_surety_ratio).quantize(Decimal("0.01"))

        h_now_month, h_now_year = current_hijri()

        return Response({
            "eligible":                      result["eligible"],
            "reasons":                       result["reasons"],
            "max_borrowable":                str(max_borrow),
            "self_surety_max":               str(self_surety_max),
            "consecutive_months":            profile.consecutive_savings_months,
            "required_consecutive_months":   config.consecutive_savings_months_required,
            "is_new_member":                 profile.is_new_member,
            "max_repayment_months":          config.max_repayment_months,
            "loan_amount_ratio":             str(config.self_surety_ratio),
            "max_sureties":                  config.max_sureties,
            "min_loan_amount":               str(config.min_loan_amount),
            "max_loan_amount":               str(config.max_loan_amount),
            "require_no_active_loan":        config.require_no_active_loan,
            "require_no_surety_liabilities": config.require_no_surety_liabilities,
            "current_hijri_month":           h_now_month,
            "current_hijri_year":            h_now_year, 
        })
    

class LoanSettingsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        config = get_loan_configuration()
        return Response(LoanSettingsSerializer(config).data)

    def patch(self, request):
        config = get_loan_configuration()
        serializer = LoanSettingsSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LoanApplicationListView(generics.ListAPIView):
    """GET /api/v1/loans/ — list loans (role-filtered)"""
    serializer_class = LoanApplicationSerializer
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status"]
    ordering         = ["created_at"]

    def get_permissions(self):
        return [IsAdminOrCommitteeOrHOS()]

    def get_queryset(self):
        return LoanApplication.objects.select_related("applicant").all()


class MyLoanListView(generics.ListAPIView):
    """GET /api/v1/loans/mine/ — own loans"""
    serializer_class = LoanApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            profile = self.request.user.member_profile
            return LoanApplication.objects.filter(applicant=profile).order_by("created_at")
        except Exception:
            return LoanApplication.objects.none()


class SubmitLoanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            profile = request.user.member_profile
        except Exception:
            return Response({"error": "No member profile."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmitLoanSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        # The serializer now sends empty list for sureties if not needed
        sureties = d.pop("sureties", [])

        try:
            loan = submit_loan_application(member=profile, data={
            **d,
            "monthly_salary": d.get("monthly_salary", profile.monthly_income),
        }, sureties=sureties if sureties else None)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoanApplicationSerializer(loan).data, status=status.HTTP_201_CREATED)
    

class CommitteeDecisionView(APIView):
    permission_classes = [CanApproveLoan]

    def post(self, request, pk):
        try:
            loan = LoanApplication.objects.select_related("applicant__user").get(pk=pk)
        except LoanApplication.DoesNotExist:
            return Response({"error": "Loan not found."}, status=status.HTTP_404_NOT_FOUND)

        # SRS Rule L9 — admin cannot approve own loan
        if request.user.role == "admin" and loan.applicant.user == request.user:
            return Response(
                {"error": "Admin cannot approve their own loan application (SRS Rule L9)."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CommitteeDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            if d["decision"] == "approve":
                loan = committee_approve_loan(loan, request.user, d["amount_approved"], d.get("note", ""))
            else:
                loan = committee_reject_loan(loan, request.user, d.get("note", ""))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoanApplicationSerializer(loan).data)


class AdminFinalApprovalView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            loan = LoanApplication.objects.get(pk=pk, status=LoanStatus.PENDING_ADMIN)
        except LoanApplication.DoesNotExist:
            return Response(
                {"error": "Loan not found or not pending admin approval."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Prevent admin from approving their own loan
        if loan.applicant.user == request.user:
            return Response(
                {"error": "Admin cannot approve their own loan."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AdminFinalApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            loan = admin_final_approve_loan(loan, request.user, d.get("note", ""))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoanApplicationSerializer(loan).data)


class PendingLoanCountView(APIView):
    """GET /api/v1/loans/pending-count/ — get count of pending loans by status"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        counts = {}
        
        # Admin sees pending admin approvals
        if user.role == "admin":
            counts["pending_admin"] = LoanApplication.objects.filter(
                status=LoanStatus.PENDING_ADMIN
            ).count()
        
        # Committee sees submitted and under review
        if user.role in ["committee", "admin"]:
            counts["submitted"] = LoanApplication.objects.filter(
                status=LoanStatus.SUBMITTED
            ).count()
            counts["under_review"] = LoanApplication.objects.filter(
                status=LoanStatus.UNDER_REVIEW
            ).count()
            counts["pending_sureties"] = LoanApplication.objects.filter(
                status=LoanStatus.PENDING_SURETIES
            ).count()
        
        return Response(counts)


class HOSApprovalView(APIView):
    permission_classes = [IsHeadOfSchool]

    def post(self, request, pk):
        try:
            loan = LoanApplication.objects.get(
                pk=pk,
                status__in=[LoanStatus.APPROVED, LoanStatus.PENDING_ADMIN],
            )
        except LoanApplication.DoesNotExist:
            return Response(
                {"error": "Loan not found or not in a valid endorsement state."},
                status=status.HTTP_404_NOT_FOUND
            )

        loan.hos_approved_by = request.user
        loan.hos_approved_at = timezone.now()
        loan.save(update_fields=["hos_approved_by", "hos_approved_at"])

        return Response(LoanApplicationSerializer(loan).data)


class PostRepaymentView(APIView):
    permission_classes = [IsAdminOrCommittee]

    def post(self, request, pk):
        try:
            loan = LoanApplication.objects.get(pk=pk, status=LoanStatus.ACTIVE)
        except LoanApplication.DoesNotExist:
            return Response({"error": "Active loan not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PostRepaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            repayment = post_repayment(
                loan=loan,
                amount=d["amount"],
                hijri_month=d["hijri_month"],
                hijri_year=d["hijri_year"],
                posted_by=request.user,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoanRepaymentLedgerSerializer(repayment).data, status=status.HTTP_201_CREATED)


class LoanRepaymentHistoryView(generics.ListAPIView):
    serializer_class   = LoanRepaymentLedgerSerializer
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get_queryset(self):
        return LoanRepaymentLedger.objects.filter(loan_id=self.kwargs["pk"]).order_by("hijri_year", "hijri_month")


class LoanRepaymentExportView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request, pk):
        try:
            loan = LoanApplication.objects.select_related("applicant").get(pk=pk)
        except LoanApplication.DoesNotExist:
            return Response({"error": "Loan not found."}, status=status.HTTP_404_NOT_FOUND)

        repayments = LoanRepaymentLedger.objects.filter(loan=loan).order_by("hijri_year", "hijri_month")
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
            pdf.drawString(72, y, "Loan Repayment Schedule")
            pdf.setFont("Helvetica", 10)
            y -= 18
            pdf.drawString(
                72,
                y,
                f"Loan ID: {loan.id} | Applicant: {loan.applicant_name} | Status: {loan.status}",
            )
            y -= 14
            pdf.drawString(
                72,
                y,
                f"Amount Applied: ₦{loan.amount_applied} | Outstanding: ₦{loan.outstanding_balance}",
            )
            y -= 14
            if loan.repayment_start_hijri_year and loan.repayment_start_hijri_month:
                pdf.drawString(
                    72,
                    y,
                    f"Repayment Start: {loan.repayment_start_hijri_month}/{loan.repayment_start_hijri_year}",
                )
                y -= 14
            if loan.repayment_end_hijri_year and loan.repayment_end_hijri_month:
                pdf.drawString(
                    72,
                    y,
                    f"Repayment End: {loan.repayment_end_hijri_month}/{loan.repayment_end_hijri_year}",
                )
                y -= 14
            pdf.drawString(72, y, f"Export date: {timezone.localdate().isoformat()}")
            y -= 24

            headers = ["Hijri", "Amount", "Balance Before", "Balance After", "Posted By", "Posted At"]
            col_x = [72, 150, 250, 350, 450, 540]
            for idx, header in enumerate(headers):
                pdf.drawString(col_x[idx], y, header)
            y -= 16
            pdf.setFont("Helvetica", 9)

            for entry in repayments:
                if y < 72:
                    pdf.showPage()
                    y = page_height - 72
                    pdf.setFont("Helvetica", 9)

                pdf.drawString(col_x[0], y, entry.hijri_display)
                pdf.drawRightString(col_x[1] + 60, y, f"{entry.amount:.2f}")
                pdf.drawRightString(col_x[2] + 60, y, f"{entry.balance_before:.2f}")
                pdf.drawRightString(col_x[3] + 60, y, f"{entry.balance_after:.2f}")
                pdf.drawString(col_x[4], y, entry.verified_by_name or "")
                pdf.drawString(col_x[5], y, entry.created_at.isoformat() if hasattr(entry.created_at, 'isoformat') else str(entry.created_at))
                y -= 14

            pdf.save()
            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = (
                f'attachment; filename="loan-{loan.id}-repayments.pdf"'
            )
            return response

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "hijri_display",
            "amount",
            "balance_before",
            "balance_after",
            "verified_by_name",
            "created_at",
        ])
        for entry in repayments:
            writer.writerow([
                entry.hijri_display,
                str(entry.amount),
                str(entry.balance_before),
                str(entry.balance_after),
                entry.verified_by_name,
                entry.created_at.isoformat() if hasattr(entry.created_at, 'isoformat') else str(entry.created_at),
            ])

        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="loan-{loan.id}-repayments.csv"'
        )
        return response


class LoanDetailView(generics.RetrieveAPIView):
    serializer_class   = LoanApplicationSerializer
    permission_classes = [IsAdminOrCommitteeOrHOS]
    queryset           = LoanApplication.objects.select_related("applicant").all()


class HandleDefaultView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            loan = LoanApplication.objects.get(pk=pk, status=LoanStatus.ACTIVE)
        except LoanApplication.DoesNotExist:
            return Response({"error": "Active loan not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            result = handle_default_or_exit(loan)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Loan defaulted. Balance transferred to sureties.", "detail": result})


class LoanRepaymentExportAsyncView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def post(self, request, pk):
        from apps.loans.tasks import generate_loan_repayment_pdf
        
        try:
            loan = LoanApplication.objects.get(pk=pk)
        except LoanApplication.DoesNotExist:
            return Response(
                {"error": "Loan not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Queue async task
        task = generate_loan_repayment_pdf.delay(pk)
        
        return Response({
            "message": "PDF export queued",
            "task_id": task.id,
            "status": "pending"
        }, status=status.HTTP_202_ACCEPTED)


class TaskStatusView(APIView):
    """GET /api/v1/tasks/<task_id>/ — get async task status"""
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        from celery.result import AsyncResult
        
        task = AsyncResult(task_id)
        
        return Response({
            "task_id": task_id,
            "status": task.status,
            "result": task.result if task.status == "SUCCESS" else None,
            "error": str(task.info) if task.status == "FAILURE" else None,
        })
    


class LoanDraftView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.member_profile
        except Exception:
            return Response({"error": "No member profile."}, status=status.HTTP_404_NOT_FOUND)

        draft, _ = LoanDraft.objects.get_or_create(applicant=profile)
        return Response(LoanDraftSerializer(draft).data)

    def post(self, request):
        try:
            profile = request.user.member_profile
        except Exception:
            return Response({"error": "No member profile."}, status=status.HTTP_404_NOT_FOUND)

        draft, _ = LoanDraft.objects.get_or_create(applicant=profile)
        draft.data = request.data.get("data", {})
        draft.save()
        return Response(LoanDraftSerializer(draft).data)


class AdminApprovalPreviewView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, pk):
        try:
            loan = LoanApplication.objects.select_related('applicant').get(pk=pk)
        except LoanApplication.DoesNotExist:
            return Response({"error": "Loan not found."}, status=status.HTTP_404_NOT_FOUND)

        if loan.status != LoanStatus.PENDING_ADMIN:
            return Response({"error": "Loan is not pending admin approval."}, status=status.HTTP_400_BAD_REQUEST)

        # Borrower details
        member = loan.applicant
        balance = get_or_create_balance(member)
        config = get_loan_configuration()
        self_surety_max = (balance.available_balance * config.self_surety_ratio).quantize(Decimal("0.01"))
        max_borrowable = calculate_max_borrowable(member)

        borrower = {
            "full_name": member.full_name,
            "file_number": member.file_number,
            "school_branch": member.school_branch,
            "designation": member.designation,
            "amount_applied": str(loan.amount_approved or loan.amount_applied),
            "total_savings": str(balance.total_savings),
            "available_balance": str(balance.available_balance),
            "self_surety_max": str(self_surety_max),
            "max_borrowable": str(max_borrowable),
            "proposed_duration_months": loan.proposed_duration_months,
        }

        # Repayment breakdown
        monthly_repayment = (loan.amount_applied / loan.proposed_duration_months).quantize(Decimal("0.01"))
        monthly_contribution = member.approved_monthly_contribution
        first_month_debit = monthly_repayment + monthly_contribution

        # External sureties
        sureties_qs = SuretyRecord.objects.filter(
            loan=loan,
            is_self_surety=False
        ).select_related('surety')

        sureties_list = []
        for rec in sureties_qs:
            s_balance = get_or_create_balance(rec.surety)
            eligibility = check_surety_eligibility(rec.surety, rec.amount_guaranteed)
            sureties_list.append({
                "full_name": rec.surety.full_name,
                "file_number": rec.surety.file_number,
                "amount_guaranteed": str(rec.amount_guaranteed),
                "eligible": eligibility["eligible"],
                "reasons": eligibility["reasons"] if not eligibility["eligible"] else [],
                "status": rec.status,
            })

        return Response({
            "borrower": borrower,
            "repayment_breakdown": {
                "monthly_repayment": str(monthly_repayment),
                "monthly_contribution": str(monthly_contribution),
                "first_month_debit": str(first_month_debit),
            },
            "sureties": sureties_list,
        })
    


class MemberStatementExportView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        export_format = request.query_params.get("format", "csv").lower()
        entries = SavingsLedger.objects.filter(member=member).order_by(
            "hijri_year", "hijri_month", "created_at"
        )

        if export_format == "pdf":
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.pdfgen import canvas
            except ImportError:
                return Response({"error": "PDF export requires reportlab."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            buffer = io.BytesIO()
            pdf = canvas.Canvas(buffer, pagesize=letter)
            y = 750
            pdf.setFont("Helvetica-Bold", 14)
            pdf.drawString(72, y, f"Savings Statement – {member.file_number} {member.full_name}")
            y -= 30
            pdf.setFont("Helvetica", 9)
            for e in entries:
                if y < 72:
                    pdf.showPage()
                    y = 750
                pdf.drawString(72, y, e.hijri_display)
                pdf.drawString(200, y, e.entry_type.replace("_", " "))
                pdf.drawString(300, y, (e.details or "")[:30])
                pdf.drawRightString(450, y, f"₦{e.debit or 0:.2f}")
                pdf.drawRightString(500, y, f"₦{e.credit or 0:.2f}")
                pdf.drawRightString(550, y, f"₦{e.balance:.2f}")
                y -= 14
            pdf.save()
            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = f"attachment; filename=statement_{member.file_number}.pdf"
            return response

        # CSV
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Hijri Date", "Type", "Details", "Debit", "Credit", "Balance", "Gregorian"])
        for e in entries:
            writer.writerow([
                e.hijri_display,
                e.entry_type.replace("_", " "),
                e.details or "",
                str(e.debit or ""),
                str(e.credit or ""),
                str(e.balance),
                e.gregorian_date.isoformat(),
            ])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f"attachment; filename=statement_{member.file_number}.csv"
        return response
    


class LoanBookExportView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request):
        export_format = request.query_params.get("format", "csv").lower()
        loans = LoanApplication.objects.filter(status=LoanStatus.ACTIVE).select_related("applicant")

        if export_format == "pdf":
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.pdfgen import canvas
            except ImportError:
                return Response({"error": "PDF export requires reportlab."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            buffer = io.BytesIO()
            pdf = canvas.Canvas(buffer, pagesize=letter)
            y = 750
            pdf.setFont("Helvetica-Bold", 14)
            pdf.drawString(72, y, "Loan Book Report – Active Loans")
            y -= 30
            pdf.setFont("Helvetica", 9)
            for loan in loans:
                if y < 72:
                    pdf.showPage()
                    y = 750
                pdf.drawString(72, y, f"Loan #{loan.id}: {loan.applicant.full_name} ({loan.applicant.file_number})")
                pdf.drawString(300, y, f"Approved: ₦{loan.amount_approved or loan.amount_applied:.2f}")
                pdf.drawString(450, y, f"Outstanding: ₦{loan.outstanding_balance:.2f}")
                y -= 14
            pdf.save()
            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = "attachment; filename=loan_book.pdf"
            return response

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Loan ID", "Applicant", "File No", "Amount Approved", "Outstanding", "Monthly Repayment", "Duration", "Start Hijri"])
        for loan in loans:
            writer.writerow([
                loan.id,
                loan.applicant.full_name,
                loan.applicant.file_number,
                str(loan.amount_approved or loan.amount_applied),
                str(loan.outstanding_balance),
                str(loan.proposed_monthly_repayment),
                loan.proposed_duration_months,
                f"{loan.repayment_start_hijri_month}/{loan.repayment_start_hijri_year}" if loan.repayment_start_hijri_month else "N/A",
            ])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = "attachment; filename=loan_book.csv"
        return response


class SuretyExposureExportView(APIView):
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request):
        export_format = request.query_params.get("format", "csv").lower()
        balances = MemberBalance.objects.filter(
            suretyship_committed__gt=0
        ).select_related("member")

        if export_format == "pdf":
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.pdfgen import canvas
            except ImportError:
                return Response({"error": "PDF export requires reportlab."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            buffer = io.BytesIO()
            pdf = canvas.Canvas(buffer, pagesize=letter)
            y = 750
            pdf.setFont("Helvetica-Bold", 14)
            pdf.drawString(72, y, "Surety Exposure Report")
            y -= 30
            pdf.setFont("Helvetica", 9)
            for b in balances:
                if y < 72:
                    pdf.showPage()
                    y = 750
                pdf.drawString(72, y, f"{b.member.file_number} {b.member.full_name}")
                pdf.drawString(300, y, f"Committed: ₦{b.suretyship_committed:.2f}  |  Available: ₦{b.available_balance:.2f}")
                y -= 14
            pdf.save()
            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = "attachment; filename=surety_exposure.pdf"
            return response

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["File No", "Name", "Total Savings", "Available", "Surety Committed", "Remaining Capacity (85%)"])
        for b in balances:
            max_capacity = b.available_balance * 0.85
            writer.writerow([
                b.member.file_number,
                b.member.full_name,
                str(b.total_savings),
                str(b.available_balance),
                str(b.suretyship_committed),
                f"{max_capacity:.2f}",
            ])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = "attachment; filename=surety_exposure.csv"
        return response