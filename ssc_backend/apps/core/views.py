from decimal import Decimal
from django.core.cache import cache
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
            cache_key = "dashboard_summary_admin_stats"
            cached_stats = cache.get(cache_key)

            if cached_stats:
                data.update(cached_stats)
            else:
                pending_admin = LoanApplication.objects.filter(status=LoanStatus.PENDING_ADMIN).count()
                submitted = LoanApplication.objects.filter(status=LoanStatus.SUBMITTED).count()
                under_review = LoanApplication.objects.filter(status=LoanStatus.UNDER_REVIEW).count()
                pending_sureties = LoanApplication.objects.filter(status=LoanStatus.PENDING_SURETIES).count()
                active_loans = LoanApplication.objects.filter(status=LoanStatus.ACTIVE).count()
                total_outstanding = LoanApplication.objects.filter(status=LoanStatus.ACTIVE).aggregate(
                    total=Sum("outstanding_balance")
                )["total"] or 0
                total_savings = MemberBalance.objects.aggregate(total=Sum("total_savings"))["total"] or 0
                total_special_savings = MemberBalance.objects.aggregate(
                    total=Sum("special_savings")
                )["total"] or Decimal("0.00")

                cached_stats = {
                    "pending_admin": pending_admin,
                    "submitted": submitted,
                    "under_review": under_review,
                    "pending_sureties": pending_sureties,
                    "active_loans": active_loans,
                    "total_outstanding": str(total_outstanding),
                    "total_savings": str(total_savings),
                    "total_special_savings": str(total_special_savings),
                }
                data.update(cached_stats)
                cache.set(cache_key, cached_stats, 300)

            h_month, h_year = current_hijri()
            active_loans_qs = LoanApplication.objects.filter(status=LoanStatus.ACTIVE).only('id', 'applicant__full_name', 'proposed_monthly_repayment')
            upcoming = [
                {
                    "loan_id": loan.id,
                    "applicant": loan.applicant.full_name,
                    "amount": str(loan.proposed_monthly_repayment)
                }
                for loan in active_loans_qs
            ]
            data["upcoming_repayments"] = upcoming

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

        from django.db import transaction
        from django.contrib.auth import get_user_model
        User = get_user_model()

        admin_user = User.objects.filter(staff_id="S45-0001").first()
        if not admin_user:
            return Response({"error": "Admin user (S45-0001) not found. Aborting."}, status=400)

        errors = []

        from apps.loans.models import LoanRepaymentLedger, LoanDraft, LoanApplication
        from apps.sureties.models import SuretyRecord
        from apps.savings.models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle
        from apps.notifications.models import Notification
        from apps.accounts.models import MemberProfile, StaffIDRegistry

        delete_order = [
            Notification,
            LoanRepaymentLedger,
            SuretyRecord,
            LoanDraft,
            LoanApplication,
            SavingsLedger,
            SavingsChangeRequest,
            TermlyDuesCycle,
            MemberBalance,
            MemberProfile,
            StaffIDRegistry,
        ]

        for model in delete_order:
            try:
                if model == MemberProfile:
                    model.objects.exclude(user=admin_user).delete()
                elif model == StaffIDRegistry:
                    model.objects.exclude(staff_id="S45-0001").delete()
                else:
                    model.objects.all().delete()
            except Exception as e:
                errors.append(f"Failed to clear {model.__name__}: {e}")

        try:
            User.objects.exclude(pk=admin_user.pk).delete()
        except Exception as e:
            errors.append(f"Failed to delete non-admin users: {e}")

        try:
            profile = admin_user.member_profile
            profile.consecutive_savings_months = 0
            profile.membership_status = "active"
            profile.save()
        except Exception as e:
            errors.append(f"Failed to reset admin profile: {e}")

        try:
            balance, _ = MemberBalance.objects.get_or_create(member=profile)
            balance.total_savings = Decimal('0.00')
            balance.available_balance = Decimal('0.00')
            balance.suretyship_committed = Decimal('0.00')
            balance.special_savings = Decimal('0.00')
            balance.save()
        except Exception as e:
            errors.append(f"Failed to reset admin balance: {e}")

        try:
            cache.clear()
        except Exception:
            pass

        if errors:
            return Response({
                "message": "Reset completed with errors.",
                "errors": errors,
            }, status=207)

        return Response({
            "message": "All data cleared. Only admin (S45-0001) remains.",
        })
