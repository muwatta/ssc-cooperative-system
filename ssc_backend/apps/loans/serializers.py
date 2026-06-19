from rest_framework import serializers
from decimal import Decimal
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus, LoanConfiguration, LoanDraft
from .services import check_loan_eligibility, get_loan_configuration
from apps.sureties.serializers import SuretyRecordSerializer
from apps.accounts.models import MemberProfile


class LoanApplicationSerializer(serializers.ModelSerializer):
    sureties = SuretyRecordSerializer(many=True, read_only=True)
    applicant_file_number = serializers.CharField(source="applicant.file_number", read_only=True)
    applicant_name = serializers.CharField(source="applicant.full_name", read_only=True)
    repayments_count = serializers.SerializerMethodField()
    remaining_months = serializers.SerializerMethodField()

    class Meta:
        model = LoanApplication
        fields = [
            "id", "applicant", "applicant_file_number", "applicant_name", "sureties",
            "home_address", "phone_numbers", "school_branch", "designation",
            "date_joined_cooperative", "monthly_contribution", "total_amount_saved", "monthly_salary",
            "date_of_last_loan", "amount_outstanding_prev",
            "amount_applied", "purpose",
            "proposed_monthly_repayment", "proposed_duration_months",
            "repayment_start_hijri_month", "repayment_start_hijri_year",
            "repayment_end_hijri_month", "repayment_end_hijri_year",
            "status", "amount_approved", "outstanding_balance",
            "committee_decision_note", "admin_final_approval_note",
            "application_hijri_month", "application_hijri_year", "application_hijri_display",
            "created_at", "updated_at", "repayments_count", "remaining_months",
        ]
        read_only_fields = [
            "id", "applicant", "applicant_file_number", "applicant_name", "sureties",
            "school_branch", "designation", "date_joined_cooperative",
            "monthly_contribution", "total_amount_saved",
            "status", "amount_approved", "outstanding_balance",
            "application_hijri_month", "application_hijri_year", "application_hijri_display",
            "created_at", "updated_at",
        ]

    def get_repayments_count(self, obj):
        return obj.repayments.count()

    def get_remaining_months(self, obj):
        total = obj.proposed_duration_months
        paid = obj.repayments.count()
        remaining = total - paid
        return max(0, remaining)


class SubmitLoanSerializer(serializers.Serializer):
    amount_applied = serializers.DecimalField(max_digits=12, decimal_places=2)
    purpose = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    monthly_salary = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    home_address = serializers.CharField()
    phone_numbers = serializers.CharField(max_length=100)
    proposed_monthly_repayment = serializers.DecimalField(max_digits=12, decimal_places=2)
    proposed_duration_months = serializers.IntegerField(min_value=1, max_value=12)
    date_of_last_loan = serializers.DateField(required=False, allow_null=True)
    amount_outstanding_prev = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # repayment_start fields removed

    class SuretyItemSerializer(serializers.Serializer):
        member_id = serializers.IntegerField()
        amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))

    sureties = serializers.ListSerializer(
        child=SuretyItemSerializer(),
        required=False,
        default=[],
        max_length=5,
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_amount_applied(self, value):
        config = get_loan_configuration()
        if value < config.min_loan_amount:
            raise serializers.ValidationError(
                f"Loan amount must be at least ₦{config.min_loan_amount}."
            )
        if config.max_loan_amount > Decimal("0.00") and value > config.max_loan_amount:
            raise serializers.ValidationError(
                f"Loan amount cannot exceed ₦{config.max_loan_amount}."
            )
        return value

    def validate_proposed_monthly_repayment(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Monthly repayment must be greater than zero.")
        return value

    def validate_proposed_duration_months(self, value):
        config = get_loan_configuration()
        if value > config.max_repayment_months:
            raise serializers.ValidationError(
                f"Repayment duration cannot exceed {config.max_repayment_months} months."
            )
        return value

    def validate_sureties(self, value):
        from apps.sureties.services import check_surety_eligibility

        request = self.context.get("request")
        if not request:
            raise serializers.ValidationError("Request context required.")

        try:
            profile = request.user.member_profile
        except MemberProfile.DoesNotExist:
            raise serializers.ValidationError("No member profile found.")

        config = get_loan_configuration()
        if len(value) > config.max_sureties:
            raise serializers.ValidationError(
                f"Maximum {config.max_sureties} external sureties allowed."
            )

        # Prevent duplicate sureties
        seen = set()
        for item in value:
            member_id = item.get("member_id")
            if member_id in seen:
                raise serializers.ValidationError("Duplicate surety selected.")
            seen.add(member_id)

        # Batch fetch to avoid N+1 queries
        member_ids = [item["member_id"] for item in value]
        members = {
            m.pk: m for m in MemberProfile.objects.filter(pk__in=member_ids)
        }

        errors = []
        for item in value:
            member_id = item["member_id"]
            amount = item["amount"]

            member = members.get(member_id)
            if not member:
                raise serializers.ValidationError(f"Surety member {member_id} not found.")

            if member.pk == profile.pk:
                raise serializers.ValidationError("Cannot add yourself as an external surety.")

            eligibility = check_surety_eligibility(member, amount)
            if not eligibility["eligible"]:
                errors.extend([f"{member.file_number}: {reason}" for reason in eligibility["reasons"]])

        if errors:
            raise serializers.ValidationError(errors)

        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if not request:
            raise serializers.ValidationError("Request context required.")

        try:
            profile = request.user.member_profile
        except MemberProfile.DoesNotExist:
            raise serializers.ValidationError("No member profile found.")

        # 1. Basic eligibility
        eligibility = check_loan_eligibility(profile)
        if not eligibility["eligible"]:
            raise serializers.ValidationError({"eligibility": eligibility["reasons"]})

        amount_applied = attrs["amount_applied"]

        # 2. Repayment cross‑check (amount ÷ duration)
        duration = attrs["proposed_duration_months"]
        monthly = attrs["proposed_monthly_repayment"]
        expected = (amount_applied / duration).quantize(Decimal("0.01"))
        if abs(monthly - expected) > Decimal("0.02"):
            raise serializers.ValidationError({
                "proposed_monthly_repayment": (
                    f"Monthly repayment must be ₦{expected} (amount ÷ duration)."
                )
            })

        # 3. Surety gap logic (75% self‑surety + external sureties)
        config = get_loan_configuration()
        from apps.savings.services import get_or_create_balance
        balance = get_or_create_balance(profile)
        self_surety_max = (balance.total_savings * config.self_surety_ratio).quantize(Decimal("0.01"))

        sureties = attrs.get("sureties", [])

        if amount_applied <= self_surety_max:
            # No external sureties required
            if sureties:
                raise serializers.ValidationError({
                    "sureties": "External sureties are not required for this amount."
                })
            attrs["sureties"] = []
        else:
            shortfall = (amount_applied - self_surety_max).quantize(Decimal("0.01"))

            if not sureties:
                raise serializers.ValidationError({
                    "sureties": f"External sureties required for amount above ₦{self_surety_max}. Shortfall: ₦{shortfall}."
                })

            total_external = sum(Decimal(str(s["amount"])) for s in sureties)

            # ✅ Cap: total external guarantee cannot exceed the shortfall
            if total_external > shortfall:
                raise serializers.ValidationError({
                    "sureties": (
                        f"Total external guarantee (₦{total_external}) exceeds the required "
                        f"shortfall of ₦{shortfall}. Maximum allowed: ₦{shortfall}."
                    )
                })

            if total_external < shortfall:
                raise serializers.ValidationError({
                    "sureties": (
                        f"Total external guarantee (₦{total_external}) is less than the required "
                        f"shortfall of ₦{shortfall}. Please add more surety coverage."
                    )
                })

        return attrs


class CommitteeDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "reject"])
    amount_approved = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    note = serializers.CharField(allow_blank=True, default="")

    def validate_amount_approved(self, value):
        if value <= 0:
            raise serializers.ValidationError("Approved amount must be positive.")
        return value

    def validate(self, attrs):
        if attrs["decision"] == "approve" and not attrs.get("amount_approved"):
            raise serializers.ValidationError({"amount_approved": "Required when approving."})
        return attrs


class AdminFinalApprovalSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True, default="")


class PostRepaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    hijri_month = serializers.IntegerField(min_value=1, max_value=12)
    hijri_year = serializers.IntegerField(min_value=1400)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def validate(self, attrs):
        loan = self.context.get("loan")
        if not loan:
            raise serializers.ValidationError("Loan object missing from context.")

        if attrs["amount"] > loan.outstanding_balance:
            raise serializers.ValidationError(
                "Repayment amount cannot exceed the outstanding balance."
            )
        return attrs


class LoanRepaymentLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanRepaymentLedger
        fields = [
            "id", "loan", "hijri_month", "hijri_year", "hijri_display",
            "amount", "balance_before", "balance_after",
            "verified_by_name", "verified_by_role", "created_at",
        ]
        read_only_fields = fields


class LoanEligibilitySerializer(serializers.Serializer):
    eligible = serializers.BooleanField()
    reasons = serializers.ListField(child=serializers.CharField())
    is_new_member = serializers.BooleanField()
    max_borrowable = serializers.DecimalField(max_digits=14, decimal_places=2)
    consecutive_months = serializers.IntegerField()
    required_consecutive_months = serializers.IntegerField()
    max_repayment_months = serializers.IntegerField()
    loan_amount_ratio = serializers.DecimalField(max_digits=4, decimal_places=2)
    max_sureties = serializers.IntegerField()
    min_loan_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    max_loan_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    require_no_active_loan = serializers.BooleanField()
    require_no_surety_liabilities = serializers.BooleanField()
    self_surety_max = serializers.DecimalField(max_digits=14, decimal_places=2)

    # Financial grade additions (optional but helpful)
    current_available_balance = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    current_committed_surety = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)


class LoanSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanConfiguration
        fields = [
            "consecutive_savings_months_required",
            "max_loans_per_year",
            "max_repayment_months",
            "self_surety_ratio",
            "max_borrowable_ratio",
            "external_surety_max_ratio",
            "max_sureties",
            "min_loan_amount",
            "max_loan_amount",
            "require_no_active_loan",
            "require_no_surety_liabilities",
            "interest_rate",
            "max_active_loans",
            "min_savings_contribution",
            "default_termly_dues",
            "late_repayment_fee",
            "repayment_grace_days",
            "committee_can_view_totals",
            "hos_can_view_totals",
        ]
        
class LoanDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanDraft
        fields = ["id", "data", "updated_at"]
        read_only_fields = ["id", "updated_at"]