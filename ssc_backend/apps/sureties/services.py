"""SSC Cooperative — Sureties Service Layer"""

from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from apps.accounts.models import MemberProfile
from apps.notifications.models import NotificationType, send_notification
from apps.savings.services import get_or_create_balance, post_debit_entry
from apps.savings.models import LedgerEntryType
from apps.loans.models import LoanStatus
from .models import SuretyRecord, SuretyStatus

MAX_EXTERNAL_SURETIES     = 5     # SRS SR3
MAX_SURETY_ACTS_PER_YEAR  = 3     # SRS SR4
EXTERNAL_SURETY_MAX_RATIO = Decimal("0.85")  # SRS SR2
SELF_SURETY_RATIO         = Decimal("0.75")  # SRS SR1


def check_surety_eligibility(member: MemberProfile, amount: Decimal) -> dict:
    """SRS Section 6.2 — validate a surety candidate"""
    from django.utils import timezone
    reasons = []

    if member.consecutive_savings_months < 6:
        reasons.append(f"{member.file_number}: needs 6 consecutive savings months.")

    balance = get_or_create_balance(member)
    max_commit = (balance.available_balance * EXTERNAL_SURETY_MAX_RATIO).quantize(Decimal("0.01"))
    if max_commit < amount:
        reasons.append(
            f"{member.file_number}: can commit max ₦{max_commit} "
            f"(85% of available balance ₦{balance.available_balance})."
        )

    # Annual surety count (SRS SR4)
    current_year = timezone.now().year
    acts_this_year = SuretyRecord.objects.filter(
        surety=member,
        created_at__year=current_year,
        is_self_surety=False,
        status__in=[SuretyStatus.CONFIRMED, SuretyStatus.RELEASED],
    ).count()
    if acts_this_year >= MAX_SURETY_ACTS_PER_YEAR:
        reasons.append(f"{member.file_number}: already acted as external surety {acts_this_year} times this year (max {MAX_SURETY_ACTS_PER_YEAR}).")

    return {"eligible": len(reasons) == 0, "reasons": reasons}


@transaction.atomic
def create_surety_records(loan, surety_data: list) -> list:
    """
    Creates surety records for a loan.
    surety_data: [{"member_id": int, "amount": Decimal, "layer": int}]
    Layer 1 is always self-surety (borrower).
    """
    records = []
    for item in surety_data:
        member = MemberProfile.objects.get(pk=item["member_id"])
        is_self = item["layer"] == 1

        record = SuretyRecord.objects.create(
            loan=loan,
            surety=member,
            layer=item["layer"],
            is_self_surety=is_self,
            amount_guaranteed=item["amount"],
            current_liability=item["amount"],
            status=SuretyStatus.CONFIRMED if is_self else SuretyStatus.PENDING,
        )
        if is_self:
            record.confirmed_at = timezone.now()
            record.save(update_fields=["confirmed_at"])

        if not is_self and hasattr(member, "user") and member.user is not None:
            send_notification(
                member.user,
                NotificationType.SURETY_REQUEST,
                f"Surety request for Loan #{loan.id}",
                f"{loan.applicant.full_name} has requested your consent as a surety for ₦{record.amount_guaranteed}.",
                related_id=loan.id,
            )

        records.append(record)
    return records


@transaction.atomic
def confirm_surety(surety_record: SuretyRecord) -> SuretyRecord:
    """SRS SR5 — lock committed amount immediately on confirmation"""
    if surety_record.status != SuretyStatus.PENDING:
        raise ValueError("Surety record is not pending.")

    balance = get_or_create_balance(surety_record.surety)

    # Validate 85% rule still holds
    max_commit = (balance.available_balance * EXTERNAL_SURETY_MAX_RATIO).quantize(Decimal("0.01"))
    if surety_record.amount_guaranteed > max_commit:
        raise ValueError(
            f"Cannot commit ₦{surety_record.amount_guaranteed}. "
            f"Maximum based on current balance: ₦{max_commit}."
        )

    # Lock the amount — increase suretyship_committed
    balance.suretyship_committed += surety_record.amount_guaranteed
    balance.save(update_fields=["suretyship_committed", "updated_at"])

    surety_record.status = SuretyStatus.CONFIRMED
    surety_record.confirmed_at = timezone.now()
    surety_record.save(update_fields=["status", "confirmed_at", "updated_at"])

    if surety_record.loan.status == LoanStatus.PENDING_SURETIES:
        pending = SuretyRecord.objects.filter(
            loan=surety_record.loan,
            status=SuretyStatus.PENDING,
            is_self_surety=False,
        ).exists()
        if not pending:
            surety_record.loan.status = LoanStatus.SUBMITTED
            surety_record.loan.save(update_fields=["status"])

    if hasattr(surety_record.loan.applicant, "user") and surety_record.loan.applicant.user is not None:
        send_notification(
            surety_record.loan.applicant.user,
            NotificationType.SURETY_CONFIRMED,
            f"Surety confirmed for Loan #{surety_record.loan.id}",
            f"{surety_record.surety.full_name} has confirmed your surety request for ₦{surety_record.amount_guaranteed}.",
            related_id=surety_record.loan.id,
        )

    return surety_record


@transaction.atomic
def decline_surety(surety_record: SuretyRecord) -> SuretyRecord:
    surety_record.status = SuretyStatus.DECLINED
    surety_record.save(update_fields=["status", "updated_at"])

    if hasattr(surety_record.loan.applicant, "user") and surety_record.loan.applicant.user is not None:
        send_notification(
            surety_record.loan.applicant.user,
            NotificationType.SURETY_DECLINED,
            f"Surety declined for Loan #{surety_record.loan.id}",
            f"{surety_record.surety.full_name} has declined your surety request.",
            related_id=surety_record.loan.id,
        )

    return surety_record


@transaction.atomic
def lock_sureties_for_loan(loan):
    """Called when HOS approves — lock all confirmed external sureties"""
    for record in SuretyRecord.objects.filter(loan=loan, status=SuretyStatus.PENDING):
        try:
            confirm_surety(record)
        except ValueError:
            pass  # Already handled during confirmation flow


@transaction.atomic
def release_sureties_proportionally(loan, repayment_amount: Decimal):
    """
    SRS SR6 — as borrower repays, each surety's liability reduces proportionally.
    """
    if loan.outstanding_balance <= Decimal("0.00"):
        return

    total_guaranteed = sum(
        r.amount_guaranteed
        for r in SuretyRecord.objects.filter(loan=loan, status=SuretyStatus.CONFIRMED)
    )
    if total_guaranteed == Decimal("0.00"):
        return

    for record in SuretyRecord.objects.filter(loan=loan, status=SuretyStatus.CONFIRMED):
        proportion = record.amount_guaranteed / total_guaranteed
        release_amount = (repayment_amount * proportion).quantize(Decimal("0.01"))

        balance = get_or_create_balance(record.surety)
        balance.suretyship_committed = max(
            Decimal("0.00"),
            balance.suretyship_committed - release_amount
        )
        balance.save(update_fields=["suretyship_committed", "updated_at"])

        record.current_liability = max(
            Decimal("0.00"),
            record.current_liability - release_amount
        )
        record.save(update_fields=["current_liability", "updated_at"])


@transaction.atomic
def release_all_sureties(loan):
    """SRS SR8 — fully release all sureties when loan balance reaches zero"""
    for record in SuretyRecord.objects.filter(loan=loan, status=SuretyStatus.CONFIRMED):
        balance = get_or_create_balance(record.surety)
        balance.suretyship_committed = max(
            Decimal("0.00"),
            balance.suretyship_committed - record.current_liability
        )
        balance.save(update_fields=["suretyship_committed", "updated_at"])

        record.current_liability = Decimal("0.00")
        record.status = SuretyStatus.RELEASED
        record.released_at = timezone.now()
        record.save(update_fields=["current_liability", "status", "released_at", "updated_at"])


@transaction.atomic
def transfer_balance_to_sureties(loan) -> dict:
    """
    SRS SR7, M4 — default/abrupt exit.
    Transfer outstanding balance to sureties proportionally.
    Debit each surety's savings account.
    """
    outstanding = loan.outstanding_balance
    confirmed_sureties = SuretyRecord.objects.filter(
        loan=loan, status=SuretyStatus.CONFIRMED
    ).select_related("surety")

    total_guaranteed = sum(r.amount_guaranteed for r in confirmed_sureties)
    if total_guaranteed == Decimal("0.00"):
        return {"transferred": [], "errors": ["No confirmed sureties found."]}

    from utils.hijri import current_hijri
    h_month, h_year = current_hijri()

    transferred = []
    errors      = []

    for record in confirmed_sureties:
        proportion      = record.amount_guaranteed / total_guaranteed
        transfer_amount = (outstanding * proportion).quantize(Decimal("0.01"))

        try:
            posted_by = loan.applicant.user
            post_debit_entry(
                member=record.surety,
                amount=transfer_amount,
                hijri_month=h_month,
                hijri_year=h_year,
                posted_by=posted_by,
                entry_type=LedgerEntryType.ADJUSTMENT,
                details=f"Loan default transfer — Loan #{loan.id} | {loan.applicant.file_number}",
            )
            record.status = SuretyStatus.DEFAULTED
            record.current_liability = Decimal("0.00")
            record.save(update_fields=["status", "current_liability", "updated_at"])
            transferred.append({"file_number": record.surety.file_number, "amount": str(transfer_amount)})
        except ValueError as e:
            errors.append({"file_number": record.surety.file_number, "error": str(e)})

    return {"transferred": transferred, "errors": errors}
