"""
SSC Cooperative — Savings Models
Covers SRS Sections 4, 7.1
"""

from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class LedgerEntryType(models.TextChoices):
    ORDINARY_SAVINGS = "ordinary_savings", "Ordinary Savings"
    TERMLY_DUES      = "termly_dues",      "Termly Dues"
    PROFIT_SHARE     = "profit_share",     "Profit Share"
    ADJUSTMENT       = "adjustment",       "Adjustment"
    LEGACY_IMPORT    = "legacy_import",    "Legacy Import"
    LOAN_REPAYMENT   = "loan_repayment",   "Loan Repayment"


class SavingsChangeStatus(models.TextChoices):
    PENDING  = "pending",  "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class SavingsLedger(models.Model):
    """
    SRS Section 4.4 — per-member savings ledger.
    Every credit and debit recorded here with Islamic date.
    Running balance maintained after every entry.
    """
    member = models.ForeignKey(
        "accounts.MemberProfile",
        on_delete=models.PROTECT,
        related_name="savings_entries"
    )
    # Islamic date (primary — SRS 1.1)
    hijri_month = models.PositiveSmallIntegerField()
    hijri_year  = models.PositiveIntegerField()
    hijri_display = models.CharField(max_length=50)  # e.g. "Rajab 1443"

    # Gregorian timestamp (secondary — auto-recorded)
    gregorian_date = models.DateField(auto_now_add=True)

    entry_type = models.CharField(max_length=30, choices=LedgerEntryType.choices)
    details    = models.CharField(max_length=255)

    # Only one of debit or credit is set per entry — never both
    debit  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    credit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Running balance after this entry
    balance = models.DecimalField(max_digits=14, decimal_places=2)

    # Who posted this entry (SRS 4.4 — Verification field)
    posted_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="savings_postings"
    )
    verified_by_name = models.CharField(max_length=255)
    verified_by_role = models.CharField(max_length=20)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ssc_savings_ledger"
        ordering = ["hijri_year", "hijri_month", "created_at"]
        verbose_name = "Savings Ledger Entry"

    def __str__(self):
        return f"{self.member.file_number} | {self.hijri_display} | {self.entry_type}"


class MemberBalance(models.Model):
    """
    SRS Section 4.2 — denormalised balance record.
    Updated atomically after every ledger entry.
    Available Balance = Total Savings - Suretyship Committed
    """
    member = models.OneToOneField(
        "accounts.MemberProfile",
        on_delete=models.PROTECT,
        related_name="balance"
    )
    total_savings        = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    suretyship_committed = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ssc_member_balances"

    @property
    def available_balance(self):
        return self.total_savings - self.suretyship_committed

    def __str__(self):
        return f"{self.member.file_number} | Total: {self.total_savings} | Available: {self.available_balance}"


class SavingsChangeRequest(models.Model):
    """
    SRS Section 2.5 — formal Savings Increase/Decrease form.
    Member submits → Admin/Chairman approves → effective Islamic month set.
    """
    member           = models.ForeignKey(
        "accounts.MemberProfile",
        on_delete=models.PROTECT,
        related_name="savings_change_requests"
    )
    current_amount   = models.DecimalField(max_digits=12, decimal_places=2)
    requested_amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("1000.00"))]
    )
    # Financial secretary records these at submission time
    savings_balance_at_request = models.DecimalField(max_digits=14, decimal_places=2)
    loan_balance_at_request    = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    status = models.CharField(max_length=10, choices=SavingsChangeStatus.choices, default=SavingsChangeStatus.PENDING)

    # Set by Admin/Chairman on approval
    effective_hijri_month = models.PositiveSmallIntegerField(null=True, blank=True)
    effective_hijri_year  = models.PositiveIntegerField(null=True, blank=True)
    effective_hijri_display = models.CharField(max_length=50, blank=True, default="")

    approved_by      = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="approved_savings_changes"
    )
    approved_by_name = models.CharField(max_length=255, blank=True, default="")
    submitted_at     = models.DateTimeField(auto_now_add=True)
    approved_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ssc_savings_change_requests"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.member.file_number} | {self.current_amount} → {self.requested_amount} | {self.status}"


class TermlyDuesCycle(models.Model):
    """
    SRS Section 4.3 — configurable termly dues.
    Admin creates a cycle, sets amount and target members.
    Posting debits all selected members' savings.
    """
    name        = models.CharField(max_length=100, help_text="e.g. 'First Term 1445'")
    amount      = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True, default="")

    hijri_month = models.PositiveSmallIntegerField()
    hijri_year  = models.PositiveIntegerField()
    hijri_display = models.CharField(max_length=50)

    posted_by   = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    is_posted   = models.BooleanField(default=False)
    posted_at   = models.DateTimeField(null=True, blank=True)

    # If null → all active members. If set → specific members only.
    target_members = models.ManyToManyField(
        "accounts.MemberProfile",
        blank=True,
        related_name="dues_cycles",
        help_text="Empty = all active members"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ssc_termly_dues_cycles"
        ordering = ["-hijri_year", "-hijri_month"]

    def __str__(self):
        return f"{self.name} | ₦{self.amount} | {self.hijri_display}"
