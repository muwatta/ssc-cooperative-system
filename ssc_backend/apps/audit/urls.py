"""SSC Cooperative — Audit URLs"""

from django.urls import path
from .views import AuditLogListView, ObjectAuditLogView, UserAuditLogView

urlpatterns = [
    path("logs/", AuditLogListView.as_view(), name="audit-logs"),
    path("logs/object/<str:object_type>/<int:object_id>/", ObjectAuditLogView.as_view(), name="object-audit-logs"),
    path("logs/user/<int:user_id>/", UserAuditLogView.as_view(), name="user-audit-logs"),
]
