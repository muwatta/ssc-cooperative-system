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
from .services import import_legacy_members
from .email_service import send_bulk_invitations
# Authentication views (login/logout, password setup)

class SSCTokenObtainPairView(TokenObtainPairView):
    serializer_class = SSCTokenObtainPairSerializer


class LogoutView(APIView):
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
    queryset = StaffIDRegistry.objects.all().order_by("staff_id")
    serializer_class = StaffIDRegistrySerializer
    permission_classes = [IsAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["staff_id"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class StaffIDRegistryDetailView(generics.RetrieveUpdateDestroyAPIView):
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
    serializer_class = CreateUserSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        serializer.save()



# MEMBER MANAGEMENT — Admin only


class MemberListCreateView(generics.ListCreateAPIView):
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


class LegacyImportView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        csv_file = request.FILES.get('file')
        dry_run = request.data.get('dry_run') in ("true", "1", True)
        download_errors = request.data.get('download_errors') in ("true", "1", True)
        send_invitations = request.data.get('send_invitations') in ("true", "1", True)
        frontend_url = request.data.get('frontend_url') or None
        staff_id_template = request.data.get('staff_id_template') or "S{seq:04d}"
        create_registry = request.data.get('create_registry') in ("true", "1", True)
        field_map = None
        import json
        if request.data.get('field_map'):
            try:
                field_map = json.loads(request.data.get('field_map'))
            except Exception:
                return Response({"error": "Invalid field_map JSON."}, status=status.HTTP_400_BAD_REQUEST)

        start_seq = request.data.get('start_seq')
        try:
            start_seq = int(start_seq) if start_seq is not None else 9000
        except (TypeError, ValueError):
            return Response({"error": "Invalid start_seq value."}, status=status.HTTP_400_BAD_REQUEST)

        if not csv_file:
            return Response({"error": "CSV file is required (field name: file)."}, status=status.HTTP_400_BAD_REQUEST)

        # Streaming the uploaded file into the service
        summary = import_legacy_members(
            csv_file,
            dry_run=dry_run,
            field_map=field_map,
            staff_id_template=staff_id_template,
            create_staff_id_registry=create_registry,
            start_seq=start_seq,
            send_invitations=send_invitations,
            frontend_url=frontend_url,
        )

        # If requested and there are errors, return CSV attachment
        if download_errors and summary.get('errors'):
            import io, csv
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(['row', 'error'])
            for e in summary['errors']:
                writer.writerow([e.get('row'), e.get('error')])
            resp = Response(buf.getvalue(), content_type='text/csv')
            resp['Content-Disposition'] = 'attachment; filename="import-errors.csv"'
            return resp

        return Response(summary)


class SendInvitationsView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        user_ids = request.data.get('user_ids', [])
        frontend_url = request.data.get('frontend_url')
        if not isinstance(user_ids, list) or not user_ids:
            return Response(
                {"error": "user_ids is required and must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = send_bulk_invitations(user_ids, frontend_url=frontend_url)
        return Response(summary)



class ChangeMemberRoleView(APIView):
    
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            profile = MemberProfile.objects.select_related("user").get(pk=pk)
        except MemberProfile.DoesNotExist:
            return Response(
                {"error": "Member not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Cannot change own role
        if profile.user == request.user:
            return Response(
                {"error": "You cannot change your own role."},
                status=status.HTTP_403_FORBIDDEN
            )

        new_role = request.data.get("role", "").strip()
        valid_roles = ("staff", "committee", "head_of_school", "admin")

        if new_role not in valid_roles:
            return Response(
                {"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_role = profile.user.role
        profile.user.role = new_role
        profile.user.save(update_fields=["role", "updated_at"])

        return Response({
            "message": f"{profile.full_name} role changed from {old_role} to {new_role}.",
            "file_number": profile.file_number,
            "full_name": profile.full_name,
            "old_role": old_role,
            "new_role": new_role,
        })
