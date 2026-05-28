from decimal import Decimal
from django.db.models import Count, Sum
from django.db.utils import ProgrammingError
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
    """POST /api/v1/savings/post/ — Admin posts monthly savings"""
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = PostSavingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        member = d["_member"]

        entry = post_savings_entry(
            member=member,
            amount=d["amount"],
            hijri_month=d["hijri_month"],
            hijri_year=d["hijri_year"],
            posted_by=request.user,
        )
        return Response(SavingsLedgerSerializer(entry).data, status=status.HTTP_201_CREATED)


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
    permission_classes = [IsAdminOrCommitteeOrHOS]

    def get(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == "staff":
            if member.user != request.user:
                return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        try:
            balance = get_or_create_balance(member)
        except ProgrammingError:
            balance = MemberBalance(
                member=member,
                total_savings=Decimal("0.00"),
                suretyship_committed=Decimal("0.00"),
                updated_at=None,
            )

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

            summary = MemberBalance.objects.aggregate(
                total_savings=Sum("total_savings"),
                total_committed=Sum("suretyship_committed"),
                member_count=Count("id"),
            )

            total_savings = summary["total_savings"] or Decimal("0.00")
            total_committed = summary["total_committed"] or Decimal("0.00")
            total_available = total_savings - total_committed
        except ProgrammingError:
            total_savings = Decimal("0.00")
            total_committed = Decimal("0.00")
            total_available = Decimal("0.00")
            summary = {"member_count": 0}
            member_data = None

        return Response({
            "member": member_data,
            "cooperative": {
                "total_savings": str(total_savings),
                "total_committed": str(total_committed),
                "total_available": str(total_available),
                "member_count": summary["member_count"] or 0,
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
            return SavingsLedger.objects.filter(member=profile).order_by("hijri_year", "hijri_month")
        except Exception:
            return SavingsLedger.objects.none()


# Savings Change Requests

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
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            change_req = SavingsChangeRequest.objects.get(pk=pk, status="pending")
        except SavingsChangeRequest.DoesNotExist:
            return Response({"error": "Request not found or not pending."}, status=status.HTTP_404_NOT_FOUND)

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


# Termly Dues

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
