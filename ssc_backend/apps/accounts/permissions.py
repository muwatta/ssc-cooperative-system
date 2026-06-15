from rest_framework.permissions import BasePermission
from .models import Role


class IsAdmin(BasePermission):
    message = "Only Admin can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.ADMIN
        )


class IsCommittee(BasePermission):
    message = "Only Committee members can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.COMMITTEE
        )


class IsHeadOfSchool(BasePermission):
    message = "Only the Head of School can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.HEAD_OF_SCHOOL
        )


class IsAdminOrCommittee(BasePermission):
    
    message = "Only Admin or Committee members can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.COMMITTEE)
        )


class IsAdminOrCommitteeOrHOS(BasePermission):
    
    message = "Insufficient permissions to view this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.COMMITTEE, Role.HEAD_OF_SCHOOL)
        )


class IsProfileOwnerOrAdmin(BasePermission):
   
    message = "Only the profile owner or Admin can update this profile."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.role == Role.ADMIN:
            return True
        return getattr(obj, 'user', None) == request.user


class CanPostSavings(BasePermission):
  
    message = "Only Admin can post savings entries."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.ADMIN
        )


class CanApproveLoan(BasePermission):
   
    message = "Only Admin or Committee can approve loans."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.COMMITTEE)
        )

    def has_object_permission(self, request, view, obj):
        
        if request.user.role == Role.ADMIN:
            # Check if this loan belongs to the admin trying to approve it
            loan_applicant_user = getattr(obj.applicant, "user", None)
            if loan_applicant_user and loan_applicant_user.pk == request.user.pk:
                self.message = "Admin cannot approve their own loan application."
                return False
        return True


class CanGiveFinalLoanApproval(BasePermission):
   
    message = "Only the Head of School can give final loan approval."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.HEAD_OF_SCHOOL
        )


class IsOwnerOrAdminOrCommittee(BasePermission):

    message = "You do not have permission to access this record."

    def has_object_permission(self, request, view, obj):
        if request.user.role in (Role.ADMIN, Role.COMMITTEE, Role.HEAD_OF_SCHOOL):
            return True
        if hasattr(obj, "user"):
            return obj.user == request.user
        if hasattr(obj, "member"):
            return obj.member.user == request.user
        if hasattr(obj, "applicant"):
            return obj.applicant.user == request.user
        return False
