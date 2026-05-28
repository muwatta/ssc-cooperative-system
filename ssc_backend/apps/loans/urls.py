from django.urls import path
from .views import (
    LoanEligibilityView, LoanApplicationListView, MyLoanListView,
    SubmitLoanView, CommitteeDecisionView, HOSApprovalView,
    PostRepaymentView, LoanRepaymentHistoryView, LoanDetailView, HandleDefaultView,
)

urlpatterns = [
    path("eligibility/",                   LoanEligibilityView.as_view(),         name="loan-eligibility"),
    path("",                               LoanApplicationListView.as_view(),      name="loan-list"),
    path("mine/",                          MyLoanListView.as_view(),               name="my-loans"),
    path("apply/",                         SubmitLoanView.as_view(),               name="loan-apply"),
    path("<int:pk>/",                      LoanDetailView.as_view(),               name="loan-detail"),
    path("<int:pk>/committee-decision/",   CommitteeDecisionView.as_view(),        name="loan-committee-decision"),
    path("<int:pk>/hos-approve/",          HOSApprovalView.as_view(),              name="loan-hos-approve"),
    path("<int:pk>/repayment/",            PostRepaymentView.as_view(),            name="loan-repayment"),
    path("<int:pk>/repayments/",           LoanRepaymentHistoryView.as_view(),     name="loan-repayment-history"),
    path("<int:pk>/default/",              HandleDefaultView.as_view(),            name="loan-default"),
]
