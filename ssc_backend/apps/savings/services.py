"""
SSC Cooperative — Savings Service Layer
All savings business logic lives here. Views call these functions.
This keeps views thin and business rules testable.
"""

from django.db import transaction
from django.db.utils import ProgrammingError
from django.utils import timezone
from decimal import Decimal
from apps.accounts.models import MemberProfile, MembershipStatus
from apps.savings.models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle, LedgerEntryType
from utils.hijri import hijri_month_display


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
    """
    SRS Rules S1, S3, S4, S5.
    Posts a credit entry to the member's savings ledger.
    Updates MemberBalance atomically.
    Updates consecutive_savings_months counter.
    """
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

    # Update balance
    balance.total_savings = new_balance
    balance.save(update_fields=["total_savings", "updated_at"])

    # Update consecutive savings counter (SRS M1, M2)
    member.consecutive_savings_months += 1
    member.save(update_fields=["consecutive_savings_months", "updated_at"])

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
    """
    Posts a debit entry (dues, adjustment).
    SRS Rule S4: balance can never go below zero.
    """
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

    return entry


@transaction.atomic
def post_termly_dues(cycle: TermlyDuesCycle, posted_by) -> dict:
    """
    SRS Section 4.3 — post dues against all target members.
    Returns summary of successes and failures.
    """
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
    """
    SRS Section 2.5 — apply an approved savings change.
    Updates member's approved_monthly_contribution from effective month.
    """
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
    """SRS Rule M2 — missed month resets counter to zero."""
    member.consecutive_savings_months = 0
    member.save(update_fields=["consecutive_savings_months", "updated_at"])
