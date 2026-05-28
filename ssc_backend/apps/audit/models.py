"""SSC Cooperative — Audit Models

Tracks all significant actions taken by users, admins, and committees
for compliance and accountability purposes.
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class AuditLog(models.Model):
    """
    Record of significant system actions.
    Tracks who did what, when, and on which object.
    """

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

    # Who did it
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    user_role = models.CharField(max_length=50, blank=True, default="")

    # What happened
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        default="other",
    )
    description = models.TextField(blank=True, default="")

    # On what object
    object_type = models.CharField(
        max_length=100,
        help_text="Django model name, e.g. 'MemberProfile', 'LoanApplication'",
    )
    object_id = models.IntegerField(null=True, blank=True)
    object_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Human-readable name of the object affected",
    )

    # Details
    old_values = models.JSONField(null=True, blank=True, default=dict)
    new_values = models.JSONField(null=True, blank=True, default=dict)
    request_ip = models.GenericIPAddressField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["object_type", "object_id"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_action_display()} by {self.user.username if self.user else 'System'} on {self.object_name}"
