from rest_framework import serializers
from django.utils import timezone
from decimal import Decimal
from .models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle
from utils.hijri import hijri_month_display, HIJRI_MONTHS


class SavingsLedgerSerializer(serializers.ModelSerializer):
    member_file_number = serializers.CharField(source="member.file_number", read_only=True)
    member_name        = serializers.CharField(source="member.full_name", read_only=True)

    class Meta:
        model  = SavingsLedger
        fields = [
            "id", "member", "member_file_number", "member_name",
            "hijri_month", "hijri_year", "hijri_display", "gregorian_date",
            "entry_type", "details", "debit", "credit", "balance",
            "verified_by_name", "verified_by_role", "created_at",
        ]
        read_only_fields = fields


class MemberBalanceSerializer(serializers.ModelSerializer):
    available_balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    reserved_for_investment = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    file_number = serializers.CharField(source="member.file_number", read_only=True)
    full_name   = serializers.CharField(source="member.full_name", read_only=True)

    class Meta:
        model = MemberBalance
        fields = [
            "member", "file_number", "full_name",
            "total_savings", "suretyship_committed", "special_savings",
            "available_balance", "reserved_for_investment", "updated_at",  # added here
        ]
        read_only_fields = fields

class PostSavingsSerializer(serializers.Serializer):
    member      = serializers.IntegerField(required=False, help_text="MemberProfile pk")
    member_ids  = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="List of MemberProfile pks for bulk savings posting.",
    )
    amount      = serializers.DecimalField(max_digits=12, decimal_places=2)
    hijri_month = serializers.IntegerField(min_value=1, max_value=12)
    hijri_year  = serializers.IntegerField(min_value=1400)

    def validate_amount(self, value):
        if value < Decimal("1000.00"):
            raise serializers.ValidationError("Minimum savings contribution is ₦1,000 (SRS Rule S1).")
        return value

    def validate(self, attrs):
        from apps.accounts.models import MemberProfile, MembershipStatus

        selected_member = attrs.get("member")
        selected_member_ids = attrs.get("member_ids", []) or []

        if not selected_member and not selected_member_ids:
            raise serializers.ValidationError(
                "Please provide a member or one or more member IDs for bulk savings posting."
            )

        members = []
        if selected_member:
            try:
                member = MemberProfile.objects.get(pk=selected_member)
            except MemberProfile.DoesNotExist:
                raise serializers.ValidationError({"member": "Member not found."})
            if member.membership_status != MembershipStatus.ACTIVE:
                raise serializers.ValidationError({"member": "Member is not active."})
            members.append(member)

        for member_id in set(selected_member_ids):
            if selected_member and member_id == selected_member:
                continue
            try:
                member = MemberProfile.objects.get(pk=member_id)
            except MemberProfile.DoesNotExist:
                raise serializers.ValidationError({"member_ids": f"Member {member_id} not found."})
            if member.membership_status != MembershipStatus.ACTIVE:
                raise serializers.ValidationError({"member_ids": f"Member {member_id} is not active."})
            members.append(member)

        if not members:
            raise serializers.ValidationError(
                "No valid members were selected for savings posting."
            )

        attrs["_members"] = members
        return attrs


class SavingsChangeRequestSerializer(serializers.ModelSerializer):
    member_file_number = serializers.CharField(source="member.file_number", read_only=True)
    member_name        = serializers.CharField(source="member.full_name", read_only=True)
    member_user_id     = serializers.IntegerField(source="member.user.id", read_only=True)
    effective_hijri_display = serializers.CharField(read_only=True)

    class Meta:
        model = SavingsChangeRequest
        fields = [
            "id", "member", "member_file_number", "member_name", "member_user_id",
            "current_amount", "requested_amount",
            "savings_balance_at_request", "loan_balance_at_request",
            "effective_hijri_month", "effective_hijri_year", "effective_hijri_display",
            "status", "approved_by_name", "submitted_at", "approved_at",
        ]
        read_only_fields = [
            "id", "member", "member_file_number", "member_name", "member_user_id",
            "current_amount", "savings_balance_at_request", "loan_balance_at_request",
            "status", "approved_by_name", "submitted_at", "approved_at",
            "effective_hijri_display",
        ]

    def validate_requested_amount(self, value):
        if value < Decimal("1000.00"):
            raise serializers.ValidationError("Minimum contribution is ₦1,000.")
        return value


class ApproveSavingsChangeSerializer(serializers.Serializer):
    effective_hijri_month = serializers.IntegerField(min_value=1, max_value=12)
    effective_hijri_year  = serializers.IntegerField(min_value=1400)


class TermlyDuesCycleSerializer(serializers.ModelSerializer):
    posted_by_name = serializers.CharField(source="posted_by.staff_id", read_only=True)
    target_member_count = serializers.SerializerMethodField()

    class Meta:
        model  = TermlyDuesCycle
        fields = [
            "id", "name", "amount", "description",
            "hijri_month", "hijri_year", "hijri_display",
            "posted_by_name", "is_posted", "posted_at",
            "target_member_count", "created_at",
        ]
        read_only_fields = ["id", "posted_by_name", "is_posted", "posted_at", "created_at"]

    def get_target_member_count(self, obj):
        count = obj.target_members.count()
        return count if count > 0 else "All active members"


class CreateDuesCycleSerializer(serializers.Serializer):
    name        = serializers.CharField(max_length=100)
    amount      = serializers.DecimalField(max_digits=12, decimal_places=2)
    description = serializers.CharField(max_length=255, allow_blank=True, default="")
    hijri_month = serializers.IntegerField(min_value=1, max_value=12)
    hijri_year  = serializers.IntegerField(min_value=1400)
    member_ids  = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True, default=list,
        help_text="Empty list = all active members"
    )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value