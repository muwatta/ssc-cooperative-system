from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from datetime import date
from django.db.models import Sum

from apps.loans.models import LoanApplication, LoanStatus
from apps.savings.models import MemberBalance
from apps.accounts.models import MemberProfile, MembershipStatus
from apps.savings.services import get_or_create_balance
from utils.hijri import gregorian_to_hijri, HIJRI_MONTH_NAMES, current_hijri


class CurrentDateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        today = date.today()
        h_day, h_month, h_year = gregorian_to_hijri(today)
        month_name = HIJRI_MONTH_NAMES.get(h_month, f"Month {h_month}")
        hijri_display = f"{h_day} {month_name} {h_year}"

        return Response({
            "hijri": {
                "day": h_day,
                "month": h_month,
                "year": h_year,
                "display": hijri_display,
            },
            "gregorian": today.isoformat(),
        })
        

class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        is_admin = user.role in ["admin", "committee", "head_of_school"]
        data = {}

        if is_admin:
            # Pending approvals
            data["pending_admin"] = LoanApplication.objects.filter(status=LoanStatus.PENDING_ADMIN).count()
            data["submitted"] = LoanApplication.objects.filter(status=LoanStatus.SUBMITTED).count()
            data["under_review"] = LoanApplication.objects.filter(status=LoanStatus.UNDER_REVIEW).count()
            data["pending_sureties"] = LoanApplication.objects.filter(status=LoanStatus.PENDING_SURETIES).count()

            # Active loans
            data["active_loans"] = LoanApplication.objects.filter(status=LoanStatus.ACTIVE).count()
            data["total_outstanding"] = str(
                LoanApplication.objects.filter(status=LoanStatus.ACTIVE).aggregate(
                    total=Sum("outstanding_balance")
                )["total"] or 0
            )

            # Total savings
            total_savings = MemberBalance.objects.aggregate(total=Sum("total_savings"))["total"] or 0
            data["total_savings"] = str(total_savings)

            # Upcoming repayments (loans with start month > current)
            h_month, h_year = current_hijri()
            active_loans = LoanApplication.objects.filter(status=LoanStatus.ACTIVE)
            upcoming = []
            for loan in active_loans:
                upcoming.append({"loan_id": loan.id, "applicant": loan.applicant.full_name, "amount": str(loan.proposed_monthly_repayment)})
            data["upcoming_repayments"] = upcoming

        # Common for all roles
        try:
            profile = request.user.member_profile
            balance = get_or_create_balance(profile)
            data["my_balance"] = str(balance.available_balance)
            data["my_total_savings"] = str(balance.total_savings)
            data["my_active_loans"] = LoanApplication.objects.filter(
                applicant=profile, status=LoanStatus.ACTIVE
            ).count()
        except Exception:
            data["my_balance"] = "0.00"
            data["my_total_savings"] = "0.00"
            data["my_active_loans"] = 0

        return Response(data)
    

class ResetDataView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != "admin":
            return Response({"error": "Only admin can reset data."}, status=403)

        from apps.loans.models import LoanApplication, LoanRepaymentLedger, LoanDraft
        from apps.sureties.models import SuretyRecord
        from apps.savings.models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle
        from apps.accounts.models import MemberProfile, StaffIDRegistry, User
        from apps.notifications.models import Notification

        # Delete all related data
        LoanRepaymentLedger.objects.all().delete()
        SuretyRecord.objects.all().delete()
        LoanDraft.objects.all().delete()
        LoanApplication.objects.all().delete()
        SavingsLedger.objects.all().delete()
        MemberBalance.objects.all().delete()
        SavingsChangeRequest.objects.all().delete()
        TermlyDuesCycle.objects.all().delete()

        # Delete all members except the admin’s own profile
        MemberProfile.objects.exclude(user__staff_id="S45-0001").delete()
        StaffIDRegistry.objects.exclude(staff_id="S45-0001").delete()
        User.objects.exclude(staff_id="S45-0001").delete()

        Notification.objects.all().delete()

        # Reset admin's own balances
        try:
            admin = MemberProfile.objects.get(file_number="A001")
            balance, _ = MemberBalance.objects.get_or_create(member=admin)
            balance.total_savings = 0
            balance.suretyship_committed = 0
            balance.special_savings = 0
            balance.save()
            admin.consecutive_savings_months = 0
            admin.save()
        except Exception:
            pass

        return Response({"message": "All data cleared. Only admin user remains."})