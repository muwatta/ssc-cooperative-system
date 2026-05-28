from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.db import transaction
from .models import User, StaffIDRegistry, MemberProfile, Role, generate_file_number


class SSCTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "staff_id"

    def validate(self, attrs):
        # Staff ID is the username field
        staff_id = attrs.get("staff_id") or attrs.get(self.username_field)

        if not StaffIDRegistry.objects.filter(staff_id=staff_id, is_active=True).exists():
            raise serializers.ValidationError(
                {"staff_id": "This Staff ID is not recognised or has been deactivated."}
            )

        data = super().validate(attrs)
        user = self.user

        data["role"] = user.role
        data["staff_id"] = user.staff_id
        data["is_first_login"] = user.is_first_login

        try:
            profile = user.member_profile
            data["file_number"] = profile.file_number
            data["full_name"] = profile.full_name
        except MemberProfile.DoesNotExist:
            data["file_number"] = None
            data["full_name"] = None

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Claims embedded IN the JWT itself
        token["role"] = user.role
        token["staff_id"] = user.staff_id
        try:
            token["file_number"] = user.member_profile.file_number
        except MemberProfile.DoesNotExist:
            token["file_number"] = None
        return token


# STAFF ID REGISTRY

class StaffIDRegistrySerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffIDRegistry
        fields = ["id", "staff_id", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


# FIRST LOGIN — Password Setup

class SetInitialPasswordSerializer(serializers.Serializer):
    staff_id = serializers.CharField()
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def save(self):
        staff_id = self.validated_data["staff_id"]
        password = self.validated_data["password"]
        try:
            user = User.objects.get(staff_id=staff_id, is_first_login=True)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {"staff_id": "No pending first-login account found for this Staff ID."}
            )
        user.set_password(password)
        user.is_first_login = False
        user.save(update_fields=["password", "is_first_login", "updated_at"])
        return user


# ADMIN: Create User (Admin UI)

class CreateUserSerializer(serializers.Serializer):
    staff_id = serializers.CharField()
    role = serializers.ChoiceField(choices=Role.choices, default=Role.STAFF)
    password = serializers.CharField(min_length=8, write_only=True)
    is_first_login = serializers.BooleanField(default=False)

    def validate_staff_id(self, value):
        if not StaffIDRegistry.objects.filter(staff_id=value, is_active=True).exists():
            raise serializers.ValidationError("This Staff ID is not registered or has been deactivated.")
        if User.objects.filter(staff_id=value).exists():
            raise serializers.ValidationError("A user account already exists for this Staff ID.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        staff_id = validated_data["staff_id"]
        password = validated_data["password"]
        role = validated_data.get("role", Role.STAFF)
        is_first_login = validated_data.get("is_first_login", False)

        user = User.objects.create_user(staff_id=staff_id, password=password)
        user.role = role
        user.is_first_login = is_first_login
        if role == Role.ADMIN:
            user.is_staff = True
            user.is_superuser = True
        user.save()
        return user


# MEMBER PROFILE

class MemberProfileSerializer(serializers.ModelSerializer):
    
    staff_id = serializers.CharField(source="user.staff_id", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    is_loan_eligible = serializers.BooleanField(read_only=True)
    is_surety_eligible = serializers.BooleanField(read_only=True)

    class Meta:
        model = MemberProfile
        fields = [
            "id",
            "file_number",
            "staff_id",
            "role",
            # Personal
            "full_name",
            "phone_primary",
            "phone_secondary",
            "marital_status",
            "gender",
            "date_of_birth",
            "place_of_birth",
            # School
            "school_branch",
            "designation",
            "date_joined_school",
            # Financial
            "monthly_income",
            "approved_monthly_contribution",
            # Contact
            "residential_address",
            "permanent_home_address",
            "email_address",
            "social_media_handle",
            # Origin
            "state_of_origin",
            "local_government_area",
            # Next of kin
            "next_of_kin_name",
            "next_of_kin_address",
            "next_of_kin_phone",
            "next_of_kin_relationship",
            "next_of_kin_place_of_work",
            # Status
            "membership_status",
            "is_legacy",
            "approved_by_name",
            "officer_in_charge",
            "approval_date",
            "consecutive_savings_months",
            # Computed
            "is_loan_eligible",
            "is_surety_eligible",
            # Timestamps
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "file_number",
            "staff_id",
            "role",
            "consecutive_savings_months",
            "is_loan_eligible",
            "is_surety_eligible",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        if request is None or request.user.is_anonymous:
            raise serializers.ValidationError("Authentication is required to create a profile.")

        file_number, file_sequence = generate_file_number()
        return MemberProfile.objects.create(
            user=request.user,
            file_number=file_number,
            _file_sequence=file_sequence,
            **validated_data,
        )


class MemberProfileSummarySerializer(serializers.ModelSerializer):
    staff_id = serializers.CharField(source="user.staff_id", read_only=True)

    class Meta:
        model = MemberProfile
        fields = [
            "id",
            "file_number",
            "staff_id",
            "full_name",
            "school_branch",
            "designation",
            "membership_status",
        ]

class CreateMemberSerializer(serializers.Serializer):
    staff_id = serializers.CharField()
    role = serializers.ChoiceField(choices=Role.choices, default=Role.STAFF)

    full_name = serializers.CharField(max_length=255)
    phone_primary = serializers.CharField(max_length=20)
    phone_secondary = serializers.CharField(max_length=20, allow_blank=True, default="")
    marital_status = serializers.ChoiceField(choices=[
        ("single", "Single"), ("married", "Married"),
        ("divorced", "Divorced"), ("widowed", "Widowed")
    ])
    gender = serializers.ChoiceField(choices=[("male", "Male"), ("female", "Female")])
    date_of_birth = serializers.DateField()
    place_of_birth = serializers.CharField(max_length=255)
    school_branch = serializers.ChoiceField(choices=[
        ("primary", "Primary"), ("college", "College"), ("other", "Other")
    ])
    designation = serializers.CharField(max_length=255)
    date_joined_school = serializers.DateField()
    monthly_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    proposed_monthly_contribution = serializers.DecimalField(max_digits=12, decimal_places=2)
    residential_address = serializers.CharField()
    permanent_home_address = serializers.CharField()
    email_address = serializers.EmailField(allow_blank=True, default="")
    social_media_handle = serializers.CharField(max_length=100, allow_blank=True, default="")
    state_of_origin = serializers.CharField(max_length=100)
    local_government_area = serializers.CharField(max_length=100)
    next_of_kin_name = serializers.CharField(max_length=255)
    next_of_kin_address = serializers.CharField()
    next_of_kin_phone = serializers.CharField(max_length=20)
    next_of_kin_relationship = serializers.CharField(max_length=100)
    next_of_kin_place_of_work = serializers.CharField(max_length=255, allow_blank=True, default="")

    # Legacy import flag
    is_legacy = serializers.BooleanField(default=False)
    legacy_file_number = serializers.CharField(
        max_length=10,
        allow_blank=True,
        default="",
        help_text="Only for legacy import. Leave blank for new members."
    )

    def validate_staff_id(self, value):
        # Must exist in registry
        if not StaffIDRegistry.objects.filter(staff_id=value, is_active=True).exists():
            raise serializers.ValidationError(
                "This Staff ID is not in the registry or has been deactivated."
            )

        if User.objects.filter(staff_id=value).exists():
            raise serializers.ValidationError(
                "An account already exists for this Staff ID."
            )
        return value

    def validate(self, attrs):
        if attrs.get("is_legacy") and not attrs.get("legacy_file_number"):
            raise serializers.ValidationError(
                {"legacy_file_number": "Legacy file number is required for legacy imports."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        staff_id = validated_data.pop("staff_id")
        role = validated_data.pop("role")
        is_legacy = validated_data.pop("is_legacy", False)
        legacy_file_number = validated_data.pop("legacy_file_number", "")
        proposed_contribution = validated_data.pop("proposed_monthly_contribution")

        user = User.objects.create_user(
            staff_id=staff_id,
            role=role,
            password=None,
        )
        user.is_first_login = True
        user.save(update_fields=["is_first_login"])

        # Determine file number
        if is_legacy and legacy_file_number:
            file_number = legacy_file_number
            seq_str = legacy_file_number.lstrip("A").lstrip("0") or "0"
            file_sequence = int(seq_str)
        else:
            file_number, file_sequence = generate_file_number()

        # Create MemberProfile
        profile = MemberProfile.objects.create(
            user=user,
            file_number=file_number,
            _file_sequence=file_sequence,
            approved_monthly_contribution=proposed_contribution,
            is_legacy=is_legacy,
            **validated_data,
        )

        return profile
