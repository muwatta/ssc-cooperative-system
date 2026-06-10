from django.urls import path
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def member_statement_export(request, member_id):
    from apps.accounts.models import MemberProfile
    from apps.savings.models import SavingsLedger
    import csv, io
    try:
        member = MemberProfile.objects.get(pk=member_id)
    except MemberProfile.DoesNotExist:
        return Response({"error": "Member not found."}, status=404)

    export_format = request.query_params.get("format", "csv").lower()
    entries = SavingsLedger.objects.filter(member=member).order_by(
        "hijri_year", "hijri_month", "created_at"
    )

    if export_format == "pdf":
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas
        except ImportError:
            return Response({"error": "PDF export requires reportlab."}, status=500)

        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=letter)
        y = 750
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(72, y, f"Savings Statement – {member.file_number} {member.full_name}")
        y -= 30
        pdf.setFont("Helvetica", 9)
        for e in entries:
            if y < 72:
                pdf.showPage()
                y = 750
            pdf.drawString(72, y, e.hijri_display)
            pdf.drawString(200, y, e.entry_type.replace("_", " "))
            pdf.drawString(300, y, (e.details or "")[:30])
            pdf.drawRightString(450, y, f"₦{e.debit or 0:.2f}")
            pdf.drawRightString(500, y, f"₦{e.credit or 0:.2f}")
            pdf.drawRightString(550, y, f"₦{e.balance:.2f}")
            y -= 14
        pdf.save()
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type="application/pdf")
        response["Content-Disposition"] = f"attachment; filename=statement_{member.file_number}.pdf"
        return response

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Hijri Date", "Type", "Details", "Debit", "Credit", "Balance", "Gregorian"])
    for e in entries:
        writer.writerow([
            e.hijri_display,
            e.entry_type.replace("_", " "),
            e.details or "",
            str(e.debit or ""),
            str(e.credit or ""),
            str(e.balance),
            e.gregorian_date.isoformat(),
        ])
    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f"attachment; filename=statement_{member.file_number}.csv"
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def loan_book_export(request):
    from apps.loans.models import LoanApplication, LoanStatus
    import csv, io

    export_format = request.query_params.get("format", "csv").lower()
    loans = LoanApplication.objects.filter(status=LoanStatus.ACTIVE).select_related("applicant")

    if export_format == "pdf":
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas
        except ImportError:
            return Response({"error": "PDF export requires reportlab."}, status=500)

        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=letter)
        y = 750
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(72, y, "Loan Book Report – Active Loans")
        y -= 30
        pdf.setFont("Helvetica", 9)
        for loan in loans:
            if y < 72:
                pdf.showPage()
                y = 750
            pdf.drawString(72, y, f"Loan #{loan.id}: {loan.applicant.full_name} ({loan.applicant.file_number})")
            pdf.drawString(300, y, f"Approved: ₦{loan.amount_approved or loan.amount_applied:.2f}")
            pdf.drawString(450, y, f"Outstanding: ₦{loan.outstanding_balance:.2f}")
            y -= 14
        pdf.save()
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type="application/pdf")
        response["Content-Disposition"] = "attachment; filename=loan_book.pdf"
        return response

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Loan ID", "Applicant", "File No", "Amount Approved", "Outstanding", "Monthly Repayment", "Duration", "Start Hijri"])
    for loan in loans:
        writer.writerow([
            loan.id,
            loan.applicant.full_name,
            loan.applicant.file_number,
            str(loan.amount_approved or loan.amount_applied),
            str(loan.outstanding_balance),
            str(loan.proposed_monthly_repayment),
            loan.proposed_duration_months,
            f"{loan.repayment_start_hijri_month}/{loan.repayment_start_hijri_year}" if loan.repayment_start_hijri_month else "N/A",
        ])
    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = "attachment; filename=loan_book.csv"
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def surety_exposure_export(request):
    from apps.savings.models import MemberBalance
    import csv, io

    export_format = request.query_params.get("format", "csv").lower()
    balances = MemberBalance.objects.filter(
        suretyship_committed__gt=0
    ).select_related("member")

    if export_format == "pdf":
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas
        except ImportError:
            return Response({"error": "PDF export requires reportlab."}, status=500)

        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=letter)
        y = 750
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(72, y, "Surety Exposure Report")
        y -= 30
        pdf.setFont("Helvetica", 9)
        for b in balances:
            if y < 72:
                pdf.showPage()
                y = 750
            pdf.drawString(72, y, f"{b.member.file_number} {b.member.full_name}")
            pdf.drawString(300, y, f"Committed: ₦{b.suretyship_committed:.2f}  |  Available: ₦{b.available_balance:.2f}")
            y -= 14
        pdf.save()
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type="application/pdf")
        response["Content-Disposition"] = "attachment; filename=surety_exposure.pdf"
        return response

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["File No", "Name", "Total Savings", "Available", "Surety Committed", "Remaining Capacity (75%)"])
    for b in balances:
        max_capacity = b.available_balance * 0.75
        writer.writerow([
            b.member.file_number,
            b.member.full_name,
            str(b.total_savings),
            str(b.available_balance),
            str(b.suretyship_committed),
            f"{max_capacity:.2f}",
        ])
    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = "attachment; filename=surety_exposure.csv"
    return response


urlpatterns = [
    path("member-statement/<int:member_id>/", member_statement_export, name="member-statement"),
    path("loan-book/", loan_book_export, name="loan-book"),
    path("surety-exposure/", surety_exposure_export, name="surety-exposure"),
]