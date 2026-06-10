from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.generics import ListAPIView
from rest_framework.filters import OrderingFilter, SearchFilter
from apps.accounts.permissions import IsAdmin, IsAdminOrCommittee
from .models import AuditLog
from .serializers import AuditLogSerializer
from django.http import HttpResponse
import csv, io


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrCommittee]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
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
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["action", "object_type"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user_id = self.kwargs["user_id"]
        return AuditLog.objects.filter(user_id=user_id).select_related("user")


class AuditReportView(ListAPIView):
    serializer_class = AuditLogSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['action', 'object_type', 'object_id']
    search_fields = ['description', 'object_name', 'user__username']  
    ordering = ['-created_at']  

    def get_queryset(self):
        qs = AuditLog.objects.all()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        user_id = self.request.query_params.get('user_id')
        if date_from:
            qs = qs.filter(created_at__gte=date_from)  
        if date_to:
            qs = qs.filter(created_at__lte=date_to)
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs

    def list(self, request, *args, **kwargs):
        if request.query_params.get('format') == 'csv':
            queryset = self.filter_queryset(self.get_queryset())
            buffer = io.StringIO()
            writer = csv.writer(buffer)
            writer.writerow(['ID', 'User', 'Action', 'Object Type', 'Object ID', 'Description', 'Timestamp'])
            for log in queryset:
                writer.writerow([
                    log.id,
                    log.user.full_name if log.user else 'System',
                    log.action,
                    log.object_type,
                    log.object_id,
                    log.description,
                    log.created_at.isoformat() if log.created_at else '' 
                ])
            response = HttpResponse(buffer.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="audit-report.csv"'
            return response
        return super().list(request, *args, **kwargs)