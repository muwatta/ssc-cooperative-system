"""SSC Cooperative — Loans Serializers"""

from rest_framework import serializers
from decimal import Decimal
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus, LoanConfiguration, LoanDraft
from .services import calculate_max_borrowable, check_loan_eligibility, get_loan_configuration
from apps.sureties.serializers import SuretyRecordSerializer
from apps.accounts.models import MemberProfile 



class LoanApplicationSerializer(serializers.ModelSerializer):
    sureties = SuretyRecordSerializer(many=True, read_only=True)
    applicant_file_number = serializers.CharField(source="applicant.file_number", read_only=True)
    applicant_name        = serializers.CharField(source="applicant.full_name", read_only=True)

    class Meta:
        model  = LoanApplication
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
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "applicant", "applicant_file_number", "applicant_name", "sureties",
            "school_branch", "designation", "date_joined_cooperative",
            "monthly_contribution", "total_amount_saved",
            "status", "amount_approved", "outstanding_balance",
            "application_hijri_month", "application_hijri_year", "application_hijri_display",
            "created_at", "updated_at",
        ]


class SubmitLoanSerializer(serializers.Serializer):
    amount_applied             = serializers.DecimalField(max_digits=12, decimal_places=2)
    purpose                    = serializers.CharField()
    monthly_salary             = serializers.DecimalField(max_digits=12, decimal_places=2)
    home_address               = serializers.CharField()
    phone_numbers              = serializers.CharField(max_length=100)
    proposed_monthly_repayment = serializers.DecimalField(max_digits=12, decimal_places=2)
    proposed_duration_months   = serializers.IntegerField(min_value=1, max_value=12)
    date_of_last_loan          = serializers.DateField(required=False, allow_null=True)
    amount_outstanding_prev    = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    repayment_start_hijri_month = serializers.IntegerField(min_value=1, max_value=12, required=False, default=1)
    repayment_start_hijri_year  = serializers.IntegerField(min_value=1400, required=False, default=1446)
    
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
        # MemberProfile is now imported at the top of the file
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

        seen = set()
        errors = []
        for item in value:
            member_id = item.get("member_id")
            amount = item.get("amount")
            if member_id is None or amount is None:
                raise serializers.ValidationError("Each surety must include member_id and amount.")

            try:
                member = MemberProfile.objects.get(pk=member_id)
            except MemberProfile.DoesNotExist:
                raise serializers.ValidationError(f"Surety member {member_id} not found.")

            if member.pk == profile.pk:
                raise serializers.ValidationError("Cannot add yourself as an external surety.")

            if member.pk in seen:
                raise serializers.ValidationError("Duplicate surety selected.")
            seen.add(member.pk)

            try:
                amount_decimal = Decimal(str(amount))
            except Exception:
                raise serializers.ValidationError("Surety amount must be a valid number.")

            if amount_decimal <= Decimal("0.00"):
                raise serializers.ValidationError("Surety amount must be greater than zero.")

            eligibility = check_surety_eligibility(member, amount_decimal)
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

        # 2. Absolute borrowable cap
        max_amount = calculate_max_borrowable(profile)
        amount_applied = attrs["amount_applied"]
        if amount_applied > max_amount:
            raise serializers.ValidationError({
                "amount_applied": f"Maximum borrowable is ₦{max_amount}."
            })

        # 3. Repayment cross‑check (amount ÷ duration)
        duration = attrs["proposed_duration_months"]
        monthly = attrs["proposed_monthly_repayment"]
        expected = (amount_applied / duration).quantize(Decimal("0.01"))
        if abs(monthly - expected) > Decimal("0.02"):
            raise serializers.ValidationError({
                "proposed_monthly_repayment": (
                    f"Monthly repayment must be ₦{expected} (amount ÷ duration)."
                )
            })

        # 4. Surety gap logic
        config = get_loan_configuration()
        from apps.savings.services import get_or_create_balance
        balance = get_or_create_balance(profile)
        self_surety_max = (balance.available_balance * config.self_surety_ratio).quantize(Decimal("0.01"))

        if amount_applied > self_surety_max:
            sureties = attrs.get("sureties", [])
            if not sureties:
                raise serializers.ValidationError({
                    "sureties": f"External sureties required for amount above ₦{self_surety_max}."
                })
            total_external = sum(Decimal(str(s["amount"])) for s in sureties)
            shortfall = amount_applied - self_surety_max
            if total_external < shortfall:
                raise serializers.ValidationError({
                    "sureties": (
                        f"Total surety guarantees (₦{total_external}) must cover "
                        f"the gap of ₦{shortfall}."
                    )
                })
        else:
            # If amount is within self-surety max, sureties should be empty or omitted
            sureties = attrs.get("sureties", [])
            if sureties and len(sureties) > 0:
                raise serializers.ValidationError({
                    "sureties": "External sureties are not required for this amount."
                })
            # Ensure sureties is always an empty list if not needed
            attrs["sureties"] = []

        return attrs


class CommitteeDecisionSerializer(serializers.Serializer):
    decision       = serializers.ChoiceField(choices=["approve", "reject"])
    amount_approved = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    note           = serializers.CharField(allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["decision"] == "approve" and not attrs.get("amount_approved"):
            raise serializers.ValidationError({"amount_approved": "Required when approving."})
        return attrs


class AdminFinalApprovalSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True, default="")


class AdminFinalApprovalSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True, default="")


class PostRepaymentSerializer(serializers.Serializer):
    amount      = serializers.DecimalField(max_digits=12, decimal_places=2)
    hijri_month = serializers.IntegerField(min_value=1, max_value=12)
    hijri_year  = serializers.IntegerField(min_value=1400)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value


class LoanRepaymentLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = LoanRepaymentLedger
        fields = [
            "id", "loan", "hijri_month", "hijri_year", "hijri_display",
            "amount", "balance_before", "balance_after",
            "verified_by_name", "verified_by_role", "created_at",
        ]
        read_only_fields = fields


class LoanEligibilitySerializer(serializers.Serializer):
    eligible                   = serializers.BooleanField()
    reasons                    = serializers.ListField(child=serializers.CharField())
    is_new_member              = serializers.BooleanField()
    max_borrowable             = serializers.DecimalField(max_digits=14, decimal_places=2)
    consecutive_months         = serializers.IntegerField()
    required_consecutive_months = serializers.IntegerField()
    max_repayment_months      = serializers.IntegerField()
    loan_amount_ratio          = serializers.DecimalField(max_digits=4, decimal_places=2)
    max_sureties               = serializers.IntegerField()
    min_loan_amount            = serializers.DecimalField(max_digits=12, decimal_places=2)
    max_loan_amount            = serializers.DecimalField(max_digits=14, decimal_places=2)
    require_no_active_loan     = serializers.BooleanField()
    require_no_surety_liabilities = serializers.BooleanField()
    self_surety_max = serializers.DecimalField(max_digits=14, decimal_places=2)


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
        ]

from .models import LoanApplication, LoanRepaymentLedger, LoanStatus, LoanConfiguration, LoanDraft

class LoanDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanDraft
        fields = ["id", "data", "updated_at"]
        read_only_fields = ["id", "updated_at"]