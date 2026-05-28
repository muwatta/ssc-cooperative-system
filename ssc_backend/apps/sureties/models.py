"""
SSC Cooperative — Sureties Models
Covers SRS Section 6, Rules SR1-SR8
"""

from django.db import models
from decimal import Decimal


class SuretyStatus(models.TextChoices):
    PENDING   = "pending",   "Pending Confirmation"
    CONFIRMED = "confirmed", "Confirmed"
    DECLINED  = "declined",  "Declined"
    RELEASED  = "released",  "Released"
    DEFAULTED = "defaulted", "Transferred (Default)"


class SuretyRecord(models.Model):
    """
    One record per surety per loan.
    Layer 1 = self-surety (borrower). Layers 2-6 = external sureties.
    SRS Section 6.1 — six-layer structure.
    """
    loan   = models.ForeignKey(
        "loans.LoanApplication",
        on_delete=models.PROTECT,
        related_name="sureties"
    )
    surety = models.ForeignKey(
        "accounts.MemberProfile",
        on_delete=models.PROTECT,
        related_name="surety_records"
    )
    layer  = models.PositiveSmallIntegerField(
        help_text="1=self-surety, 2-6=external sureties"
    )
    is_self_surety = models.BooleanField(default=False)

    # Amount this surety is guaranteeing
    amount_guaranteed = models.DecimalField(max_digits=12, decimal_places=2)

    # Remaining liability (reduces with each repayment)
    current_liability = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(
        max_length=15, choices=SuretyStatus.choices, default=SuretyStatus.PENDING
    )

    confirmed_at  = models.DateTimeField(null=True, blank=True)
    released_at   = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ssc_surety_records"
        unique_together = [("loan", "surety")]
        ordering = ["layer"]

    def __str__(self):
        return f"Loan {self.loan_id} | Layer {self.layer} | {self.surety.file_number} | {self.status}"
