from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from apps.accounts.models import MemberProfile
from apps.notifications.models import NotificationType
from apps.savings.services import get_or_create_balance, post_debit_entry
from apps.savings.models import LedgerEntryType
from apps.sureties.services import create_surety_records, lock_sureties_for_loan, release_sureties_proportionally, release_all_sureties, transfer_balance_to_sureties
from utils.hijri import hijri_month_display
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus, LoanConfiguration


def get_loan_configuration() -> LoanConfiguration:
    return LoanConfiguration.get_solo()


def check_loan_eligibility(member: MemberProfile) -> dict:
    reasons = []
    config = get_loan_configuration()

    # 1. configured consecutive savings requirement
    if member.consecutive_savings_months < config.consecutive_savings_months_required:
        remaining = config.consecutive_savings_months_required - member.consecutive_savings_months
        reasons.append(
            f"Need {remaining} more consecutive savings month(s). Currently: {member.consecutive_savings_months}."
        )

    # 2. Active loan requirement can be optionally enforced
    if config.require_no_active_loan:
        active_loan = LoanApplication.objects.filter(
            applicant=member, status=LoanStatus.ACTIVE
        ).exists()
        if active_loan:
            reasons.append("Member has an active loan. Must clear it before applying.")

    # 3. Surety liability requirement can be optionally enforced
    if config.require_no_surety_liabilities:
        balance = get_or_create_balance(member)
        if balance.suretyship_committed > Decimal("0.00"):
            reasons.append(
                f"Member has ₦{balance.suretyship_committed} committed as surety. Must be released first."
            )

    # 4. Max 4 loans per calendar year
    from django.utils import timezone
    current_year = timezone.now().year
    loans_this_year = LoanApplication.objects.filter(
        applicant=member,
        created_at__year=current_year,
        status__in=[LoanStatus.ACTIVE, LoanStatus.APPROVED, LoanStatus.COMPLETED]  # removed HOS_APPROVED
    ).count()
    if loans_this_year >= config.max_loans_per_year:
        reasons.append(
            f"Maximum {config.max_loans_per_year} approved loans per year reached."
        )

    return {"eligible": len(reasons) == 0, "reasons": reasons}


def calculate_max_borrowable(member: MemberProfile) -> Decimal:
    config = get_loan_configuration()
    balance = get_or_create_balance(member)
    return (balance.available_balance * config.max_borrowable_ratio).quantize(Decimal("0.01"))

@transaction.atomic
@transaction.atomic
def submit_loan_application(member: MemberProfile, data: dict, sureties: list = None) -> LoanApplication:
    # Auto-set repayment start to the next Hijri month
    from utils.hijri import current_hijri
    h_now_month, h_now_year = current_hijri()

    # Compute next month
    if h_now_month == 12:
        start_month = 1
        start_year = h_now_year + 1
    else:
        start_month = h_now_month + 1
        start_year = h_now_year

    loan.repayment_start_hijri_month = start_month
    loan.repayment_start_hijri_year  = start_year
    loan.save(update_fields=["repayment_start_hijri_month", "repayment_start_hijri_year"])

    from utils.hijri import current_hijri
    eligibility = check_loan_eligibility(member)
    if not eligibility["eligible"]:
        raise ValueError(" | ".join(eligibility["reasons"]))

    duration = data.get("proposed_duration_months", 6)
    if duration < 1 or duration > 6:
        raise ValueError("Repayment duration must be between 1 and 6 months.")

    amount_applied = Decimal(str(data["amount_applied"]))
    if amount_applied <= 0:
        raise ValueError("Loan amount must be positive.")

    config = get_loan_configuration()
    balance = get_or_create_balance(member)
    self_surety_max = (balance.available_balance * config.self_surety_ratio).quantize(Decimal("0.01"))
    shortfall = amount_applied - self_surety_max

    if shortfall > 0:
        if not sureties:
            raise ValueError(f"External sureties are required to cover the shortfall of ₦{shortfall}.")
        total_external = Decimal("0")
        for surety_item in sureties:
            amount = Decimal(str(surety_item.get("amount", 0)))
            if amount <= 0:
                raise ValueError("Each surety guarantee amount must be positive.")
            total_external += amount

            surety_member = MemberProfile.objects.select_related("user").get(pk=surety_item["member_id"])
            surety_balance = get_or_create_balance(surety_member)
            max_surety = (surety_balance.available_balance * Decimal("0.85")).quantize(Decimal("0.01"))
            if amount > max_surety:
                raise ValueError(
                    f"{surety_member.full_name} can guarantee at most ₦{max_surety} (85% of their available balance)."
                )
        if total_external < shortfall:
            raise ValueError(
                f"Total external guarantees (₦{total_external}) are less than the required shortfall of ₦{shortfall}."
            )
    else:
        if sureties:
            raise ValueError("External sureties are not required because the loan amount does not exceed your self‑surety limit.")

    # 5. Absolute max borrowable
    max_borrowable = calculate_max_borrowable(member)
    if amount_applied > max_borrowable:
        raise ValueError(f"Loan amount cannot exceed ₦{max_borrowable}.")

    # 6. Hijri date
    h_month, h_year = current_hijri()

    # Create loan
    loan = LoanApplication.objects.create(
        applicant=member,
        home_address=data["home_address"],
        phone_numbers=data["phone_numbers"],
        school_branch=member.school_branch,
        designation=member.designation,
        date_joined_cooperative=member.created_at.date(),
        monthly_contribution=member.approved_monthly_contribution,
        total_amount_saved=balance.total_savings,
        monthly_salary=data.get("monthly_salary", member.monthly_income),
        date_of_last_loan=data.get("date_of_last_loan"),
        amount_outstanding_prev=data.get("amount_outstanding_prev", Decimal("0.00")),
        amount_applied=amount_applied,
        purpose=data["purpose"],
        proposed_monthly_repayment=data["proposed_monthly_repayment"],
        proposed_duration_months=duration,
        application_hijri_month=h_month,
        application_hijri_year=h_year,
        application_hijri_display=hijri_month_display(h_month, h_year),
        status=LoanStatus.SUBMITTED,
    )

    # 7. Always create self‑surety record (layer 1)
    create_surety_records(loan, [
        {"member_id": member.pk, "amount": amount_applied, "layer": 1}
    ])

    # 8. Create external surety records if needed
    if sureties:
        surety_items = []
        for idx, s in enumerate(sureties, start=2):
            surety_items.append({
                "member_id": s["member_id"],
                "amount": Decimal(str(s["amount"])),
                "layer": idx,
            })
        create_surety_records(loan, surety_items)
        loan.status = LoanStatus.PENDING_SURETIES
        loan.save(update_fields=["status"])

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
@transaction.atomic
@transaction.atomic
def admin_final_approve_loan(loan: LoanApplication, admin_user) -> LoanApplication:
    if loan.status != LoanStatus.APPROVED:
        raise ValueError("Loan must be committee-approved before final approval.")

    # Debit the approved amount from borrower's savings
    from utils.hijri import current_hijri
    from apps.savings.services import post_debit_entry
    from apps.savings.models import LedgerEntryType

    h_month, h_year = current_hijri()
    try:
        post_debit_entry(
            member=loan.applicant,
            amount=loan.amount_approved,
            hijri_month=h_month,
            hijri_year=h_year,
            posted_by=admin_user,
            entry_type=LedgerEntryType.LOAN_DISBURSEMENT,
            details=f"Loan disbursement — Loan #{loan.id}",
        )
    except ValueError as e:
        raise ValueError(f"Failed to deduct loan from savings: {e}")

    loan.status = LoanStatus.ACTIVE
    loan.save()

    lock_sureties_for_loan(loan)

    return loan

@transaction.atomic
@transaction.atomic
@transaction.atomic
def post_repayment(loan: LoanApplication, amount: Decimal, hijri_month: int, hijri_year: int, posted_by) -> LoanRepaymentLedger:
    """
    SRS Rules L7, S6 — manual repayment posting.
    Reduces outstanding balance, credits savings, releases sureties proportionally.
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

    from apps.savings.services import post_savings_entry
    from apps.savings.models import LedgerEntryType

    post_savings_entry(
        member=loan.applicant,
        amount=amount,
        hijri_month=hijri_month,
        hijri_year=hijri_year,
        posted_by=posted_by,
        entry_type=LedgerEntryType.LOAN_REPAYMENT,
        details=f"Loan repayment — Loan #{loan.id}",
    )

    release_sureties_proportionally(loan, amount)
    if balance_after == Decimal("0.00"):
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

    result = transfer_balance_to_sureties(loan)

    loan.status = LoanStatus.DEFAULTED
    loan.save(update_fields=["status", "updated_at"])

    return result