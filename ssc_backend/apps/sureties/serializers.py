from rest_framework import serializers
from .models import SuretyRecord
from .services import check_surety_eligibility
from decimal import Decimal


# Used in LoanDetailPage (includes is_self_surety)
class SuretyRecordSerializer(serializers.ModelSerializer):
    surety_file_number = serializers.CharField(source="surety.file_number", read_only=True)
    surety_name        = serializers.CharField(source="surety.full_name", read_only=True)

    class Meta:
        model  = SuretyRecord
        fields = [
            "id", "loan", "surety", "surety_file_number", "surety_name",
            "layer", "is_self_surety", "amount_guaranteed", "current_liability",
            "status", "confirmed_at", "released_at", "created_at",
        ]
        read_only_fields = fields


# Used in MySureties view (borrower details)
class SuretyRecordWithBorrowerSerializer(serializers.ModelSerializer):
    borrower_name = serializers.CharField(source='loan.applicant.full_name', read_only=True)
    borrower_phone = serializers.CharField(source='loan.applicant.phone_primary', read_only=True)
    loan_amount = serializers.DecimalField(source='loan.amount_applied', max_digits=12, decimal_places=2, read_only=True)
    self_surety_amount = serializers.SerializerMethodField()
    repayment_monthly = serializers.DecimalField(source='loan.proposed_monthly_repayment', max_digits=12, decimal_places=2, read_only=True)
    repayment_duration = serializers.IntegerField(source='loan.proposed_duration_months', read_only=True)
    loan_purpose = serializers.CharField(source='loan.purpose', read_only=True)

    class Meta:
        model = SuretyRecord
        fields = [
            'id', 'loan', 'surety', 'amount_guaranteed', 'current_liability', 'status',
            'borrower_name', 'borrower_phone', 'loan_amount', 'self_surety_amount',
            'repayment_monthly', 'repayment_duration', 'loan_purpose'
        ]

    def get_self_surety_amount(self, obj):
        loan_amount = obj.loan.amount_approved or obj.loan.amount_applied
        return loan_amount * Decimal('0.75')
    

# Used for adding sureties (validation)
class AddSuretiesSerializer(serializers.Serializer):
    sureties = serializers.ListField(child=serializers.DictField())

    def validate_sureties(self, value):
        from apps.accounts.models import MemberProfile
        if len(value) > 5:
            raise serializers.ValidationError("Maximum 5 external sureties (SRS SR3).")
        for item in value:
            if "member_id" not in item or "amount" not in item:
                raise serializers.ValidationError("Each surety needs member_id and amount.")
            try:
                member = MemberProfile.objects.get(pk=item["member_id"])
            except MemberProfile.DoesNotExist:
                raise serializers.ValidationError(f"Member {item['member_id']} not found.")
            check = check_surety_eligibility(member, Decimal(str(item["amount"])))
            if not check["eligible"]:
                raise serializers.ValidationError(check["reasons"])
        return value