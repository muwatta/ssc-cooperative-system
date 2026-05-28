"""SSC Cooperative — Notifications (in-app only)"""

from django.db import models


class NotificationType(models.TextChoices):
    SAVINGS_POSTED      = "savings_posted",       "Savings Posted"
    LOAN_SUBMITTED      = "loan_submitted",        "Loan Application Submitted"
    LOAN_APPROVED       = "loan_approved",         "Loan Approved"
    LOAN_REJECTED       = "loan_rejected",         "Loan Rejected"
    LOAN_HOS_APPROVED   = "loan_hos_approved",     "Loan Final Approval"
    SURETY_REQUEST      = "surety_request",        "Surety Request"
    SURETY_CONFIRMED    = "surety_confirmed",      "Surety Confirmed"
    SURETY_DECLINED     = "surety_declined",       "Surety Declined"
    REPAYMENT_POSTED    = "repayment_posted",      "Repayment Posted"
    LOAN_COMPLETED      = "loan_completed",        "Loan Completed"
    DUES_POSTED         = "dues_posted",           "Dues Posted"
    SAVINGS_CHANGE      = "savings_change",        "Savings Change Request"
    PROFIT_DISTRIBUTED  = "profit_distributed",    "Profit Distributed"


class Notification(models.Model):
    recipient    = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notifications")
    notif_type   = models.CharField(max_length=30, choices=NotificationType.choices)
    title        = models.CharField(max_length=255)
    message      = models.TextField()
    is_read      = models.BooleanField(default=False)
    related_id   = models.PositiveIntegerField(null=True, blank=True, help_text="Related object pk")
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ssc_notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient.staff_id} | {self.notif_type} | {'Read' if self.is_read else 'Unread'}"


def send_notification(recipient_user, notif_type: str, title: str, message: str, related_id: int = None):
    """Helper called throughout the system to create notifications."""
    Notification.objects.create(
        recipient=recipient_user,
        notif_type=notif_type,
        title=title,
        message=message,
        related_id=related_id,
    )
