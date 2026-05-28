from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import SSCTokenObtainPairView, LogoutView


urlpatterns = [
    path("admin/", admin.site.urls),
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
]
