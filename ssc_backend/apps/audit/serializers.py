"""SSC Cooperative — Audit Serializers"""

from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "user_role",
            "action",
            "action_display",
            "description",
            "object_type",
            "object_id",
            "object_name",
            "old_values",
            "new_values",
            "request_ip",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]
