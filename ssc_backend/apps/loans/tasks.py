"""
Celery tasks for loan-related async operations.
"""

from celery import shared_task
from django.utils import timezone
import io

from .models import LoanApplication, LoanRepaymentLedger


@shared_task(bind=True, max_retries=3)
def generate_loan_repayment_pdf(self, loan_id: int):
    """
    Asynchronously generate a PDF of loan repayment schedule.
    Can be called for background processing of large exports.
    """
    try:
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

        # Title and metadata
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

        # Column headers
        headers = ["Hijri", "Amount", "Balance Before", "Balance After", "Posted By", "Date"]
        col_x = [72, 150, 250, 350, 450, 540]
        for idx, header in enumerate(headers):
            pdf.drawString(col_x[idx], y, header)
        y -= 16
        pdf.setFont("Helvetica", 9)

        # Repayment rows
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

        # In production, upload to cloud storage (S3, etc.)
        # For now, return metadata
        return {
            "success": True,
            "loan_id": loan_id,
            "filename": f"loan-{loan_id}-repayments.pdf",
            "repayment_count": repayments.count(),
            "generated_at": timezone.localtime().isoformat(),
        }

    except LoanApplication.DoesNotExist:
        return {"error": f"Loan {loan_id} not found"}
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
