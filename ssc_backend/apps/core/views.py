from decimal import Decimal
from django.core.cache import cache
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model

User = get_user_model()

class ResetDataView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if request.user.role != "admin":
            return Response({"error": "Only admin can reset data."}, status=403)

        # 1. admin user to keep
        admin_user = User.objects.filter(staff_id="S45-0001").first()
        if not admin_user:
            return Response({"error": "Admin user (S45-0001) not found. Aborting."}, status=400)

        errors = []

        # 2. Delete all dependent data (order matters to avoid FK violations)
        from apps.loans.models import LoanRepaymentLedger, LoanDraft, LoanApplication
        from apps.sureties.models import SuretyRecord
        from apps.savings.models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle
        from apps.notifications.models import Notification
        from apps.accounts.models import MemberProfile, StaffIDRegistry

        # Define deletion order: child first, parent last
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
                # Delete everything except the admin's profile/registry
                if model == MemberProfile:
                    model.objects.exclude(user=admin_user).delete()
                elif model == StaffIDRegistry:
                    model.objects.exclude(staff_id="S45-0001").delete()
                else:
                    model.objects.all().delete()
            except Exception as e:
                errors.append(f"Failed to clear {model.__name__}: {e}")

        # 3. Delete all users except admin (using ORM)
        try:
            User.objects.exclude(pk=admin_user.pk).delete()
        except Exception as e:
            errors.append(f"Failed to delete non-admin users: {e}")

        # 4. Reset admin's own profile and balances
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

        # 5. Clear cache
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