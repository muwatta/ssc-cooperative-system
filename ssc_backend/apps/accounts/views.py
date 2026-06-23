from .models import Role
from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.contrib.auth import update_session_auth_hash, get_user_model
from django.contrib.auth.tokens import default_token_generator
from rest_framework import status
from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone        


from rest_framework.views import APIView

from rest_framework.throttling import UserRateThrottle

from .throttles import LoginRateThrottle, InviteRateThrottle, ImportRateThrottle, PasswordChangeRateThrottle

from django.http import JsonResponse
from rest_framework.permissions import AllowAny
from django.contrib.auth.hashers import make_password

from .models import MembershipStatus, User, StaffIDRegistry, MemberProfile
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
from .tasks import send_bulk_invitations_async
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings

User = get_user_model()

def invalidate_dashboard_cache():
    cache.delete("dashboard_summary_admin_stats")


class SSCTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]
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

        # Log the action with IP
        log_action(
            user=user,
            action="SET_INITIAL_PASSWORD",
            description=f"User set initial password",
            object_type="User",
            object_id=user.id,
            object_name=user.staff_id,
            request_ip=get_client_ip(request),
        )

        return Response(
            {"message": f"Password set successfully for {user.staff_id}. You may now login."},
            status=status.HTTP_200_OK
        )


# STAFF ID REGISTRY — Admin only
class StaffIDRegistryListCreateView(generics.ListCreateAPIView):
    throttle_classes = [UserRateThrottle]  
    queryset = StaffIDRegistry.objects.all().order_by("staff_id")
    serializer_class = StaffIDRegistrySerializer
    permission_classes = [IsAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["staff_id"]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_action(
            user=self.request.user,
            action="CREATE_STAFF_ID",
            description=f"Created Staff ID {instance.staff_id}",
            object_type="StaffIDRegistry",
            object_id=instance.id,
            object_name=instance.staff_id,
            request_ip=get_client_ip(self.request),
        )


class StaffIDRegistryDetailView(generics.RetrieveUpdateDestroyAPIView):
    throttle_classes = [UserRateThrottle]  
    queryset = StaffIDRegistry.objects.all()
    serializer_class = StaffIDRegistrySerializer
    permission_classes = [IsAdmin]

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(
            user=self.request.user,
            action="UPDATE_STAFF_ID",
            description=f"Updated Staff ID {instance.staff_id}",
            object_type="StaffIDRegistry",
            object_id=instance.id,
            object_name=instance.staff_id,
            request_ip=get_client_ip(self.request),
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if User.objects.filter(staff_id=instance.staff_id).exists():
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            log_action(
                user=request.user,
                action="DEACTIVATE_STAFF_ID",
                description=f"Deactivated Staff ID {instance.staff_id} (account exists)",
                object_type="StaffIDRegistry",
                object_id=instance.id,
                object_name=instance.staff_id,
                request_ip=get_client_ip(request),
            )
            return Response(
                {"message": "Staff ID deactivated (account exists, cannot delete)."},
                status=status.HTTP_200_OK
            )
        instance.delete()
        log_action(
            user=request.user,
            action="DELETE_STAFF_ID",
            description=f"Deleted Staff ID {instance.staff_id}",
            object_type="StaffIDRegistry",
            object_id=instance.id,
            object_name=instance.staff_id,
            request_ip=get_client_ip(request),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ADMIN: Create User (Admin only)
class CreateUserView(generics.CreateAPIView):
    serializer_class = CreateUserSerializer
    permission_classes = [IsAdmin]
    throttle_classes = [InviteRateThrottle]
    
    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()


class MemberListCreateView(generics.ListCreateAPIView):
    throttle_classes = [UserRateThrottle] 
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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = CreateMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        response_serializer = MemberProfileSerializer(profile)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class MemberDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = MemberProfileSerializer
    permission_classes = [IsAuthenticated, IsProfileOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "committee", "head_of_school"):
            return MemberProfile.objects.select_related("user").all()
        return MemberProfile.objects.filter(user=user).select_related('user')


class MemberSummaryListView(generics.ListAPIView):
    throttle_classes = [UserRateThrottle] 
    serializer_class = MemberProfileSummarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["file_number", "full_name"]

    def get_queryset(self):
        return MemberProfile.objects.filter(
            membership_status="active"
        ).only(
            "id", "file_number", "full_name", "school_branch",
            "designation", "membership_status", "is_new_member"
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

    @transaction.atomic
    def post(self, request):
        if self.get_object() is not None:
            return Response(
                {"detail": "A profile already exists for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MemberProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()

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

    @transaction.atomic
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

    @transaction.atomic
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

        log_action(
            user=request.user,
            action="APPROVE_MEMBER",
            description=f"Approved member {profile.file_number} ({profile.full_name})",
            object_type="MemberProfile",
            object_id=profile.id,
            object_name=profile.full_name,
            request_ip=get_client_ip(request),
        )
        invalidate_dashboard_cache()

        return Response(
            MemberProfileSerializer(profile).data,
            status=status.HTTP_200_OK
        )


class DeactivateMemberView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
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

        log_action(
            user=request.user,
            action="DEACTIVATE_MEMBER",
            description=f"Deactivated member {profile.file_number} ({profile.full_name})",
            object_type="MemberProfile",
            object_id=profile.id,
            object_name=profile.full_name,
            request_ip=get_client_ip(request),
        )
        invalidate_dashboard_cache()
        return Response({"message": f"{profile.file_number} deactivated."}, status=status.HTTP_200_OK)


class LegacyImportView(APIView):
    permission_classes = [IsAdmin]
    throttle_classes = [ImportRateThrottle]

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

        MAX_FILE_SIZE = 5 * 1024 * 1024
        if csv_file.size > MAX_FILE_SIZE:
            return Response({"error": "File too large (max 5MB)."}, status=status.HTTP_400_BAD_REQUEST)

        summary = import_legacy_members(
            csv_file,
            dry_run=dry_run,
            field_map=field_map,
            staff_id_template=staff_id_template,
            create_staff_id_registry=create_registry,
            start_seq=start_seq,
            send_invitations=send_invitations,
            frontend_url=frontend_url,
            sanitize_cells=True,
        )

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

        log_action(
            user=request.user,
            action="LEGACY_IMPORT",
            description=f"Imported members from CSV (dry_run={dry_run})",
            object_type="BulkImport",
            object_id=0,
            object_name="Legacy Import",
            new_values={"file": csv_file.name, "dry_run": dry_run, "summary": summary},
            request_ip=get_client_ip(request),
        )

        invalidate_dashboard_cache()
        return Response(summary)


class SendInvitationsView(APIView):
    permission_classes = [IsAdmin]
    throttle_classes = [InviteRateThrottle]

    def post(self, request):
        user_ids = request.data.get('user_ids', [])
        frontend_url = request.data.get('frontend_url')
        if not isinstance(user_ids, list) or not user_ids:
            return Response(
                {"error": "user_ids is required and must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Use async task
        send_bulk_invitations_async.delay(user_ids, frontend_url)

        log_action(
            user=request.user,
            action="SEND_INVITATIONS",
            description=f"Queued invitations to users: {user_ids}",
            object_type="Invitation",
            object_id=0,
            object_name="Bulk Invitation",
            new_values={"user_ids": user_ids},
            request_ip=get_client_ip(request),
        )

        return Response({"message": "Invitations are being sent in the background."})


class ChangeMemberRoleView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, pk):
        try:
            profile = MemberProfile.objects.select_related("user").get(pk=pk)
        except MemberProfile.DoesNotExist:
            return Response(
                {"error": "Member not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if profile.user == request.user:
            return Response(
                {"error": "You cannot change your own role."},
                status=status.HTTP_403_FORBIDDEN
            )

        new_role = request.data.get("role", "").strip()
        # using Role.values from model (TextChoices)
        if new_role not in Role.values:
            return Response(
                {"error": f"Invalid role. Must be one of: {', '.join(Role.values)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_role = profile.user.role
        profile.user.role = new_role
        profile.user.save(update_fields=["role", "updated_at"])

        log_action(
            user=request.user,
            action="CHANGE_ROLE",
            description=f"Changed role of {profile.full_name} from {old_role} to {new_role}",
            object_type="User",
            object_id=profile.user.id,
            object_name=profile.full_name,
            request_ip=get_client_ip(request),
        )
        invalidate_dashboard_cache()

        return Response({
            "message": f"{profile.full_name} role changed from {old_role} to {new_role}.",
            "file_number": profile.file_number,
            "full_name": profile.full_name,
            "old_role": old_role,
            "new_role": new_role,
        })


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PasswordChangeRateThrottle]

    def post(self, request):
        user = request.user
        current = request.data.get("current_password")
        new = request.data.get("new_password")
        confirm = request.data.get("confirm_password")

        if not user.check_password(current):
            return Response({"error": "Current password is incorrect."}, status=400)

        if new != confirm:
            return Response({"error": "New passwords do not match."}, status=400)

        try:
            validate_password(new, user)
        except ValidationError as e:
            return Response({"error": e.messages}, status=400)

        user.set_password(new)
        user.save()
        update_session_auth_hash(request, user)

        log_action(
            user=request.user,
            action="CHANGE_PASSWORD",
            description="User changed password",
            object_type="User",
            object_id=user.id,
            object_name=user.get_full_name() or user.staff_id,
            request_ip=get_client_ip(request),
        )

        return Response({"message": "Password changed successfully."})


class ToggleSpecialSaverView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, member_id):
        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=404)

        member.is_special_saver = not member.is_special_saver
        member.save(update_fields=["is_special_saver", "updated_at"])

        log_action(
            user=request.user,
            action="TOGGLE_SPECIAL_SAVER",
            description=f"Toggled special saver status for {member.full_name} to {member.is_special_saver}",
            object_type="MemberProfile",
            object_id=member.id,
            object_name=member.full_name,
            request_ip=get_client_ip(request),
        )
        invalidate_dashboard_cache()
        return Response({
            "member_id": member.id,
            "file_number": member.file_number,
            "is_special_saver": member.is_special_saver,
        })


from django.db.models import Count, Q

class MemberCountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = MemberProfile.objects.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(membership_status=MembershipStatus.ACTIVE)),
            pending=Count("id", filter=Q(membership_status=MembershipStatus.PENDING)),
            inactive=Count("id", filter=Q(membership_status=MembershipStatus.INACTIVE)),
            exited=Count("id", filter=Q(membership_status=MembershipStatus.EXITED)),
        )
        return Response({
            "total": stats["total"],
            "active": stats["active"],
            "pending": stats["pending"],
            "inactive": stats["inactive"],
            "exited": stats["exited"],
        })
    

class PasswordResetRequestView(APIView):
    permission_classes = []

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email required'}, status=400)

        try:
            profile = MemberProfile.objects.get(email_address=email)
            user = profile.user
        except MemberProfile.DoesNotExist:
            # Security: don't reveal if email exists
            return Response({'message': 'If an account exists, a reset link has been sent.'}, status=200)

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

        # Render the banking-style HTML email template
        html_message = render_to_string('emails/password_reset.html', {
            'reset_link': reset_link,
            'email': email,
            'year': timezone.now().year,
            'title': 'Reset Your SSC Cooperative Password'
        })

        # Send the email with HTML content
        send_mail(
            subject='Reset Your SSC Cooperative Password',
            message=f'Click the link to reset your password: {reset_link}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        
        return Response({'message': 'Password reset link sent to your email.'}, status=200)


class PasswordResetConfirmView(APIView):
    permission_classes = []

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        if not all([uid, token, new_password]):
            return Response({'error': 'uid, token, and new_password required'}, status=400)

        try:
            uid_decoded = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=uid_decoded)
        except (TypeError, ValueError, User.DoesNotExist):
            user = None

        if user and default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Password reset successful.'}, status=200)
        else:
            return Response({'error': 'Invalid or expired reset link.'}, status=400)