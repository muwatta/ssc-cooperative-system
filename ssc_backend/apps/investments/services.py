"""SSC Cooperative — Investments Serializers, Views, URLs"""

from rest_framework import serializers, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee
from apps.accounts.models import MemberProfile, MembershipStatus
from apps.savings.services import post_savings_entry, get_or_create_balance
from apps.savings.models import LedgerEntryType
from utils.hijri import hijri_month_display
from .models import Investment, ProfitDistribution


# ── Serializers ───────────────────────────────────────────────────

class InvestmentSerializer(serializers.ModelSerializer):
    recorded_by_id = serializers.CharField(source="recorded_by.staff_id", read_only=True)

    class Meta:
        model  = Investment
        fields = ["id", "name", "description", "amount", "hijri_month", "hijri_year", "hijri_display", "recorded_by_id", "created_at"]
        read_only_fields = ["id", "hijri_display", "recorded_by_id", "created_at"]


class ProfitDistributionSerializer(serializers.ModelSerializer):
    investment_name = serializers.CharField(source="investment.name", read_only=True)

    class Meta:
        model  = ProfitDistribution
        fields = ["id", "investment", "investment_name", "profit_percentage", "total_profit",
                  "hijri_month", "hijri_year", "hijri_display", "is_distributed", "distributed_at", "created_at"]
        read_only_fields = ["id", "total_profit", "hijri_display", "is_distributed", "distributed_at", "created_at"]


class CreateDistributionSerializer(serializers.Serializer):
    investment        = serializers.IntegerField()
    profit_percentage = serializers.DecimalField(max_digits=5, decimal_places=2)
    hijri_month       = serializers.IntegerField(min_value=1, max_value=12)
    hijri_year        = serializers.IntegerField(min_value=1400)

    def validate_profit_percentage(self, value):
        if value <= 0 or value > 100:
            raise serializers.ValidationError("Percentage must be between 0 and 100.")
        return value


# ── Views ─────────────────────────────────────────────────────────

class InvestmentListCreateView(generics.ListCreateAPIView):
    queryset           = Investment.objects.all()
    serializer_class   = InvestmentSerializer
    permission_classes = [IsAdminOrCommittee]

    def perform_create(self, serializer):
        hm = serializer.validated_data["hijri_month"]
        hy = serializer.validated_data["hijri_year"]
        serializer.save(
            recorded_by=self.request.user,
            hijri_display=hijri_month_display(hm, hy)
        )


class DistributionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrCommittee]

    def get_serializer_class(self):
        return CreateDistributionSerializer if self.request.method == "POST" else ProfitDistributionSerializer

    def get_queryset(self):
        return ProfitDistribution.objects.select_related("investment").all()

    def create(self, request, *args, **kwargs):
        serializer = CreateDistributionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            investment = Investment.objects.get(pk=d["investment"])
        except Investment.DoesNotExist:
            return Response({"error": "Investment not found."}, status=status.HTTP_404_NOT_FOUND)

        total_profit = (investment.amount * d["profit_percentage"] / 100).quantize(Decimal("0.01"))
        dist = ProfitDistribution.objects.create(
            investment=investment,
            profit_percentage=d["profit_percentage"],
            total_profit=total_profit,
            hijri_month=d["hijri_month"],
            hijri_year=d["hijri_year"],
            hijri_display=hijri_month_display(d["hijri_month"], d["hijri_year"]),
            distributed_by=request.user,
        )
        return Response(ProfitDistributionSerializer(dist).data, status=status.HTTP_201_CREATED)


class DistributeProfit(APIView):
    """POST /api/v1/investments/distributions/<id>/distribute/ — actually credit members"""
    permission_classes = [IsAdminOrCommittee]

    @transaction.atomic
    def post(self, request, pk):
        try:
            dist = ProfitDistribution.objects.get(pk=pk, is_distributed=False)
        except ProfitDistribution.DoesNotExist:
            return Response({"error": "Distribution not found or already distributed."}, status=status.HTTP_404_NOT_FOUND)

        active_members = MemberProfile.objects.filter(membership_status=MembershipStatus.ACTIVE)
        total_savings_pool = sum(
            get_or_create_balance(m).total_savings for m in active_members
        )

        if total_savings_pool == Decimal("0.00"):
            return Response({"error": "No savings pool to distribute against."}, status=status.HTTP_400_BAD_REQUEST)

        credited = []
        for member in active_members:
            balance = get_or_create_balance(member)
            if balance.total_savings == Decimal("0.00"):
                continue
            proportion     = balance.total_savings / total_savings_pool
            member_profit  = (dist.total_profit * proportion).quantize(Decimal("0.01"))
            if member_profit > Decimal("0.00"):
                post_savings_entry(
                    member=member,
                    amount=member_profit,
                    hijri_month=dist.hijri_month,
                    hijri_year=dist.hijri_year,
                    posted_by=request.user,
                    entry_type=LedgerEntryType.PROFIT_SHARE,
                    details=f"Profit Share — {dist.investment.name} ({dist.profit_percentage}%)",
                )
                credited.append({"file_number": member.file_number, "amount": str(member_profit)})

        dist.is_distributed = True
        dist.distributed_at = timezone.now()
        dist.save(update_fields=["is_distributed", "distributed_at"])

        return Response({"message": "Profit distributed.", "credited_members": len(credited), "details": credited})
