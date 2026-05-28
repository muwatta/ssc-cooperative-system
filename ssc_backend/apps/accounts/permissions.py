
from rest_framework.permissions import BasePermission
from .models import Role


class IsAdmin(BasePermission):
    """Full system control. SRS Row 1 in permissions matrix."""
    message = "Only Admin can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.ADMIN
        )


class IsCommittee(BasePermission):
    """Loan review, approval, repayment posting."""
    message = "Only Committee members can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.COMMITTEE
        )


class IsHeadOfSchool(BasePermission):
    """Final loan approval only."""
    message = "Only the Head of School can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.HEAD_OF_SCHOOL
        )


class IsAdminOrCommittee(BasePermission):
    """
    Used for actions both Admin and Committee can perform:
    loan review, repayment posting, profit distribution, report export.
    SRS Section 3.1 permissions matrix.
    """
    message = "Only Admin or Committee members can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.COMMITTEE)
        )


class IsAdminOrCommitteeOrHOS(BasePermission):
    """
    View all accounts and print reports:
    Admin, Committee, and Head of School.
    """
    message = "Insufficient permissions to view this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.COMMITTEE, Role.HEAD_OF_SCHOOL)
        )


class IsProfileOwnerOrAdmin(BasePermission):
    """
    Allows profile updates by the owner or by Admin.
    """
    message = "Only the profile owner or Admin can update this profile."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.role == Role.ADMIN:
            return True
        return getattr(obj, 'user', None) == request.user


class CanPostSavings(BasePermission):
    """
    SRS Rule S3: Savings are posted by Admin ONLY.
    No exceptions.
    """
    message = "Only Admin can post savings entries."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.ADMIN
        )


class CanApproveLoan(BasePermission):
    """
    SRS Rule L10 (first stage): Committee + Admin can review/approve loans.
    SRS Rule L9: Admin cannot approve their OWN loan — enforced at object level.
    """
    message = "Only Admin or Committee can approve loans."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.COMMITTEE)
        )

    def has_object_permission(self, request, view, obj):
        """
        SRS Rule L9: Admin cannot approve their own loan application.
        obj here is a LoanApplication instance.
        """
        if request.user.role == Role.ADMIN:
            # Check if this loan belongs to the admin trying to approve it
            loan_applicant_user = getattr(obj.applicant, "user", None)
            if loan_applicant_user and loan_applicant_user.pk == request.user.pk:
                self.message = "Admin cannot approve their own loan application."
                return False
        return True


class CanGiveFinalLoanApproval(BasePermission):
    """
    SRS Rule L10 (final stage): Head of School only.
    Read-only on all other records.
    """
    message = "Only the Head of School can give final loan approval."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.HEAD_OF_SCHOOL
        )


class IsOwnerOrAdminOrCommittee(BasePermission):
    """
    Staff can only see their own records.
    Admin and Committee can see all.
    SRS Section 3: "Staff cannot see any other member's data in any form."
    """
    message = "You do not have permission to access this record."

    def has_object_permission(self, request, view, obj):
        if request.user.role in (Role.ADMIN, Role.COMMITTEE, Role.HEAD_OF_SCHOOL):
            return True
        # For Staff: obj must belong to them
        # obj can be MemberProfile, SavingsLedger, LoanApplication etc.
        # Each has a path back to the user — try common patterns.
        if hasattr(obj, "user"):
            return obj.user == request.user
        if hasattr(obj, "member"):
            return obj.member.user == request.user
        if hasattr(obj, "applicant"):
            return obj.applicant.user == request.user
        return False
