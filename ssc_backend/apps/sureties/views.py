"""SSC Cooperative — Sureties Views"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee
from .models import SuretyRecord, SuretyStatus
from .serializers import SuretyRecordSerializer, AddSuretiesSerializer
from .services import confirm_surety, decline_surety, create_surety_records, check_surety_eligibility
from decimal import Decimal


class LoanSuretiesView(generics.ListAPIView):
    """GET /api/v1/sureties/loan/<loan_id>/"""
    serializer_class   = SuretyRecordSerializer
    permission_classes = [IsAdminOrCommittee]

    def get_queryset(self):
        return SuretyRecord.objects.filter(loan_id=self.kwargs["loan_id"]).select_related("surety")


class MySuretiesView(generics.ListAPIView):
    """GET /api/v1/sureties/mine/ — own surety obligations"""
    serializer_class   = SuretyRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            profile = self.request.user.member_profile
            return SuretyRecord.objects.filter(surety=profile).select_related("loan__applicant")
        except Exception:
            return SuretyRecord.objects.none()


class ConfirmSuretyView(APIView):
    """POST /api/v1/sureties/<id>/confirm/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            record = SuretyRecord.objects.select_related("surety__user").get(pk=pk)
        except SuretyRecord.DoesNotExist:
            return Response({"error": "Surety record not found."}, status=status.HTTP_404_NOT_FOUND)

        # Only the surety themselves can confirm
        if record.surety.user != request.user:
            return Response({"error": "You can only confirm your own surety obligations."}, status=status.HTTP_403_FORBIDDEN)

        try:
            record = confirm_surety(record)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SuretyRecordSerializer(record).data)


class DeclineSuretyView(APIView):
    """POST /api/v1/sureties/<id>/decline/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            record = SuretyRecord.objects.select_related("surety__user").get(pk=pk)
        except SuretyRecord.DoesNotExist:
            return Response({"error": "Surety record not found."}, status=status.HTTP_404_NOT_FOUND)

        if record.surety.user != request.user:
            return Response({"error": "You can only decline your own surety obligations."}, status=status.HTTP_403_FORBIDDEN)

        record = decline_surety(record)
        return Response(SuretyRecordSerializer(record).data)


class CheckSuretyEligibilityView(APIView):
    """GET /api/v1/sureties/check-eligibility/<member_id>/?amount=50000"""
    permission_classes = [IsAdminOrCommittee]

    def get(self, request, member_id):
        from apps.accounts.models import MemberProfile
        from apps.savings.services import get_or_create_balance
        try:
            member = MemberProfile.objects.get(pk=member_id)
        except MemberProfile.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(request.query_params.get("amount", "0"))
        balance = get_or_create_balance(member)
        result  = check_surety_eligibility(member, amount)

        return Response({
            **result,
            "available_balance":   str(balance.available_balance),
            "max_can_commit":      str((balance.available_balance * Decimal("0.85")).quantize(Decimal("0.01"))),
            "consecutive_months":  member.consecutive_savings_months,
        })
