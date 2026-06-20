from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee
from .models import SuretyRecord, SuretyStatus
from .serializers import SuretyRecordSerializer, AddSuretiesSerializer, SuretyRecordWithBorrowerSerializer
from .services import confirm_surety, decline_surety, create_surety_records, check_surety_eligibility
from decimal import Decimal


class LoanSuretiesView(generics.ListAPIView):
    serializer_class   = SuretyRecordSerializer
    permission_classes = [IsAdminOrCommittee]

    def get_queryset(self):
        return SuretyRecord.objects.filter(loan_id=self.kwargs["loan_id"]).select_related("surety")


class MySuretiesView(generics.ListAPIView):
    serializer_class = SuretyRecordWithBorrowerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            profile = self.request.user.member_profile
            return SuretyRecord.objects.filter(
                surety=profile,
                is_self_surety=False
            ).select_related("loan__applicant")
        except Exception:
            return SuretyRecord.objects.none()
        
class ConfirmSuretyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            record = SuretyRecord.objects.select_related("surety__user").get(pk=pk)
        except SuretyRecord.DoesNotExist:
            return Response({"error": "Surety record not found."}, status=status.HTTP_404_NOT_FOUND)

        if record.surety.user != request.user:
            return Response({"error": "You can only confirm your own surety obligations."}, status=status.HTTP_403_FORBIDDEN)

        try:
            record = confirm_surety(record)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SuretyRecordSerializer(record).data)


class DeclineSuretyView(APIView):
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
    permission_classes = [IsAuthenticated]

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
            "max_can_commit":      str((balance.available_balance * Decimal("0.75")).quantize(Decimal("0.01"))),
            "consecutive_months":  member.consecutive_savings_months,
        })


class BatchCheckSuretyEligibilityView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.accounts.models import MemberProfile
        from apps.savings.services import get_or_create_balance

        sureties = request.data.get("sureties")
        if not isinstance(sureties, list):
            return Response({"error": "Expected a list of sureties."}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for item in sureties:
            if not isinstance(item, dict):
                return Response({"error": "Each surety must be an object."}, status=status.HTTP_400_BAD_REQUEST)

            row_id = item.get("row_id")
            member_id = item.get("member_id")
            amount_value = item.get("amount")

            if member_id is None or amount_value is None:
                return Response({"error": "Each surety must include member_id and amount."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                member = MemberProfile.objects.get(pk=member_id)
            except MemberProfile.DoesNotExist:
                return Response({"error": f"Member {member_id} not found."}, status=status.HTTP_404_NOT_FOUND)

            try:
                amount = Decimal(str(amount_value))
            except Exception:
                return Response({"error": "Invalid surety amount."}, status=status.HTTP_400_BAD_REQUEST)

            balance = get_or_create_balance(member)
            eligibility = check_surety_eligibility(member, amount)
            results.append({
                "row_id": row_id,
                "member_id": member_id,
                "amount": str(amount.quantize(Decimal("0.01"))),
                **eligibility,
                "available_balance": str(balance.available_balance),
                "max_can_commit": str((balance.available_balance * Decimal("0.75")).quantize(Decimal("0.01"))),
                "consecutive_months": member.consecutive_savings_months,
            })

        return Response({"results": results})
