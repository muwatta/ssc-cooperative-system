from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from decimal import Decimal
from apps.accounts.models import MemberProfile, MembershipStatus
from apps.accounts.permissions import IsAdmin
from apps.savings.services import get_or_create_balance
from apps.loans.models import LoanApplication, LoanStatus


class FinancialSnapshotView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        members = MemberProfile.objects.filter(membership_status=MembershipStatus.ACTIVE).order_by('file_number')
        data = []

        for member in members:
            balance = get_or_create_balance(member)
            outstanding = LoanApplication.objects.filter(
                applicant=member,
                status=LoanStatus.ACTIVE
            ).aggregate(total=Sum('outstanding_balance'))['total'] or Decimal('0.00')

            data.append({
                'file_number': member.file_number,
                'full_name': member.full_name,
                'total_savings': str(balance.total_savings),
                'available_balance': str(balance.available_balance),
                'outstanding_loan': str(outstanding),
                'special_savings': str(balance.special_savings or Decimal('0.00')),
            })

        return Response(data)