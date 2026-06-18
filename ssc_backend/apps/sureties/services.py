from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from typing import Optional
from apps.accounts.models import MemberProfile
from apps.notifications.models import NotificationType, send_notification
from apps.savings.services import get_or_create_balance, post_debit_entry
from apps.savings.models import LedgerEntryType
from apps.loans.models import LoanStatus, LoanApplication, LoanConfiguration
from .models import SuretyRecord, SuretyStatus

MAX_EXTERNAL_SURETIES     = 5    
MAX_SURETY_ACTS_PER_YEAR  = 3    
SELF_SURETY_RATIO         = Decimal("0.75")


def check_surety_eligibility(member: MemberProfile, amount: Decimal) -> dict:
    from django.utils import timezone
    reasons = []

    if member.is_special_saver:
        reasons.append(f"{member.file_number}: is a special savings account holder and cannot act as a surety.")
    
    if member.consecutive_savings_months < 6:
        reasons.append(f"{member.file_number}: needs 6 consecutive savings months.")
    
    # Active loan blocker
    active_loan = LoanApplication.objects.filter(
        applicant=member, status=LoanStatus.ACTIVE
    ).exists()
    if active_loan:
        reasons.append(
            f"{member.file_number}: has an active loan and must settle it before acting as a surety."
        )

    balance = get_or_create_balance(member)
    config = LoanConfiguration.get_solo()
    max_commit = (balance.available_balance * config.external_surety_max_ratio).quantize(Decimal("0.01"))
    if max_commit < amount:
        reasons.append(
            f"{member.file_number}: can commit max ₦{max_commit} "
            f"({int(config.external_surety_max_ratio * 100)}% of available balance ₦{balance.available_balance})."
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
def create_surety_records(loan, surety_data: list, note: Optional[str] = None) -> list:
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
            message = f"{loan.applicant.full_name} has requested your consent as a surety for ₦{record.amount_guaranteed}."
            if note:
                message = f"{message}\n\nNote: {note}"
            send_notification(
                member.user,
                NotificationType.SURETY_REQUEST,
                f"Surety request for Loan #{loan.id}",
                message,
                related_id=loan.id,
            )

        records.append(record)
    return records


@transaction.atomic
def confirm_surety(surety_record: SuretyRecord) -> SuretyRecord:
    if surety_record.status != SuretyStatus.PENDING:
        raise ValueError("Surety record is not pending.")

    balance = get_or_create_balance(surety_record.surety)

    # Validate using configurable ratio
    config = LoanConfiguration.get_solo()
    max_commit = (balance.available_balance * config.external_surety_max_ratio).quantize(Decimal("0.01"))
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
    for record in SuretyRecord.objects.filter(loan=loan, status=SuretyStatus.PENDING):
        record.current_liability = record.amount_guaranteed
        record.save(update_fields=['current_liability'])
        try:
            confirm_surety(record)
        except ValueError:
            pass

@transaction.atomic
def release_sureties_proportionally(loan, repayment_amount: Decimal):
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