from decimal import Decimal
from django.db import transaction, models
from django.db.models import Sum
from django.utils import timezone
from apps.accounts.models import MemberProfile
from apps.savings.services import get_or_create_balance, post_debit_entry
from apps.savings.models import LedgerEntryType, SavingsLedger
from apps.sureties.services import create_surety_records, lock_sureties_for_loan, release_sureties_proportionally, release_all_sureties, transfer_balance_to_sureties
from apps.sureties.models import SuretyRecord, SuretyStatus
from utils.hijri import hijri_month_display
from .models import LoanApplication, LoanRepaymentLedger, LoanStatus, LoanConfiguration
from apps.audit.utils import log_action


def get_loan_configuration() -> LoanConfiguration:
    return LoanConfiguration.get_solo()


def check_loan_eligibility(member: MemberProfile) -> dict:
    reasons = []
    config = get_loan_configuration()

    # 1. consecutive savings requirement
    if member.consecutive_savings_months < config.consecutive_savings_months_required:
        remaining = config.consecutive_savings_months_required - member.consecutive_savings_months
        reasons.append(
            f"Need {remaining} more consecutive savings month(s). Currently: {member.consecutive_savings_months}."
        )

    # 2. Active loan requirement – block ONLY if external sureties exist (single query)
    if config.require_no_active_loan:
        external_surety_exists = SuretyRecord.objects.filter(
            loan__applicant=member,
            loan__status=LoanStatus.ACTIVE,
            is_self_surety=False,
            status=SuretyStatus.CONFIRMED
        ).exists()
        if external_surety_exists:
            reasons.append("You already have an active loan that uses external sureties. You cannot apply for another loan until it is fully repaid.")

    # 3. Surety liability requirement
    if config.require_no_surety_liabilities:
        balance = get_or_create_balance(member)
        if balance.suretyship_committed > Decimal("0.00"):
            reasons.append(
                f"Member has ₦{balance.suretyship_committed} committed as surety. Must be released first."
            )

    # 4. Max loans per calendar year
    current_year = timezone.now().year
    loans_this_year = LoanApplication.objects.filter(
        applicant=member,
        created_at__year=current_year,
        status__in=[LoanStatus.ACTIVE, LoanStatus.APPROVED, LoanStatus.COMPLETED]
    ).count()
    if loans_this_year >= config.max_loans_per_year:
        reasons.append(
            f"Maximum {config.max_loans_per_year} approved loans per year reached."
        )

    # 5. Only one pending application at a time
    pending_statuses = [
        LoanStatus.SUBMITTED,
        LoanStatus.UNDER_REVIEW,
        LoanStatus.PENDING_SURETIES,
        LoanStatus.PENDING_ADMIN,
    ]
    if LoanApplication.objects.filter(applicant=member, status__in=pending_statuses).exists():
        reasons.append(
            "You already have a loan application that is still under review. "
            "Please wait for a final decision before applying again."
        )

    # 6. Reapply cooldown after rejection (24 hours)
    last_rejected = LoanApplication.objects.filter(
        applicant=member, status=LoanStatus.REJECTED
    ).order_by('-created_at').first()
    if last_rejected and (timezone.now() - last_rejected.created_at).total_seconds() < 86400:
        hours_left = 24 - int((timezone.now() - last_rejected.created_at).total_seconds() / 3600)
        reasons.append(
            f"You cannot reapply yet. Please wait {hours_left} hours after your last rejection."
        )

    return {"eligible": len(reasons) == 0, "reasons": reasons}


def calculate_max_borrowable(member: MemberProfile) -> Decimal:
    config = get_loan_configuration()
    balance = get_or_create_balance(member)
    return (balance.available_balance / Decimal('0.75')).quantize(Decimal('0.01'))

@transaction.atomic
def submit_loan_application(member: MemberProfile, data: dict, sureties: list = None) -> LoanApplication:
    from utils.hijri import current_hijri

    # Lock member balance row to prevent concurrent submission races
    balance = get_or_create_balance(member)
    balance = balance.__class__.objects.select_for_update().get(pk=balance.pk)

    eligibility = check_loan_eligibility(member)
    if not eligibility["eligible"]:
        raise ValueError(" | ".join(eligibility["reasons"]))

    config = get_loan_configuration()
    duration = data.get("proposed_duration_months", config.max_repayment_months)
    if duration < 1 or duration > config.max_repayment_months:
        raise ValueError(f"Repayment duration must be between 1 and {config.max_repayment_months} months.")

    amount_applied = Decimal(str(data["amount_applied"]))
    amount_applied = amount_applied.quantize(Decimal("0.01"))
    if amount_applied <= 0:
        raise ValueError("Loan amount must be positive.")

    self_surety_max = (balance.total_savings * config.self_surety_ratio).quantize(Decimal("0.01"))
    shortfall = (amount_applied - self_surety_max).quantize(Decimal("0.01"))

    if shortfall > 0:
        if not sureties:
            raise ValueError(f"External sureties are required to cover the shortfall of ₦{shortfall}.")
        total_external = Decimal("0")
        for surety_item in sureties:
            amount = Decimal(str(surety_item.get("amount", 0))).quantize(Decimal("0.01"))
            if amount <= 0:
                raise ValueError("Each surety guarantee amount must be positive.")
            total_external += amount

            surety_member = MemberProfile.objects.select_related("user").get(pk=surety_item["member_id"])
            surety_balance = get_or_create_balance(surety_member)
            max_surety = (surety_balance.available_balance * Decimal("0.75")).quantize(Decimal("0.01"))
            if amount > max_surety:
                raise ValueError(
                    f"{surety_member.full_name} can guarantee at most ₦{max_surety} (75% of their available balance)."
                )

        # ✅ Cap: total external guarantee cannot exceed the shortfall
        if total_external > shortfall:
            raise ValueError(
                f"Total external guarantee (₦{total_external}) exceeds the required shortfall of ₦{shortfall}. "
                f"Maximum allowed: ₦{shortfall}."
            )

        if total_external < shortfall:
            raise ValueError(
                f"Total external guarantees (₦{total_external}) are less than the required shortfall of ₦{shortfall}."
            )
    else:
        if sureties:
            raise ValueError("External sureties are not required because the loan amount does not exceed your self‑surety limit.")

    max_borrowable = calculate_max_borrowable(member)
    if amount_applied > max_borrowable:
        raise ValueError(f"Loan amount cannot exceed ₦{max_borrowable}.")

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
        purpose=data.get("purpose", ""),
        proposed_monthly_repayment=data["proposed_monthly_repayment"],
        proposed_duration_months=duration,
        application_hijri_month=h_month,
        application_hijri_year=h_year,
        application_hijri_display=hijri_month_display(h_month, h_year),
        status=LoanStatus.SUBMITTED,
    )

    # Auto-set repayment start
    from utils.hijri import current_hijri as get_hijri_now
    now_month, now_year = get_hijri_now()
    if now_month == 12:
        start_month = 1
        start_year = now_year + 1
    else:
        start_month = now_month + 1
        start_year = now_year

    loan.repayment_start_hijri_month = start_month
    loan.repayment_start_hijri_year = start_year
    loan.save(update_fields=["repayment_start_hijri_month", "repayment_start_hijri_year"])

    # Create self‑surety record
    create_surety_records(
        loan,
        [{"member_id": member.pk, "amount": self_surety_max, "layer": 1}],
        note=data.get("note"),
)
    if sureties:
       
        total_external = sum(Decimal(str(s["amount"])) for s in sureties)
        if total_external > shortfall:
            raise ValueError(
                f"Total external guarantee (₦{total_external}) exceeds the required shortfall of ₦{shortfall}."
            )

        surety_items = []
        for idx, s in enumerate(sureties, start=2):
            surety_items.append({
                "member_id": s["member_id"],
                "amount": Decimal(str(s["amount"])).quantize(Decimal("0.01")),
                "layer": idx,
            })
        create_surety_records(loan, surety_items, note=data.get("note"))
        loan.status = LoanStatus.PENDING_SURETIES
        loan.save(update_fields=["status"])

    log_action(
        user=member.user,
        action="SUBMIT_LOAN",
        description=f"Loan #{loan.id} submitted by {member.full_name} for ₦{amount_applied}",
        object_type="Loan",
        object_id=loan.id,
        object_name=member.full_name,
    )

    return loan


@transaction.atomic
def committee_approve_loan(loan: LoanApplication, approved_by, amount_approved: Decimal, note: str = "") -> LoanApplication:
    loan = LoanApplication.objects.select_for_update().get(pk=loan.pk)

    if loan.status not in (LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW, LoanStatus.PENDING_SURETIES):
        raise ValueError("Loan is not in a reviewable state.")

    amount_approved = amount_approved.quantize(Decimal("0.01"))
    if amount_approved <= 0:
        raise ValueError("Approved amount must be positive.")
    if amount_approved > loan.amount_applied:
        raise ValueError("Approved amount cannot exceed the amount applied.")

    loan.status = LoanStatus.PENDING_ADMIN
    loan.amount_approved = amount_approved
    loan.outstanding_balance = amount_approved
    loan.committee_reviewed_by = approved_by
    loan.committee_reviewed_at = timezone.now()
    loan.committee_decision_note = note
    loan.save()

    log_action(
        user=approved_by,
        action="COMMITTEE_APPROVE",
        description=f"Committee approved loan #{loan.id} for {loan.applicant.full_name} with amount ₦{amount_approved}",
        object_type="Loan",
        object_id=loan.id,
        object_name=loan.applicant.full_name,
    )

    return loan


@transaction.atomic
def committee_reject_loan(loan: LoanApplication, rejected_by, note: str = "") -> LoanApplication:
    loan = LoanApplication.objects.select_for_update().get(pk=loan.pk)
    loan.status = LoanStatus.REJECTED
    loan.committee_reviewed_by = rejected_by
    loan.committee_reviewed_at = timezone.now()
    loan.committee_decision_note = note
    loan.save()

    log_action(
        user=rejected_by,
        action="REJECT_LOAN",
        description=f"Committee rejected loan #{loan.id} for {loan.applicant.full_name}",
        object_type="Loan",
        object_id=loan.id,
        object_name=loan.applicant.full_name,
    )

    return loan


@transaction.atomic
def admin_final_approve_loan(loan, admin_user, note: str = "") -> LoanApplication:
    loan = LoanApplication.objects.select_for_update().get(pk=loan.pk)
    if loan.status != LoanStatus.PENDING_ADMIN:
        raise ValueError("Loan must be pending admin approval before final approval.")

    from utils.hijri import current_hijri
    config = get_loan_configuration()
    h_month, h_year = current_hijri()

    balance = get_or_create_balance(loan.applicant)
    balance = balance.__class__.objects.select_for_update().get(pk=balance.pk)

    self_surety_amount = (loan.amount_approved * config.self_surety_ratio).quantize(Decimal("0.01"))

    if balance.available_balance < self_surety_amount:
        raise ValueError(
            f"Member's available balance (₦{balance.available_balance}) is less than "
            f"the required self-surety lock amount (₦{self_surety_amount})."
        )

    balance.suretyship_committed += self_surety_amount
    balance.save(update_fields=["suretyship_committed", "updated_at"])

    hijri_disp = hijri_month_display(h_month, h_year)
    SavingsLedger.objects.create(
        member=loan.applicant,
        hijri_month=h_month,
        hijri_year=h_year,
        hijri_display=hijri_disp,
        entry_type=LedgerEntryType.LOAN_DISBURSEMENT,
        details=f"Self-surety locked for loan #{loan.id} (₦{self_surety_amount} of ₦{loan.amount_approved} approved) — savings unaffected",
        debit=None,
        credit=None,
        balance=balance.total_savings,
        posted_by=admin_user,
        verified_by_name=admin_user.staff_id,
        verified_by_role=admin_user.role,
    )

    loan.status = LoanStatus.ACTIVE
    loan.admin_final_approval_note = note
    loan.save()

    lock_sureties_for_loan(loan)

    log_action(
        user=admin_user,
        action="ADMIN_APPROVE",
        description=f"Admin gave final approval for loan #{loan.id} for {loan.applicant.full_name}",
        object_type="Loan",
        object_id=loan.id,
        object_name=loan.applicant.full_name,
    )

    return loan

@transaction.atomic
def post_repayment(loan: LoanApplication, amount: Decimal, hijri_month: int, hijri_year: int, posted_by) -> LoanRepaymentLedger:
    loan = LoanApplication.objects.select_for_update().get(pk=loan.pk)

    if loan.status != LoanStatus.ACTIVE:
        raise ValueError("Can only post repayment to an active loan.")

    amount = amount.quantize(Decimal("0.01"))
    if amount <= 0:
        raise ValueError("Repayment amount must be positive.")

    external_sureties = list(
        SuretyRecord.objects.select_for_update()
        .filter(loan=loan, is_self_surety=False)
        .exclude(status=SuretyStatus.RELEASED)
    )

    total_external_liability = sum(s.current_liability for s in external_sureties)

    amount_to_sureties = min(amount, total_external_liability)
    amount_to_borrower = amount - amount_to_sureties

    if total_external_liability > 0 and amount_to_sureties > 0:
        for surety in external_sureties:
            ratio = surety.current_liability / total_external_liability
            reduction = amount_to_sureties * ratio
            new_liability = max(Decimal('0.00'), surety.current_liability - reduction)
            surety.current_liability = new_liability
            if new_liability == Decimal('0.00'):
                surety.status = SuretyStatus.RELEASED
                surety.released_at = timezone.now()
            surety.save(update_fields=['current_liability', 'status', 'released_at'])

    balance_before = loan.outstanding_balance
    new_balance = max(Decimal('0.00'), balance_before - amount_to_borrower)
    loan.outstanding_balance = new_balance

    if new_balance == Decimal('0.00'):
        loan.status = LoanStatus.COMPLETED

    loan.save(update_fields=['outstanding_balance', 'status', 'updated_at'])

    hijri_disp = hijri_month_display(hijri_month, hijri_year)
    repayment = LoanRepaymentLedger.objects.create(
        loan=loan,
        hijri_month=hijri_month,
        hijri_year=hijri_year,
        hijri_display=hijri_disp,
        amount=amount,
        balance_before=balance_before,
        balance_after=new_balance,
        posted_by=posted_by,
        verified_by_name=posted_by.staff_id,
        verified_by_role=posted_by.role,
    )

    post_debit_entry(
        member=loan.applicant,
        amount=amount,
        hijri_month=hijri_month,
        hijri_year=hijri_year,
        posted_by=posted_by,
        entry_type=LedgerEntryType.LOAN_REPAYMENT,
        details=f"Loan repayment — Loan #{loan.id}",
    )

    log_action(
        user=posted_by,
        action="POST_REPAYMENT",
        description=f"Posted repayment of ₦{amount} for loan #{loan.id} for {loan.applicant.full_name}",
        object_type="LoanRepayment",
        object_id=repayment.id,
        object_name=loan.applicant.full_name,
    )

    return repayment


@transaction.atomic
def handle_default_or_exit(loan: LoanApplication) -> dict:
    loan = LoanApplication.objects.select_for_update().get(pk=loan.pk)

    if loan.status not in (LoanStatus.ACTIVE,):
        raise ValueError("Loan must be active to process default.")

    result = transfer_balance_to_sureties(loan)

    loan.status = LoanStatus.DEFAULTED
    loan.save(update_fields=["status", "updated_at"])

    log_action(
        user=None,
        action="LOAN_DEFAULT",
        description=f"Loan #{loan.id} for {loan.applicant.full_name} defaulted. Sureties enforced.",
        object_type="Loan",
        object_id=loan.id,
        object_name=loan.applicant.full_name,
    )

    return result