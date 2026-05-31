from django.db import models
from django.conf import settings


class AuditLog(models.Model):

    ACTION_CHOICES = [
        ("profile_create", "Profile Created"),
        ("profile_update", "Profile Updated"),
        ("profile_approve", "Profile Approved"),
        ("savings_post", "Savings Posted"),
        ("dues_post", "Dues Posted"),
        ("loan_apply", "Loan Applied"),
        ("loan_approve", "Loan Approved"),
        ("loan_reject", "Loan Rejected"),
        ("loan_repayment", "Loan Repayment"),
        ("surety_confirm", "Surety Confirmed"),
        ("surety_decline", "Surety Declined"),
        ("user_create", "User Created"),
        ("user_approve", "User Approved"),
        ("settings_update", "Settings Updated"),
        ("other", "Other Action"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )

    user_role = models.CharField(max_length=50, blank=True, default="")

    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        default="other",
    )

    description = models.TextField(blank=True, default="")

    object_type = models.CharField(
        max_length=100
    )

    object_id = models.IntegerField(null=True, blank=True)

    object_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    old_values = models.JSONField(null=True, blank=True, default=dict)
    new_values = models.JSONField(null=True, blank=True, default=dict)

    request_ip = models.GenericIPAddressField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_action_display()} by {self.user or 'System'}"
    

class MemberProfileAudit(models.Model):
    member = models.ForeignKey("accounts.MemberProfile", on_delete=models.CASCADE)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]