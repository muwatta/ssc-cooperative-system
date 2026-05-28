"""
SSC Cooperative — Loans Models
Covers SRS Sections 5, 7.3
Repayment duration: 6 months (amended from SRS v1.2 — client verbal confirmation)
"""

from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class LoanStatus(models.TextChoices):
    SUBMITTED  = "submitted",   "Submitted"
    UNDER_REVIEW = "under_review", "Under Review"
    PENDING_SURETIES = "pending_sureties", "Pending Surety Confirmation"
    APPROVED   = "approved",    "Committee Approved"
    HOS_APPROVED = "hos_approved", "HOS Approved — Active"
    ACTIVE     = "active",      "Active"
    COMPLETED  = "completed",   "Completed"
    REJECTED   = "rejected",    "Rejected"
    DEFAULTED  = "defaulted",   "Defaulted"


class LoanApplication(models.Model):
    """
    SRS Section 5.4 — mirrors physical SSC Ordinary Loan form exactly.
    """
    applicant  = models.ForeignKey(
        "accounts.MemberProfile",
        on_delete=models.PROTECT,
        related_name="loan_applications"
    )

    # ── Loan form fields (SRS 5.4) ────────────────────────────────
    home_address    = models.TextField()
    phone_numbers   = models.CharField(max_length=100)
    school_branch   = models.CharField(max_length=20)
    designation     = models.CharField(max_length=255)
    date_joined_cooperative = models.DateField()
    monthly_contribution    = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount_saved      = models.DecimalField(max_digits=14, decimal_places=2)
    monthly_salary          = models.DecimalField(max_digits=12, decimal_places=2)
    date_of_last_loan       = models.DateField(null=True, blank=True)
    amount_outstanding_prev = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # ── Loan details ──────────────────────────────────────────────
    amount_applied  = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("1.00"))]
    )
    purpose         = models.TextField()

    # ── Repayment plan (SRS 5.3 — 6 months max) ──────────────────
    proposed_monthly_repayment = models.DecimalField(max_digits=12, decimal_places=2)
    proposed_duration_months   = models.PositiveSmallIntegerField(
        help_text="Maximum 6 months (SRS amended)"
    )

    # Islamic repayment schedule dates
    repayment_start_hijri_month = models.PositiveSmallIntegerField(null=True, blank=True)
    repayment_start_hijri_year  = models.PositiveIntegerField(null=True, blank=True)
    repayment_end_hijri_month   = models.PositiveSmallIntegerField(null=True, blank=True)
    repayment_end_hijri_year    = models.PositiveIntegerField(null=True, blank=True)

    # ── Status and balances ───────────────────────────────────────
    status              = models.CharField(max_length=20, choices=LoanStatus.choices, default=LoanStatus.SUBMITTED)
    amount_approved     = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # ── Approval chain (SRS 5.5, L10) ────────────────────────────
    committee_reviewed_by   = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="committee_reviewed_loans"
    )
    committee_reviewed_at   = models.DateTimeField(null=True, blank=True)
    committee_decision_note = models.TextField(blank=True, default="")

    hos_approved_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="hos_approved_loans"
    )
    hos_approved_at = models.DateTimeField(null=True, blank=True)

    # ── Islamic dates for the application ────────────────────────
    application_hijri_month = models.PositiveSmallIntegerField(null=True, blank=True)
    application_hijri_year  = models.PositiveIntegerField(null=True, blank=True)
    application_hijri_display = models.CharField(max_length=50, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ssc_loan_applications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.applicant.file_number} | ₦{self.amount_applied} | {self.status}"

    @property
    def is_active(self):
        return self.status == LoanStatus.ACTIVE


class LoanRepaymentLedger(models.Model):
    """
    SRS Section 5.3 — manual repayment posting.
    Each entry reduces outstanding_balance on the loan.
    Never deducted from payslip — posted manually by Admin/Committee.
    """
    loan = models.ForeignKey(
        LoanApplication,
        on_delete=models.PROTECT,
        related_name="repayments"
    )
    hijri_month   = models.PositiveSmallIntegerField()
    hijri_year    = models.PositiveIntegerField()
    hijri_display = models.CharField(max_length=50)

    amount          = models.DecimalField(max_digits=12, decimal_places=2)
    balance_before  = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after   = models.DecimalField(max_digits=12, decimal_places=2)

    posted_by        = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    verified_by_name = models.CharField(max_length=255)
    verified_by_role = models.CharField(max_length=20)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ssc_loan_repayment_ledger"
        ordering = ["hijri_year", "hijri_month"]

    def __str__(self):
        return f"Loan {self.loan_id} | {self.hijri_display} | ₦{self.amount}"
