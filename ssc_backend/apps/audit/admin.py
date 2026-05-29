from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "user", "action", "object_type", "object_name"]
    list_filter = ["action", "object_type", "created_at", "user__role"]
    search_fields = ["object_name", "description", "user__username"]
    readonly_fields = [
        "user",
        "action",
        "description",
        "object_type",
        "object_id",
        "object_name",
        "old_values",
        "new_values",
        "request_ip",
        "created_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False
