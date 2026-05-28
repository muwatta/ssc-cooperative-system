from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend

from .models import User, StaffIDRegistry, MemberProfile
from .serializers import (
    SSCTokenObtainPairSerializer,
    StaffIDRegistrySerializer,
    CreateUserSerializer,
    MemberProfileSerializer,
    MemberProfileSummarySerializer,
    CreateMemberSerializer,
    SetInitialPasswordSerializer,
)
from .permissions import (
    IsAdmin,
    IsAdminOrCommittee,
    IsAdminOrCommitteeOrHOS,
    IsProfileOwnerOrAdmin,
)
from apps.audit.utils import log_action, get_client_ip
# Authentication views (login/logout, password setup)

class SSCTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Login with Staff ID + password.
    Returns access token, refresh token, and SSC user data.
    """
    serializer_class = SSCTokenObtainPairSerializer


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklists the refresh token so it can't be reused.
    Body: { "refresh": "<refresh_token>" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"message": "Successfully logged out."},
                status=status.HTTP_200_OK
            )
        except TokenError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class SetInitialPasswordView(APIView):
    """
    POST /api/v1/accounts/set-password/
    Called on first login. No auth required (user has no password yet).
    Body: { "staff_id": "S43-0094", "password": "...", "password_confirm": "..." }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SetInitialPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"message": f"Password set successfully for {user.staff_id}. You may now login."},
            status=status.HTTP_200_OK
        )



# STAFF ID REGISTRY — Admin only


class StaffIDRegistryListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/accounts/staff-ids/     — List all registered Staff IDs
    POST /api/v1/accounts/staff-ids/     — Add a new Staff ID to registry
    Admin only.
    """
    queryset = StaffIDRegistry.objects.all().order_by("staff_id")
    serializer_class = StaffIDRegistrySerializer
    permission_classes = [IsAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["staff_id"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class StaffIDRegistryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/accounts/staff-ids/<id>/   — Retrieve
    PATCH  /api/v1/accounts/staff-ids/<id>/   — Update (e.g. deactivate)
    DELETE /api/v1/accounts/staff-ids/<id>/   — Remove from registry
    Admin only.
    """
    queryset = StaffIDRegistry.objects.all()
    serializer_class = StaffIDRegistrySerializer
    permission_classes = [IsAdmin]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # If a user account exists for this ID, deactivate instead of delete
        if User.objects.filter(staff_id=instance.staff_id).exists():
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            return Response(
                {"message": "Staff ID deactivated (account exists, cannot delete)."},
                status=status.HTTP_200_OK
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)



# ADMIN: Create User (Admin only)


class CreateUserView(generics.CreateAPIView):
    """
    POST /api/v1/accounts/users/
    Admin creates a user (staff/committee/admin). Requires Staff ID already in registry.
    Body: { "staff_id": "S43-0002", "role": "staff", "password": "Temp@2026!", "is_first_login": false }
    """
    serializer_class = CreateUserSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        serializer.save()



# MEMBER MANAGEMENT — Admin only


class MemberListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/accounts/members/   — List members (Admin/Committee/HOS)
    POST /api/v1/accounts/members/   — Create member (Admin only)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["membership_status", "school_branch"]
    search_fields = ["file_number", "full_name", "user__staff_id"]
    ordering_fields = ["file_number", "full_name", "created_at"]
    ordering = ["file_number"]

    def get_queryset(self):
        return MemberProfile.objects.select_related("user").all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateMemberSerializer
        return MemberProfileSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdmin()]
        return [IsAdminOrCommitteeOrHOS()]

    def create(self, request, *args, **kwargs):
        serializer = CreateMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        response_serializer = MemberProfileSerializer(profile)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class MemberDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/v1/accounts/members/<id>/   — Get member detail
    PATCH /api/v1/accounts/members/<id>/   — Update member (Admin only)

    Staff can only access their own record (enforced in get_queryset).
    """
    serializer_class = MemberProfileSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "committee", "head_of_school"):
            return MemberProfile.objects.select_related("user").all()
        # Staff: only their own profile
        return MemberProfile.objects.filter(user=user)

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsProfileOwnerOrAdmin()]
        return [IsAuthenticated()]


class MemberSummaryListView(generics.ListAPIView):
    """
    GET /api/v1/accounts/members/summary/
    Lightweight list for dropdowns — surety search, loan form fields.
    Active members only.
    """
    serializer_class = MemberProfileSummarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["file_number", "full_name"]

    def get_queryset(self):
        # Do not select_related('user') here — only a lightweight member
        # summary is required for dropdowns. Using select_related together
        # with `only()` can cause Django to attempt to traverse a deferred
        # field which raises a FieldError. Keep this queryset simple.
        return MemberProfile.objects.filter(
            membership_status="active"
        ).only(
            "id", "file_number", "full_name", "school_branch",
            "designation", "membership_status"
        )


class MyProfileView(APIView):
    """
    GET /api/v1/accounts/me/
    POST /api/v1/accounts/me/  - create the current user's profile if missing.
    PATCH /api/v1/accounts/me/ - update the current user's own profile.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self):
        try:
            return MemberProfile.objects.select_related("user").get(
                user=self.request.user
            )
        except MemberProfile.DoesNotExist:
            return None

    def get(self, request):
        profile = self.get_object()
        if profile is None:
            return Response(None)

        serializer = MemberProfileSerializer(profile)
        return Response(serializer.data)

    def post(self, request):
        if self.get_object() is not None:
            return Response(
                {"detail": "A profile already exists for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MemberProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()

        # Log the action
        log_action(
            user=request.user,
            action="profile_create",
            description=f"Created member profile",
            object_type="MemberProfile",
            object_id=profile.id,
            object_name=profile.full_name,
            new_values={"file_number": profile.file_number, "full_name": profile.full_name},
            request_ip=get_client_ip(request),
        )

        return Response(MemberProfileSerializer(profile).data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        profile = self.get_object()
        if profile is None:
            return Response(
                {"detail": "Profile not found. Create a profile first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MemberProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(MemberProfileSerializer(profile).data)


class ApproveMemberView(APIView):
    """
    POST /api/v1/accounts/members/<id>/approve/
    Admin approves a pending membership application.
    Sets status to Active and records approval details.
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            profile = MemberProfile.objects.get(pk=pk, membership_status="pending")
        except MemberProfile.DoesNotExist:
            return Response(
                {"error": "Member not found or not in pending status."},
                status=status.HTTP_404_NOT_FOUND
            )

        approved_by = request.data.get("approved_by_name", "")
        officer = request.data.get("officer_in_charge", "")
        approval_date = request.data.get("approval_date")
        approved_contribution = request.data.get("approved_monthly_contribution")

        if not all([approved_by, officer, approval_date, approved_contribution]):
            return Response(
                {"error": "approved_by_name, officer_in_charge, approval_date, and approved_monthly_contribution are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile.membership_status = "active"
        profile.approved_by_name = approved_by
        profile.officer_in_charge = officer
        profile.approval_date = approval_date
        profile.approved_monthly_contribution = approved_contribution
        profile.save(update_fields=[
            "membership_status", "approved_by_name", "officer_in_charge",
            "approval_date", "approved_monthly_contribution", "updated_at"
        ])

        return Response(
            MemberProfileSerializer(profile).data,
            status=status.HTTP_200_OK
        )


class DeactivateMemberView(APIView):
    """
    POST /api/v1/accounts/members/<id>/deactivate/
    Admin deactivates a member account.
    Also deactivates their User login.
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            profile = MemberProfile.objects.select_related("user").get(pk=pk)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            profile.membership_status = "inactive"
            profile.save(update_fields=["membership_status", "updated_at"])
            profile.user.is_active = False
            profile.user.save(update_fields=["is_active"])

        return Response({"message": f"{profile.file_number} deactivated."}, status=status.HTTP_200_OK)
