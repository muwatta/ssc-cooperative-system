from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):

    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrCommittee]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ["user", "action", "object_type"]
    search_fields = ["description", "object_name", "user__username"]
    ordering = ["-created_at"]


class ObjectAuditLogView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, object_type, object_id):
        logs = AuditLog.objects.filter(
            object_type=object_type,
            object_id=object_id,
        ).select_related("user")

        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = AuditLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    def paginate_queryset(self, queryset):
        from rest_framework.pagination import PageNumberPagination

        paginator = PageNumberPagination()
        paginator.page_size = 20
        return paginator.paginate_queryset(queryset, self.request)

    def get_paginated_response(self, data):
        from rest_framework.pagination import PageNumberPagination

        paginator = PageNumberPagination()
        return paginator.get_paginated_response(data)


class UserAuditLogView(generics.ListAPIView):

    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrCommittee]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["action", "object_type"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user_id = self.kwargs["user_id"]
        return AuditLog.objects.filter(user_id=user_id).select_related("user")
