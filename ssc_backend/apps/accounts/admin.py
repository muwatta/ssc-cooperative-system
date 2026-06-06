from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.urls import reverse
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
        "is_special_saver",                
        "consecutive_savings_months",
    ]
    list_editable = ["is_special_saver"]
    list_filter = [
        "membership_status",
        "is_new_member",
        "school_branch",
        "is_legacy",
        "is_special_saver",             
    ]
    search_fields = ["file_number", "full_name", "user__staff_id"]
    ordering = ["file_number"]
    readonly_fields = ["file_number", "_file_sequence", "created_at", "updated_at"]

    # Ensure the field appears on the edit form
    fieldsets = (
        (None, {
            'fields': (
                'user', 'file_number', 'full_name', 'membership_status',
                'is_new_member', 'is_special_saver',  # ← added
                'school_branch', 'designation', 'approved_monthly_contribution',
                'consecutive_savings_months', 'phone_primary',
            )
        }),
    )

    actions = ["mark_as_not_new", "mark_as_new"]

    def mark_as_not_new(self, request, queryset):
        updated = queryset.update(is_new_member=False)
        self.message_user(request, f"Marked {updated} member(s) as not new.")
    mark_as_not_new.short_description = "Mark selected members as NOT new"

    def mark_as_new(self, request, queryset):
        updated = queryset.update(is_new_member=True)
        self.message_user(request, f"Marked {updated} member(s) as new.")
    mark_as_new.short_description = "Mark selected members as NEW"

    # … keep the custom URL and legacy methods unchanged …
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'mark-all-legacy-not-new/',
                self.admin_site.admin_view(self.mark_all_legacy_confirmation),
                name='accounts_memberprofile_mark_all_legacy_not_new'
            ),
            path(
                'do-mark-all-legacy-not-new/',
                self.admin_site.admin_view(self.do_mark_all_legacy_not_new),
                name='accounts_memberprofile_do_mark_all_legacy_not_new'
            ),
        ]
        return custom_urls + urls

    def mark_all_legacy_confirmation(self, request):
        legacy_new_count = MemberProfile.objects.filter(is_legacy=True, is_new_member=True).count()
        context = {
            'title': 'Mark all legacy members as NOT new',
            'legacy_new_count': legacy_new_count,
            'opts': self.model._meta,
            'app_label': self.model._meta.app_label,
        }
        return render(request, 'admin/accounts/memberprofile/mark_all_legacy_confirmation.html', context)

    def do_mark_all_legacy_not_new(self, request):
        if request.method != 'POST':
            return redirect('admin:accounts_memberprofile_changelist')
        updated = MemberProfile.objects.filter(is_legacy=True).update(is_new_member=False)
        self.message_user(request, f'{updated} legacy member(s) have been marked as NOT new.')
        return HttpResponseRedirect(reverse('admin:accounts_memberprofile_changelist'))