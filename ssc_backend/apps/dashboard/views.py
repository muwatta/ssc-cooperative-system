from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.loans.models import LoanApplication
from apps.savings.models import MemberBalance
from django.db.models import Sum

class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pending_admin = LoanApplication.objects.filter(status="pending_admin").count()
        active_loans = LoanApplication.objects.filter(status="active").count()
        total_outstanding = LoanApplication.objects.filter(
            status="active"
        ).aggregate(total=Sum("outstanding_balance"))["total"] or 0
        total_savings = MemberBalance.objects.aggregate(
            total=Sum("total_savings")
        )["total"] or 0
        total_special = MemberBalance.objects.aggregate(
            total=Sum("special_savings")
        )["total"] or 0

        return Response({
            "pending_admin": pending_admin,
            "active_loans": active_loans,
            "total_outstanding": str(total_outstanding),
            "total_savings": str(total_savings),
            "total_special_savings": str(total_special),
            "upcoming_repayments": [],  # will be done later
        })