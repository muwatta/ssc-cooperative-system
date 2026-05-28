from django.urls import path
from .views import LoanSuretiesView, MySuretiesView, ConfirmSuretyView, DeclineSuretyView, CheckSuretyEligibilityView

urlpatterns = [
    path("mine/",                              MySuretiesView.as_view(),              name="my-sureties"),
    path("loan/<int:loan_id>/",                LoanSuretiesView.as_view(),            name="loan-sureties"),
    path("<int:pk>/confirm/",                  ConfirmSuretyView.as_view(),           name="surety-confirm"),
    path("<int:pk>/decline/",                  DeclineSuretyView.as_view(),           name="surety-decline"),
    path("check-eligibility/<int:member_id>/", CheckSuretyEligibilityView.as_view(),  name="surety-check"),
]
