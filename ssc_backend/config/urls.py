from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse, JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import SSCTokenObtainPairView, LogoutView
from apps.accounts.views import ToggleSpecialSaverView
from apps.core.views import CurrentDateView, DashboardSummaryView, ResetDataView
import csv, io
from apps.core.views import CurrentDateView, DashboardSummaryView

# Report generation helpers
def _member_csv(member_id):
    from apps.accounts.models import MemberProfile
    from apps.savings.models import SavingsLedger
    try:
        member = MemberProfile.objects.get(pk=member_id)
    except MemberProfile.DoesNotExist:
        return None, HttpResponse('{"error":"Member not found."}', status=404, content_type='application/json')
    entries = SavingsLedger.objects.filter(member=member).order_by("hijri_year", "hijri_month", "created_at")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Hijri Date", "Type", "Details", "Debit", "Credit", "Balance", "Gregorian"])
    for e in entries:
        w.writerow([e.hijri_display, e.entry_type.replace("_"," "), e.details or "", str(e.debit or ""), str(e.credit or ""), str(e.balance), e.gregorian_date.isoformat()])
    resp = HttpResponse(buf.getvalue(), content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename=statement_{member.file_number}.csv'
    return member, resp

def _loan_book_csv():
    from apps.loans.models import LoanApplication, LoanStatus
    loans = LoanApplication.objects.filter(status=LoanStatus.ACTIVE).select_related("applicant")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Loan ID", "Applicant", "File No", "Amount Approved", "Outstanding", "Monthly Repayment", "Duration", "Start Hijri"])
    for l in loans:
        w.writerow([l.id, l.applicant.full_name, l.applicant.file_number, str(l.amount_approved or l.amount_applied), str(l.outstanding_balance), str(l.proposed_monthly_repayment), l.proposed_duration_months, f"{l.repayment_start_hijri_month}/{l.repayment_start_hijri_year}" if l.repayment_start_hijri_month else "N/A"])
    resp = HttpResponse(buf.getvalue(), content_type='text/csv')
    resp['Content-Disposition'] = 'attachment; filename=loan_book.csv'
    return resp

def _surety_csv():
    from apps.savings.models import MemberBalance
    balances = MemberBalance.objects.filter(suretyship_committed__gt=0).select_related("member")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["File No", "Name", "Total Savings", "Available", "Surety Committed", "Remaining Capacity (75%)"])
    for b in balances:
        cap = b.available_balance * 0.75
        w.writerow([b.member.file_number, b.member.full_name, str(b.total_savings), str(b.available_balance), str(b.suretyship_committed), f"{cap:.2f}"])
    resp = HttpResponse(buf.getvalue(), content_type='text/csv')
    resp['Content-Disposition'] = 'attachment; filename=surety_exposure.csv'
    return resp

def member_statement(request, member_id):
    _, resp = _member_csv(member_id)
    return resp

def loan_book(request):
    return _loan_book_csv()

def surety_exposure(request):
    return _surety_csv()

def health_check(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("ssc-coop-admin-secret/", admin.site.urls),
    path("api/v1/date/", CurrentDateView.as_view(), name="current-date"),
    path("api/v1/auth/login/", SSCTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/savings/", include("apps.savings.urls")),
    path("api/v1/loans/", include("apps.loans.urls")),
    path("api/v1/sureties/", include("apps.sureties.urls")),
    path("api/v1/investments/", include("apps.investments.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/audit/", include("apps.audit.urls")),
    path("api/v1/health/", health_check, name="health-check"),


    path("api/v1/reports/member-statement/<int:member_id>/", member_statement, name="member-statement"),
    path("api/v1/reports/loan-book/", loan_book, name="loan-book"),
    path("api/v1/reports/surety-exposure/", surety_exposure, name="surety-exposure"),
    path("api/v1/accounts/toggle-special/<int:member_id>/", ToggleSpecialSaverView.as_view(), name="toggle-special"),
    path("api/v1/dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("api/v1/reset-data/", ResetDataView.as_view(), name="reset-data"),
]