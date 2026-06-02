from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, StaffIDRegistry, MemberProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["staff_id", "role", "is_active", "is_first_login", "created_at"]
    list_filter = ["role", "is_active", "is_first_login"]
    search_fields = ["staff_id"]
    ordering = ["staff_id"]
    fieldsets = (
        (None, {"fields": ("staff_id", "password")}),
        ("SSC Info", {"fields": ("role", "is_first_login")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("staff_id", "role", "password1", "password2"),
        }),
    )


@admin.register(StaffIDRegistry)
class StaffIDRegistryAdmin(admin.ModelAdmin):
    list_display = ["staff_id", "is_active", "created_by", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["staff_id"]


@admin.register(MemberProfile)
class MemberProfileAdmin(admin.ModelAdmin):
    list_display = [
        "file_number",
        "full_name",
        "school_branch",
        "membership_status",
        "is_new_member",
        "consecutive_savings_months",
    ]
    list_filter = ["membership_status", "is_new_member", "school_branch", "is_legacy"]
    search_fields = ["file_number", "full_name", "user__staff_id"]
    ordering = ["file_number"]
    readonly_fields = ["file_number", "_file_sequence", "created_at", "updated_at"]

    actions = ["mark_as_not_new", "mark_as_new"]

    def mark_as_not_new(self, request, queryset):
        """Admin action: mark selected members as not new (is_new_member=False)."""
        updated = queryset.update(is_new_member=False)
        self.message_user(request, f"Marked {updated} member(s) as not new.")

    mark_as_not_new.short_description = "Mark selected members as NOT new"

    def mark_as_new(self, request, queryset):
        """Admin action: mark selected members as new (is_new_member=True)."""
        updated = queryset.update(is_new_member=True)
        self.message_user(request, f"Marked {updated} member(s) as new.")

    mark_as_new.short_description = "Mark selected members as NEW"
