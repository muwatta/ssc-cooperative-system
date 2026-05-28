"""SSC Cooperative — Loans Service Layer"""

from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from apps.accounts.models import MemberProfile
from apps.notifications.models import NotificationType
from apps.savings.services import get_or_create_balance, post_debit_entry
from apps.savings.models import LedgerEntryType
from apps.sureties.services import create_surety_records
from utils.hijri import hijri_month_display
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus


MAX_REPAYMENT_MONTHS = 6   # SRS amended — 6 months max
MAX_LOANS_PER_YEAR   = 4   # SRS Rule L4
SELF_SURETY_RATIO    = Decimal("0.75")  # SRS Rule SR1


def check_loan_eligibility(member: MemberProfile) -> dict:
    """
    SRS Section 5.1 — all 4 conditions must pass.
    Returns {"eligible": bool, "reasons": [str]}
    """
    reasons = []

    # 1. 6 consecutive months savings
    if member.consecutive_savings_months < 6:
        remaining = 6 - member.consecutive_savings_months
        reasons.append(f"Need {remaining} more consecutive savings month(s). Currently: {member.consecutive_savings_months}.")

    # 2. No active loan
    active_loan = LoanApplication.objects.filter(
        applicant=member, status=LoanStatus.ACTIVE
    ).exists()
    if active_loan:
        reasons.append("Member has an active loan. Must clear it before applying.")

    # 3. No active suretyship liabilities
    balance = get_or_create_balance(member)
    if balance.suretyship_committed > Decimal("0.00"):
        reasons.append(f"Member has ₦{balance.suretyship_committed} committed as surety. Must be released first.")

    # 4. Max 4 loans per calendar year
    from django.utils import timezone
    current_year = timezone.now().year
    loans_this_year = LoanApplication.objects.filter(
        applicant=member,
        created_at__year=current_year,
        status__in=[LoanStatus.ACTIVE, LoanStatus.APPROVED, LoanStatus.HOS_APPROVED, LoanStatus.COMPLETED]
    ).count()
    if loans_this_year >= MAX_LOANS_PER_YEAR:
        reasons.append(f"Maximum {MAX_LOANS_PER_YEAR} approved loans per year reached.")

    return {"eligible": len(reasons) == 0, "reasons": reasons}


def calculate_max_borrowable(member: MemberProfile) -> Decimal:
    """SRS Rule L1 — max 75% of available balance"""
    balance = get_or_create_balance(member)
    return (balance.available_balance * SELF_SURETY_RATIO).quantize(Decimal("0.01"))


@transaction.atomic
def submit_loan_application(member: MemberProfile, data: dict) -> LoanApplication:
    """Creates a loan application after eligibility check."""
    from utils.hijri import current_hijri
    eligibility = check_loan_eligibility(member)
    if not eligibility["eligible"]:
        raise ValueError(" | ".join(eligibility["reasons"]))

    duration = data.get("proposed_duration_months", 6)
    if duration > MAX_REPAYMENT_MONTHS:
        raise ValueError(f"Repayment duration cannot exceed {MAX_REPAYMENT_MONTHS} months.")

    h_month, h_year = current_hijri()

    loan = LoanApplication.objects.create(
        applicant=member,
        home_address=data["home_address"],
        phone_numbers=data["phone_numbers"],
        school_branch=member.school_branch,
        designation=member.designation,
        date_joined_cooperative=member.created_at.date(),
        monthly_contribution=member.approved_monthly_contribution,
        total_amount_saved=get_or_create_balance(member).total_savings,
        monthly_salary=data.get("monthly_salary", member.monthly_income),
        date_of_last_loan=data.get("date_of_last_loan"),
        amount_outstanding_prev=data.get("amount_outstanding_prev", Decimal("0.00")),
        amount_applied=data["amount_applied"],
        purpose=data["purpose"],
        proposed_monthly_repayment=data["proposed_monthly_repayment"],
        proposed_duration_months=duration,
        application_hijri_month=h_month,
        application_hijri_year=h_year,
        application_hijri_display=hijri_month_display(h_month, h_year),
        status=LoanStatus.SUBMITTED,
    )
    return loan


@transaction.atomic
def committee_approve_loan(loan: LoanApplication, approved_by, amount_approved: Decimal, note: str = "") -> LoanApplication:
    """SRS L10 stage 1 — committee chairman approval"""
    if loan.status not in (LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW, LoanStatus.PENDING_SURETIES):
        raise ValueError("Loan is not in a reviewable state.")

    loan.status = LoanStatus.APPROVED
    loan.amount_approved = amount_approved
    loan.outstanding_balance = amount_approved
    loan.committee_reviewed_by = approved_by
    loan.committee_reviewed_at = timezone.now()
    loan.committee_decision_note = note
    loan.save()
    return loan


@transaction.atomic
def committee_reject_loan(loan: LoanApplication, rejected_by, note: str = "") -> LoanApplication:
    """Committee rejects a loan application"""
    loan.status = LoanStatus.REJECTED
    loan.committee_reviewed_by = rejected_by
    loan.committee_reviewed_at = timezone.now()
    loan.committee_decision_note = note
    loan.save()
    return loan


@transaction.atomic
def hos_approve_loan(loan: LoanApplication, hos_user) -> LoanApplication:
    """SRS L10 stage 2 — Head of School final sign-off"""
    if loan.status != LoanStatus.APPROVED:
        raise ValueError("Loan must have Committee approval before HOS sign-off.")

    loan.status = LoanStatus.ACTIVE
    loan.hos_approved_by = hos_user
    loan.hos_approved_at = timezone.now()
    loan.save()

    # Lock sureties
    from apps.sureties.services import lock_sureties_for_loan
    lock_sureties_for_loan(loan)

    return loan


@transaction.atomic
def post_repayment(loan: LoanApplication, amount: Decimal, hijri_month: int, hijri_year: int, posted_by) -> LoanRepaymentLedger:
    """
    SRS Rules L7, S6 — manual repayment posting.
    Reduces outstanding balance. Releases sureties proportionally.
    Auto-closes loan when balance reaches zero.
    """
    if loan.status != LoanStatus.ACTIVE:
        raise ValueError("Can only post repayment to an active loan.")

    if amount > loan.outstanding_balance:
        amount = loan.outstanding_balance  # Allow exact final payment

    balance_before = loan.outstanding_balance
    balance_after  = balance_before - amount
    hijri_disp     = hijri_month_display(hijri_month, hijri_year)

    repayment = LoanRepaymentLedger.objects.create(
        loan=loan,
        hijri_month=hijri_month,
        hijri_year=hijri_year,
        hijri_display=hijri_disp,
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        posted_by=posted_by,
        verified_by_name=posted_by.staff_id,
        verified_by_role=posted_by.role,
    )

    loan.outstanding_balance = balance_after
    if balance_after == Decimal("0.00"):
        loan.status = LoanStatus.COMPLETED
    loan.save(update_fields=["outstanding_balance", "status", "updated_at"])

    # Release sureties proportionally
    from apps.sureties.services import release_sureties_proportionally
    release_sureties_proportionally(loan, amount)

    # If completed — fully release all sureties (SRS SR8)
    if balance_after == Decimal("0.00"):
        from apps.sureties.services import release_all_sureties
        release_all_sureties(loan)

    return repayment


@transaction.atomic
def handle_default_or_exit(loan: LoanApplication) -> dict:
    """
    SRS Rule M4, SR7 — abrupt exit or default.
    Transfers outstanding balance to sureties proportionally.
    """
    if loan.status not in (LoanStatus.ACTIVE,):
        raise ValueError("Loan must be active to process default.")

    from apps.sureties.services import transfer_balance_to_sureties
    result = transfer_balance_to_sureties(loan)

    loan.status = LoanStatus.DEFAULTED
    loan.save(update_fields=["status", "updated_at"])

    return result
