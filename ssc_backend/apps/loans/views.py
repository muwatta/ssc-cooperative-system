"""SSC Cooperative — Loans Views"""

from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from decimal import Decimal

from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee, IsAdminOrCommitteeOrHOS, CanApproveLoan, CanGiveFinalLoanApproval
from apps.accounts.models import MemberProfile
from apps.savings.services import get_or_create_balance
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus
from .serializers import (
    LoanApplicationSerializer, SubmitLoanSerializer,
    CommitteeDecisionSerializer, PostRepaymentSerializer,
    LoanRepaymentLedgerSerializer, LoanEligibilitySerializer,
)
from .services import (
    check_loan_eligibility, calculate_max_borrowable,
    submit_loan_application, create_surety_records,
    committee_approve_loan, committee_reject_loan,
    hos_approve_loan, post_repayment, handle_default_or_exit,
)


class LoanEligibilityView(APIView):
    """GET /api/v1/loans/eligibility/ — check own eligibility"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.member_profile
        except Exception:
            return Response({"error": "No member profile."}, status=status.HTTP_404_NOT_FOUND)

        result    = check_loan_eligibility(profile)
        max_borrow = calculate_max_borrowable(profile)

        return Response({
            "eligible":           result["eligible"],
            "reasons":            result["reasons"],
            "max_borrowable":     str(max_borrow),
            "consecutive_months": profile.consecutive_savings_months,
        })


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
    """POST /api/v1/loans/apply/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            profile = request.user.member_profile
        except Exception:
            return Response({"error": "No member profile."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmitLoanSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            loan = submit_loan_application(member=profile, data={
                **d,
                "monthly_salary": d.get("monthly_salary", profile.monthly_income),
            })
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        surety_items = [
            {
                "member_id": profile.pk,
                "amount": d["amount_applied"],
                "layer": 1,
            }
        ]
        for idx, item in enumerate(d.get("sureties", []), start=2):
            surety_items.append({
                "member_id": item["member_id"],
                "amount": item["amount"],
                "layer": idx,
            })

        if surety_items:
            create_surety_records(loan, surety_items)
            if len(d.get("sureties", [])) > 0:
                loan.status = LoanStatus.PENDING_SURETIES
                loan.save(update_fields=["status"])

        # Update repayment schedule dates on the loan
        loan.repayment_start_hijri_month = d["repayment_start_hijri_month"]
        loan.repayment_start_hijri_year  = d["repayment_start_hijri_year"]
        loan.save(update_fields=["repayment_start_hijri_month", "repayment_start_hijri_year"])

        return Response(LoanApplicationSerializer(loan).data, status=status.HTTP_201_CREATED)


class CommitteeDecisionView(APIView):
    """
    POST /api/v1/loans/<id>/committee-decision/
    SRS L10 stage 1. Admin cannot approve own loan (enforced here).
    """
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


class HOSApprovalView(APIView):
    """POST /api/v1/loans/<id>/hos-approve/ — SRS L10 stage 2"""
    permission_classes = [CanGiveFinalLoanApproval]

    def post(self, request, pk):
        try:
            loan = LoanApplication.objects.get(pk=pk)
        except LoanApplication.DoesNotExist:
            return Response({"error": "Loan not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            loan = hos_approve_loan(loan, request.user)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LoanApplicationSerializer(loan).data)


class PostRepaymentView(APIView):
    """POST /api/v1/loans/<id>/repayment/"""
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
    """GET /api/v1/loans/<id>/repayments/"""
    serializer_class   = LoanRepaymentLedgerSerializer
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get_queryset(self):
        return LoanRepaymentLedger.objects.filter(loan_id=self.kwargs["pk"]).order_by("hijri_year", "hijri_month")


class LoanDetailView(generics.RetrieveAPIView):
    """GET /api/v1/loans/<id>/"""
    serializer_class   = LoanApplicationSerializer
    permission_classes = [IsAdminOrCommitteeOrHOS]
    queryset           = LoanApplication.objects.select_related("applicant").all()


class HandleDefaultView(APIView):
    """POST /api/v1/loans/<id>/default/ — SRS M4, SR7"""
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
