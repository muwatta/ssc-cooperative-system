from django.urls import path
from .views import (
    AdminFinalApprovalView, HOSApprovalView, LoanDraftView, LoanEligibilityView, LoanApplicationListView, MyLoanListView,
    SubmitLoanView, CommitteeDecisionView,
    PostRepaymentView, LoanRepaymentHistoryView, LoanRepaymentExportView,
    LoanDetailView, HandleDefaultView, LoanSettingsView,
    LoanRepaymentExportAsyncView, TaskStatusView, PendingLoanCountView,
)

urlpatterns = [
    path("eligibility/",                   LoanEligibilityView.as_view(),         name="loan-eligibility"),
    path("settings/",                      LoanSettingsView.as_view(),            name="loan-settings"),
    path("draft/",                         LoanDraftView.as_view(),                name="loan-draft"),
    path("pending-count/",                 PendingLoanCountView.as_view(),         name="pending-loan-count"),
    path("",                               LoanApplicationListView.as_view(),      name="loan-list"),
    path("mine/",                          MyLoanListView.as_view(),               name="my-loans"),
    path("apply/",                         SubmitLoanView.as_view(),               name="loan-apply"),
    path("<int:pk>/",                      LoanDetailView.as_view(),               name="loan-detail"),
    path("<int:pk>/committee-decision/",   CommitteeDecisionView.as_view(),        name="loan-committee-decision"),
    path("<int:pk>/admin-approve/",        AdminFinalApprovalView.as_view(),       name="loan-admin-approve"),
    path("<int:pk>/hos-approve/",           HOSApprovalView.as_view(),             name="loan-hos-approve"),
    path("<int:pk>/repayment/",            PostRepaymentView.as_view(),            name="loan-repayment"),
    path("<int:pk>/repayments/",           LoanRepaymentHistoryView.as_view(),     name="loan-repayment-history"),
    path("<int:pk>/repayments/export/",    LoanRepaymentExportView.as_view(),      name="loan-repayment-export"),
    path("<int:pk>/repayments/export-async/", LoanRepaymentExportAsyncView.as_view(), name="loan-repayment-export-async"),
    path("<int:pk>/default/",              HandleDefaultView.as_view(),            name="loan-default"),
    path("tasks/<str:task_id>/",           TaskStatusView.as_view(),               name="task-status"),
]
