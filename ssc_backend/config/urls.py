# from django.contrib import admin
# from django.urls import path, include
# from rest_framework_simplejwt.views import TokenRefreshView
# from apps.accounts.views import SSCTokenObtainPairView, LogoutView
# from apps.core.views import CurrentDateView
# from apps.loans.views import (
#     MemberStatementExportView,
#     LoanBookExportView,
#     SuretyExposureExportView,
# )

# from django.http import HttpResponse

# def ping(request):
#     return HttpResponse("pong")

# urlpatterns = [
#     path("api/v1/ping/", ping),    
#     path("ssc-coop-admin-secret/", admin.site.urls),
#     path("api/v1/date/", CurrentDateView.as_view(), name="current-date"),
#     path("api/v1/auth/login/", SSCTokenObtainPairView.as_view(), name="token_obtain_pair"),
#     path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
#     path("api/v1/auth/logout/", LogoutView.as_view(), name="logout"),
#     path("api/v1/accounts/", include("apps.accounts.urls")),
#     path("api/v1/savings/", include("apps.savings.urls")),
#     path("api/v1/loans/", include("apps.loans.urls")),
#     path("api/v1/sureties/", include("apps.sureties.urls")),
#     path("api/v1/investments/", include("apps.investments.urls")),
#     path("api/v1/notifications/", include("apps.notifications.urls")),
#     path("api/v1/audit/", include("apps.audit.urls")),
#     path("api/v1/reports/member-statement/<int:member_id>/", MemberStatementExportView.as_view(), name="member-statement"),
#     path("api/v1/reports/loan-book/", LoanBookExportView.as_view(), name="loan-book"),
#     path("api/v1/reports/surety-exposure/", SuretyExposureExportView.as_view(), name="surety-exposure"),
# ]


from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import SSCTokenObtainPairView, LogoutView
from apps.core.views import CurrentDateView

# from apps.loans.views import (           # ← temporarily commented out
#     MemberStatementExportView,
#     LoanBookExportView,
#     SuretyExposureExportView,
# )

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

    # TEMPORARY: inline lambda views to test routes
    path("api/v1/reports/member-statement/<int:member_id>/", lambda request, member_id: HttpResponse("OK"), name="member-statement"),
    path("api/v1/reports/loan-book/", lambda request: HttpResponse("OK"), name="loan-book"),
    path("api/v1/reports/surety-exposure/", lambda request: HttpResponse("OK"), name="surety-exposure"),
]