"""SSC Cooperative — Sureties Serializers"""

from rest_framework import serializers
from .models import SuretyRecord
from .services import check_surety_eligibility
from decimal import Decimal


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
