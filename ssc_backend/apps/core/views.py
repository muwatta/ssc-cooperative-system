from decimal import Decimal

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

            # After total_savings = ... line, add:
            total_special_savings = MemberBalance.objects.aggregate(
                total=Sum("special_savings")
            )["total"] or Decimal("0.00")
            data["total_special_savings"] = str(total_special_savings)

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

        from django.db import connection

        errors = []

        # 1. Delete child tables normally (no foreign keys to audit here)
        from apps.loans.models import LoanRepaymentLedger, LoanDraft, LoanApplication
        from apps.sureties.models import SuretyRecord
        from apps.savings.models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle
        from apps.notifications.models import Notification

        for model in [
            LoanRepaymentLedger, SuretyRecord, LoanDraft, LoanApplication,
            SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle,
            Notification,
        ]:
            try:
                model.objects.all().delete()
            except Exception as e:
                errors.append(f"Failed to clear {model.__name__}: {e}")

        # 2. Delete members (raw SQL to avoid audit table) and staff IDs
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM ssc_member_profiles WHERE user_id != (SELECT id FROM ssc_users WHERE staff_id = %s)",
                    ["S45-0001"]
                )
        except Exception as e:
            errors.append(f"Failed to delete member profiles: {e}")

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM ssc_staff_id_registry WHERE staff_id != %s",
                    ["S45-0001"]
                )
        except Exception as e:
            errors.append(f"Failed to delete staff IDs: {e}")

        # 3. Delete users (raw SQL to bypass protected FK)
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM ssc_users WHERE staff_id != %s",
                    ["S45-0001"]
                )
        except Exception as e:
            errors.append(f"Failed to delete users: {e}")

        # 4. Reset admin's balances
        try:
            from apps.accounts.models import MemberProfile
            admin = MemberProfile.objects.get(file_number="A001")
            balance, _ = MemberBalance.objects.get_or_create(member=admin)
            balance.total_savings = 0
            balance.suretyship_committed = 0
            balance.special_savings = 0
            balance.save()
            admin.consecutive_savings_months = 0
            admin.save()
        except Exception as e:
            errors.append(f"Failed to reset admin: {e}")

        return Response({
            "message": "All data cleared. Only admin remains." if not errors else "Reset completed with errors.",
            "errors": errors if errors else None,
        })