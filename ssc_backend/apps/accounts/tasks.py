"""
Celery tasks for async account operations: invitations, exports, etc.
"""

from celery import shared_task
from django.utils import timezone
import io
import csv

from .models import User, Invitation
from .email_service import send_password_invitation


@shared_task(bind=True, max_retries=3)
def send_bulk_invitations_async(self, user_ids: list, frontend_url: str = None):
    """
    Asynchronously send password invitation emails to multiple users.
    More suitable than the synchronous version for large batches.
    """
    if not frontend_url:
        frontend_url = "http://localhost:5173"
    
    try:
        sent_count = 0
        failed_count = 0
        errors = []

        for user_id in user_ids:
            try:
                user = User.objects.get(id=user_id)
                invitation = Invitation.create_for_user(user, expires_in_days=7)

                if send_password_invitation(user, invitation, frontend_url):
                    sent_count += 1
                else:
                    failed_count += 1
                    errors.append({"user_id": user_id, "error": "Email send failed"})
            except User.DoesNotExist:
                failed_count += 1
                errors.append({"user_id": user_id, "error": "User not found"})
            except Exception as e:
                failed_count += 1
                errors.append({"user_id": user_id, "error": str(e)})

        return {
            "sent": sent_count,
            "failed": failed_count,
            "errors": errors,
            "total": len(user_ids),
        }

    except Exception as exc:
        # Retry up to 3 times with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def generate_loan_repayment_schedule_pdf(self, loan_id: int):
    """
    Asynchronously generate a PDF of loan repayment schedule.
    """
    try:
        from apps.loans.models import LoanApplication, LoanRepaymentLedger
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        loan = LoanApplication.objects.select_related("applicant").get(pk=loan_id)
        repayments = LoanRepaymentLedger.objects.filter(loan=loan).order_by(
            "hijri_year", "hijri_month"
        )

        buffer = io.BytesIO()
        page_width, page_height = letter
        pdf = canvas.Canvas(buffer, pagesize=letter)
        y = page_height - 72

        # Title
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(72, y, "Loan Repayment Schedule")
        pdf.setFont("Helvetica", 10)
        y -= 18
        pdf.drawString(
            72,
            y,
            f"Loan ID: {loan.id} | Applicant: {loan.applicant.full_name} | Status: {loan.status}",
        )
        y -= 14
        pdf.drawString(
            72,
            y,
            f"Amount Applied: ₦{loan.amount_applied} | Outstanding: ₦{loan.outstanding_balance}",
        )
        y -= 14
        if loan.repayment_start_hijri_year and loan.repayment_start_hijri_month:
            pdf.drawString(
                72,
                y,
                f"Repayment Start: {loan.repayment_start_hijri_month}/{loan.repayment_start_hijri_year}",
            )
            y -= 14
        pdf.drawString(72, y, f"Export date: {timezone.localdate().isoformat()}")
        y -= 24

        # Headers
        headers = ["Hijri", "Amount", "Balance Before", "Balance After", "Posted By", "Date"]
        col_x = [72, 150, 250, 350, 450, 540]
        for idx, header in enumerate(headers):
            pdf.drawString(col_x[idx], y, header)
        y -= 16
        pdf.setFont("Helvetica", 9)

        # Content
        for entry in repayments:
            if y < 72:
                pdf.showPage()
                y = page_height - 72
                pdf.setFont("Helvetica", 9)

            pdf.drawString(col_x[0], y, entry.hijri_display)
            pdf.drawRightString(col_x[1] + 60, y, f"{entry.amount:.2f}")
            pdf.drawRightString(col_x[2] + 60, y, f"{entry.balance_before:.2f}")
            pdf.drawRightString(col_x[3] + 60, y, f"{entry.balance_after:.2f}")
            pdf.drawString(col_x[4], y, entry.verified_by_name or "")
            created_at_str = (
                entry.created_at.isoformat()
                if hasattr(entry.created_at, "isoformat")
                else str(entry.created_at)
            )
            pdf.drawString(col_x[5], y, created_at_str)
            y -= 14

        pdf.save()
        buffer.seek(0)

        return {
            "success": True,
            "loan_id": loan_id,
            "filename": f"loan-{loan_id}-repayments.pdf",
            "repayment_count": repayments.count(),
        }

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
