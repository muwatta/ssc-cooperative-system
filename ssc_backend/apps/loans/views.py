
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

from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee, IsAdminOrCommitteeOrHOS, CanApproveLoan
from apps.accounts.models import MemberProfile
from apps.savings.services import get_or_create_balance
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus
from .serializers import (
    LoanApplicationSerializer, SubmitLoanSerializer,
    CommitteeDecisionSerializer, PostRepaymentSerializer,
    LoanRepaymentLedgerSerializer, LoanEligibilitySerializer,
    LoanSettingsSerializer,
)
from .services import (
    check_loan_eligibility, calculate_max_borrowable,
    get_loan_configuration, submit_loan_application, create_surety_records,
    committee_approve_loan, committee_reject_loan,
    admin_final_approve_loan,
    post_repayment, handle_default_or_exit,
)
from utils.hijri import current_hijri

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
    ordering         = ["-created_at"]

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
            return LoanApplication.objects.filter(applicant=profile).order_by("-created_at")
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
                loan.status = LoanStatus.APPROVED
                loan.save(update_fields=["status"])
            else:
                loan = committee_reject_loan(loan, request.user, d.get("note", ""))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoanApplicationSerializer(loan).data)


class AdminFinalApprovalView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            loan = LoanApplication.objects.get(pk=pk, status=LoanStatus.APPROVED)
        except LoanApplication.DoesNotExist:
            return Response(
                {"error": "Loan not found or not in committee-approved state."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Prevent admin from approving their own loan
        if loan.applicant.user == request.user:
            return Response(
                {"error": "Admin cannot approve their own loan."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            loan = admin_final_approve_loan(loan, request.user)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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