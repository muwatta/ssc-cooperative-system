from django.db import transaction
from django.db.utils import ProgrammingError
from django.utils import timezone
from decimal import Decimal
from apps.accounts.models import MemberProfile, MembershipStatus
from apps.savings.models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle, LedgerEntryType
from utils.hijri import hijri_month_display
from apps.audit.utils import log_action


def get_or_create_balance(member: MemberProfile) -> MemberBalance:
    try:
        balance, _ = MemberBalance.objects.get_or_create(
            member=member,
            defaults={"total_savings": Decimal("0.00"), "suretyship_committed": Decimal("0.00")}
        )
        return balance
    except ProgrammingError:
        return MemberBalance(
            member=member,
            total_savings=Decimal("0.00"),
            suretyship_committed=Decimal("0.00"),
            updated_at=None,
        )


@transaction.atomic
def post_savings_entry(
    member: MemberProfile,
    amount: Decimal,
    hijri_month: int,
    hijri_year: int,
    posted_by,
    entry_type: str = LedgerEntryType.ORDINARY_SAVINGS,
    details: str = "",
) -> SavingsLedger:
    balance = get_or_create_balance(member)
    new_balance = balance.total_savings + amount
    hijri_disp = hijri_month_display(hijri_month, hijri_year)

    entry = SavingsLedger.objects.create(
        member=member,
        hijri_month=hijri_month,
        hijri_year=hijri_year,
        hijri_display=hijri_disp,
        entry_type=entry_type,
        details=details or f"Ordinary Savings — {hijri_disp}",
        credit=amount,
        debit=None,
        balance=new_balance,
        posted_by=posted_by,
        verified_by_name=posted_by.staff_id,
        verified_by_role=posted_by.role,
    )

    balance.total_savings = new_balance
    balance.save(update_fields=["total_savings", "updated_at"])

    member.consecutive_savings_months += 1
    member.save(update_fields=["consecutive_savings_months", "updated_at"])

    log_action(
        user=posted_by,
        action="POST_SAVINGS",
        description=f"Posted ordinary savings of ₦{amount} for {member.file_number} ({member.full_name})",
        object_type="SavingsEntry",
        object_id=entry.id,
        object_name=member.full_name,
    )

    return entry


@transaction.atomic
def post_debit_entry(
    member: MemberProfile,
    amount: Decimal,
    hijri_month: int,
    hijri_year: int,
    posted_by,
    entry_type: str,
    details: str,
) -> SavingsLedger:
    balance = get_or_create_balance(member)

    if balance.total_savings - amount < Decimal("0.00"):
        raise ValueError(
            f"Debit of ₦{amount} would bring {member.file_number}'s balance below zero. "
            f"Current balance: ₦{balance.total_savings}."
        )

    new_balance = balance.total_savings - amount
    hijri_disp  = hijri_month_display(hijri_month, hijri_year)

    entry = SavingsLedger.objects.create(
        member=member,
        hijri_month=hijri_month,
        hijri_year=hijri_year,
        hijri_display=hijri_disp,
        entry_type=entry_type,
        details=details,
        debit=amount,
        credit=None,
        balance=new_balance,
        posted_by=posted_by,
        verified_by_name=posted_by.staff_id,
        verified_by_role=posted_by.role,
    )

    balance.total_savings = new_balance
    balance.save(update_fields=["total_savings", "updated_at"])

    log_action(
        user=posted_by,
        action="POST_DEBIT",
        description=f"Posted debit of ₦{amount} for {member.file_number} ({member.full_name}) — {details}",
        object_type="SavingsEntry",
        object_id=entry.id,
        object_name=member.full_name,
    )

    return entry


@transaction.atomic
def post_special_savings_entry(
    member: MemberProfile,
    amount: Decimal,
    hijri_month: int,
    hijri_year: int,
    posted_by,
    details: str = "",
) -> SavingsLedger:
    """
    Move `amount` from the member's available balance into special fixed savings.

    - Debits total_savings (reduces available balance)
    - Increases special_savings by the same amount
    - Posts a ledger entry for full audit trail
    - Does NOT change suretyship_committed
    """
    balance = get_or_create_balance(member)

    if not member.is_special_saver:
        raise ValueError(
            f"{member.full_name} ({member.file_number}) is not designated as a special saver. "
            "Enable special saver status first."
        )

    if amount <= Decimal("0.00"):
        raise ValueError("Amount must be positive.")

    if balance.available_balance < amount:
        raise ValueError(
            f"Insufficient available balance. "
            f"Available: ₦{balance.available_balance}, requested: ₦{amount}."
        )

    hijri_disp = hijri_month_display(hijri_month, hijri_year)
    new_total = balance.total_savings - amount

    entry = SavingsLedger.objects.create(
        member=member,
        hijri_month=hijri_month,
        hijri_year=hijri_year,
        hijri_display=hijri_disp,
        entry_type=LedgerEntryType.SPECIAL_SAVINGS,
        details=details or f"Special Fixed Savings deposit — {hijri_disp}",
        debit=amount,       # deducted from regular pool
        credit=None,
        balance=new_total,
        posted_by=posted_by,
        verified_by_name=posted_by.staff_id,
        verified_by_role=posted_by.role,
    )

    balance.total_savings    -= amount
    balance.special_savings  += amount
    balance.save(update_fields=["total_savings", "special_savings", "updated_at"])

    log_action(
        user=posted_by,
        action="POST_SPECIAL_SAVINGS",
        description=(
            f"Moved ₦{amount} to special fixed savings for "
            f"{member.file_number} ({member.full_name})"
        ),
        object_type="SavingsEntry",
        object_id=entry.id,
        object_name=member.full_name,
    )

    return entry


@transaction.atomic
def post_termly_dues(cycle: TermlyDuesCycle, posted_by) -> dict:
    if cycle.is_posted:
        raise ValueError("This dues cycle has already been posted.")

    if cycle.target_members.exists():
        members = list(cycle.target_members.all())
    else:
        members = list(MemberProfile.objects.filter(membership_status=MembershipStatus.ACTIVE))

    successes = []
    failures  = []

    for member in members:
        try:
            post_debit_entry(
                member=member,
                amount=cycle.amount,
                hijri_month=cycle.hijri_month,
                hijri_year=cycle.hijri_year,
                posted_by=posted_by,
                entry_type=LedgerEntryType.TERMLY_DUES,
                details=f"Termly Dues — {cycle.name}",
            )
            successes.append(member.file_number)
        except ValueError as e:
            failures.append({"file_number": member.file_number, "reason": str(e)})

    cycle.is_posted = True
    cycle.posted_at = timezone.now()
    cycle.save(update_fields=["is_posted", "posted_at"])

    return {"successes": successes, "failures": failures, "total": len(members)}


@transaction.atomic
def apply_savings_change(change_request: SavingsChangeRequest, approved_by, hijri_month: int, hijri_year: int):
    from utils.hijri import hijri_month_display
    member = change_request.member
    member.approved_monthly_contribution = change_request.requested_amount
    member.save(update_fields=["approved_monthly_contribution", "updated_at"])

    change_request.status = "approved"
    change_request.effective_hijri_month = hijri_month
    change_request.effective_hijri_year  = hijri_year
    change_request.effective_hijri_display = hijri_month_display(hijri_month, hijri_year)
    change_request.approved_by      = approved_by
    change_request.approved_by_name = approved_by.staff_id
    change_request.approved_at      = timezone.now()
    change_request.save()

    return change_request


def reset_consecutive_counter(member: MemberProfile):
    member.consecutive_savings_months = 0
    member.save(update_fields=["consecutive_savings_months", "updated_at"])