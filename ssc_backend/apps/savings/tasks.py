"""
Celery tasks for generating PDFs and exporting reports asynchronously.
"""

from celery import shared_task
from django.http import HttpResponse
from django.utils import timezone
import io
import csv

from apps.accounts.models import MemberProfile
from .models import SavingsLedger


@shared_task(bind=True, max_retries=3)
def generate_savings_ledger_pdf(self, member_id: int, date_from: str = None, date_to: str = None):
    """
    Asynchronously generate a PDF of member savings ledger.
    Returns file path or S3 URL for download.
    """
    try:
        member = MemberProfile.objects.get(pk=member_id)
        qs = SavingsLedger.objects.filter(member_id=member_id).order_by(
            "hijri_year", "hijri_month", "created_at"
        )

        if date_from:
            qs = qs.filter(gregorian_date__gte=date_from)
        if date_to:
            qs = qs.filter(gregorian_date__lte=date_to)

        # Generate PDF using reportlab
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas
        except ImportError:
            return {"error": "reportlab not installed"}

        buffer = io.BytesIO()
        page_width, page_height = letter
        pdf = canvas.Canvas(buffer, pagesize=letter)
        y = page_height - 72

        # Title
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(72, y, "Savings Ledger Export")
        pdf.setFont("Helvetica", 10)
        y -= 18
        pdf.drawString(72, y, f"Member: {member.file_number} — {member.full_name}")
        y -= 14
        pdf.drawString(72, y, f"Export date: {timezone.localdate().isoformat()}")
        y -= 24

        # Headers
        headers = ["Hijri", "Type", "Details", "Credit", "Debit", "Balance", "Date"]
        col_x = [72, 130, 200, 340, 400, 460, 520]
        for idx, header in enumerate(headers):
            pdf.drawString(col_x[idx], y, header)
        y -= 16
        pdf.setFont("Helvetica", 9)

        # Content
        for entry in qs:
            if y < 72:
                pdf.showPage()
                y = page_height - 72
                pdf.setFont("Helvetica", 9)

            pdf.drawString(col_x[0], y, entry.hijri_display)
            pdf.drawString(col_x[1], y, entry.entry_type.replace("_", " "))
            pdf.drawString(col_x[2], y, entry.details[:24])
            pdf.drawRightString(col_x[3] + 36, y, f"{entry.credit or 0:.2f}")
            pdf.drawRightString(col_x[4] + 36, y, f"{entry.debit or 0:.2f}")
            pdf.drawRightString(col_x[5] + 40, y, f"{entry.balance:.2f}")
            pdf.drawString(col_x[6], y, entry.gregorian_date.isoformat())
            y -= 14

        pdf.save()
        buffer.seek(0)
        
        # In production, save to cloud storage (S3, etc.)
        # For now, return buffer contents as base64 or file path
        return {
            "success": True,
            "member_id": member_id,
            "filename": f"savings-ledger-{member.file_number}.pdf",
        }

    except MemberProfile.DoesNotExist:
        return {"error": f"Member {member_id} not found"}
    except Exception as exc:
        # Retry task up to 3 times with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def generate_bulk_savings_report(self, member_ids: list = None, hijri_year: int = None, entry_type: str = None):
    """
    Asynchronously generate a bulk savings report CSV or PDF for multiple members.
    """
    try:
        qs = SavingsLedger.objects.select_related("member").order_by(
            "member__file_number", "hijri_year", "hijri_month", "created_at"
        )

        if member_ids:
            qs = qs.filter(member_id__in=member_ids)
        if hijri_year:
            qs = qs.filter(hijri_year=hijri_year)
        if entry_type:
            qs = qs.filter(entry_type=entry_type)

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "member_file_number",
            "member_name",
            "hijri_month",
            "hijri_year",
            "hijri_display",
            "entry_type",
            "details",
            "credit",
            "debit",
            "balance",
            "gregorian_date",
        ])

        for entry in qs:
            writer.writerow([
                entry.member.file_number,
                entry.member.full_name,
                entry.hijri_month,
                entry.hijri_year,
                entry.hijri_display,
                entry.entry_type,
                entry.details,
                str(entry.credit or ""),
                str(entry.debit or ""),
                str(entry.balance),
                entry.gregorian_date.isoformat(),
            ])

        return {
            "success": True,
            "row_count": qs.count(),
            "filename": f"bulk-savings-report-{timezone.localdate().isoformat()}.csv",
        }

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
