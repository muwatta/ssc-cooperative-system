import csv
from decimal import Decimal
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum
from apps.accounts.models import MemberProfile, MembershipStatus
from apps.accounts.permissions import IsAdmin
from apps.loans.models import LoanApplication, LoanStatus, LoanRepaymentLedger
from apps.savings.models import SavingsLedger, LedgerEntryType
from apps.savings.services import get_or_create_balance


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


class MonthlyDeductionsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hijri_month = request.query_params.get('hijri_month')
        hijri_year = request.query_params.get('hijri_year')
        if not hijri_month or not hijri_year:
            return HttpResponse("Missing parameters", status=400)
        try:
            hijri_month = int(hijri_month)
            hijri_year = int(hijri_year)
        except ValueError:
            return HttpResponse("Invalid parameters", status=400)

        members = MemberProfile.objects.filter(membership_status='active').order_by('full_name')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="monthly_report_{hijri_month}_{hijri_year}.csv"'
        writer = csv.writer(response)
        writer.writerow(['Name', 'Section', 'SSC Ordinary Savings', 'SSC Loan', 'SSC Special Savings'])

        total_ordinary = Decimal('0.00')
        total_loan = Decimal('0.00')
        total_special = Decimal('0.00')

        for member in members:
            ordinary = member.approved_monthly_contribution or Decimal('0.00')
            loan_repayment = LoanRepaymentLedger.objects.filter(
                loan__applicant=member,
                hijri_month=hijri_month,
                hijri_year=hijri_year
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            special = SavingsLedger.objects.filter(
                member=member,
                hijri_month=hijri_month,
                hijri_year=hijri_year,
                entry_type=LedgerEntryType.SPECIAL_SAVINGS
            ).aggregate(total=Sum('credit'))['total'] or Decimal('0.00')

            writer.writerow([
                member.full_name,
                member.school_branch,
                f"{ordinary:.2f}",
                f"{loan_repayment:.2f}",
                f"{special:.2f}",
            ])
            total_ordinary += ordinary
            total_loan += loan_repayment
            total_special += special

        writer.writerow([])
        writer.writerow(['TOTAL', '', f"{total_ordinary:.2f}", f"{total_loan:.2f}", f"{total_special:.2f}"])
        return response