
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.core.validators import RegexValidator


#────────────────
# CONSTANTS
#────────────────

class Role(models.TextChoices):
    ADMIN = "admin", "Admin"
    COMMITTEE = "committee", "Committee"
    HEAD_OF_SCHOOL = "head_of_school", "Head of School"
    STAFF = "staff", "Staff"


class MaritalStatus(models.TextChoices):
    SINGLE = "single", "Single"
    MARRIED = "married", "Married"
    DIVORCED = "divorced", "Divorced"
    WIDOWED = "widowed", "Widowed"


class Gender(models.TextChoices):
    MALE = "male", "Male"
    FEMALE = "female", "Female"


class MembershipStatus(models.TextChoices):
    PENDING = "pending", "Pending Approval"
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    EXITED = "exited", "Exited Employment"


class SchoolBranch(models.TextChoices):
    PRIMARY = "primary", "Primary"
    COLLEGE = "college", "College"
    OTHER = "other", "Other"


staff_id_validator = RegexValidator(
    regex=r"^S\d{2}-\d{4}$",
    message="Staff ID must follow format S{YY}-{NNNN} e.g. S43-0094"
)


class StaffIDRegistry(models.Model):
    """
    Pre-loaded by Admin. Only Staff IDs in this table can register.
    YY = Islamic year the staff member joined the school.
    """
    staff_id = models.CharField(
        max_length=10,
        unique=True,
        validators=[staff_id_validator],
        help_text="Format: S{YY}-{NNNN} e.g. S43-0094"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive IDs cannot be used to register or login"
    )
    created_by = models.ForeignKey(
        "User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="registered_staff_ids"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ssc_staff_id_registry"
        verbose_name = "Staff ID Registry"
        verbose_name_plural = "Staff ID Registry"
        ordering = ["staff_id"]

    def __str__(self):
        return f"{self.staff_id} ({'Active' if self.is_active else 'Inactive'})"


#────────────────
# CUSTOM USER MANAGER
#────────────────

class UserManager(BaseUserManager):

    def create_user(self, staff_id, password=None, **extra_fields):
        if not staff_id:
            raise ValueError("Staff ID is required")
        extra_fields.setdefault("role", Role.STAFF)
        user = self.model(staff_id=staff_id, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, staff_id, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(staff_id, password, **extra_fields)


#────────────────
# CUSTOM USER MODEL
# Login identity = Staff ID.
# Cooperative identity = SSC File Number (on MemberProfile).
#────────────────

class User(AbstractBaseUser, PermissionsMixin):
   
    staff_id = models.CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r'^S\d{2}-\d{4}$', 'Format must be SYY-NNNN, e.g. S43-0094')]
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STAFF,
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)   # Django admin access
    is_first_login = models.BooleanField(
        default=True,
        help_text="Forces password creation on first access"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "staff_id"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "ssc_users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.staff_id} ({self.role})"

    # ── Role helpers — use these everywhere instead of raw string checks ──

    @property
    def is_admin(self):
        return self.role == Role.ADMIN

    @property
    def is_committee(self):
        return self.role == Role.COMMITTEE

    @property
    def is_head_of_school(self):
        return self.role == Role.HEAD_OF_SCHOOL

    @property
    def is_regular_staff(self):
        return self.role == Role.STAFF

    @property
    def can_post_savings(self):
        """Only Admin can post savings (SRS S3)"""
        return self.role == Role.ADMIN

    @property
    def can_approve_loan(self):
        """Committee and Admin can review/approve loans (SRS Section 3)"""
        return self.role in (Role.ADMIN, Role.COMMITTEE)

    @property
    def can_give_final_loan_approval(self):
        """Only Head of School gives final sign-off (SRS L10)"""
        return self.role == Role.HEAD_OF_SCHOOL

    @property
    def ssc_file_number(self):
        """Convenience accessor — returns file number or None if profile not created yet"""
        try:
            return self.member_profile.file_number
        except MemberProfile.DoesNotExist:
            return None



def generate_file_number():
    """
    Returns the next SSC file number.
    Finds the highest existing number and increments by 1.
    Thread-safe: wrapped in select_for_update in the view layer.
    """
    from django.db.models import Max
    result = MemberProfile.objects.aggregate(max_num=Max("_file_sequence"))
    last_num = result["max_num"] or 0
    next_num = last_num + 1
    return f"A{next_num:03d}", next_num


# member profile

class MemberProfile(models.Model):
    """
    Complete member record — mirrors the physical SSC Membership Form exactly.
    SRS Section 2.4 fields all accounted for.
    """

    # ── Identity──
    user = models.OneToOneField(
        User,
        on_delete=models.PROTECT,       # never accidentally delete a member
        related_name="member_profile"
    )
    file_number = models.CharField(
        max_length=10,
        unique=True,
        help_text="SSC File Number e.g. A048. Auto-generated or imported for legacy."
    )
    _file_sequence = models.PositiveIntegerField(
        unique=True,
        help_text="Internal integer for sequential generation. Do not edit."
    )

    # ── Personal
    full_name = models.CharField(max_length=255)
    phone_primary = models.CharField(max_length=20)
    phone_secondary = models.CharField(max_length=20, blank=True, default="")
    marital_status = models.CharField(max_length=10, choices=MaritalStatus.choices)
    gender = models.CharField(max_length=10, choices=Gender.choices)
    date_of_birth = models.DateField()
    place_of_birth = models.CharField(max_length=255)

    # ── School Details (SRS 2.4 — School Details section) ──────────
    school_branch = models.CharField(max_length=20, choices=SchoolBranch.choices)
    designation = models.CharField(max_length=255)
    date_joined_school = models.DateField()

    # ── Financial (SRS 2.4 — Financial section) ────────────────────
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2)
    approved_monthly_contribution = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Set by Admin after Chairman approves Savings Change Form"
    )

    # ── Contact (SRS 2.4 — Contact section) ────────────────────────
    residential_address = models.TextField()
    permanent_home_address = models.TextField()
    email_address = models.EmailField(blank=True, default="")
    social_media_handle = models.CharField(max_length=100, blank=True, default="")

    # ── Origin (SRS 2.4 — Origin section) ──────────────────────────
    state_of_origin = models.CharField(max_length=100)
    local_government_area = models.CharField(max_length=100)

    # ── Next of Kin (SRS 2.4 — Next of Kin section) ────────────────
    next_of_kin_name = models.CharField(max_length=255)
    next_of_kin_address = models.TextField()
    next_of_kin_phone = models.CharField(max_length=20)
    next_of_kin_relationship = models.CharField(max_length=100)
    next_of_kin_place_of_work = models.CharField(max_length=255, blank=True, default="")

    # ── Membership Status ───────────────────────────────────────────
    membership_status = models.CharField(
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.PENDING
    )
    is_legacy = models.BooleanField(
        default=False,
        help_text="True if imported via legacy CSV — file number preserved as-is"
    )

    # ── Official Approval fields (SRS 2.4 — Official section) ──────
    approved_by_name = models.CharField(max_length=255, blank=True, default="")
    officer_in_charge = models.CharField(max_length=255, blank=True, default="")
    approval_date = models.DateField(null=True, blank=True)

    # ── Consecutive savings tracker (SRS M1, M2, S5) ───────────────
    consecutive_savings_months = models.PositiveIntegerField(
        default=0,
        help_text="Resets to 0 when a month is missed. 6 required for loan/surety eligibility."
    )

    # ── Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ssc_member_profiles"
        verbose_name = "Member Profile"
        verbose_name_plural = "Member Profiles"
        ordering = ["file_number"]

    def __str__(self):
        return f"{self.file_number} — {self.full_name}"


    @property
    def is_loan_eligible(self):
        """
        SRS Section 5.1 — All 4 conditions must pass.
        Actual check also queries savings and loans — done in the view/serializer layer.
        This property covers only what's on the profile itself.
        """
        return (
            self.membership_status == MembershipStatus.ACTIVE
            and self.consecutive_savings_months >= 6
        )

    @property
    def is_surety_eligible(self):
        """SRS Section 6.2 — same tenure requirement as loan eligibility"""
        return self.is_loan_eligible
