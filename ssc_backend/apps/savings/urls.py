from django.urls import path
from .views import (
    BatchMonthlyDeductionView, FullWithdrawalView, MoveToSpecialView, PendingChangeRequestsCountView, PostSavingsView, MemberLedgerView, MemberBalanceView,
    MyBalanceView, MyLedgerView, ReconciliationView, SavingsSummaryView,
    SavingsChangeRequestListCreateView, ApproveSavingsChangeView, RejectSavingsChangeView,
    DuesCycleListCreateView, PostDuesCycleView, LedgerExportView,
    BulkSavingsReportView, WithdrawSpecialView, WithdrawSpecialView,
)

urlpatterns = [
    path("post/",                          PostSavingsView.as_view(),                    name="savings-post"),
    path("my-balance/",                    MyBalanceView.as_view(),                      name="my-balance"),
    path("summary/",                       SavingsSummaryView.as_view(),                  name="savings-summary"),
    path("my-ledger/",                     MyLedgerView.as_view(),                       name="my-ledger"),
    path("balance/<int:member_id>/",       MemberBalanceView.as_view(),                  name="member-balance"),
    path("ledger/<int:member_id>/",        MemberLedgerView.as_view(),                   name="member-ledger"),
    path("change-requests/",              SavingsChangeRequestListCreateView.as_view(),  name="change-request-list"),
    path("change-requests/<int:pk>/approve/", ApproveSavingsChangeView.as_view(),        name="change-request-approve"),
    path("change-requests/<int:pk>/reject/",  RejectSavingsChangeView.as_view(),         name="change-request-reject"),
    path("dues/",                          DuesCycleListCreateView.as_view(),            name="dues-list"),
    path("dues/<int:pk>/post/",            PostDuesCycleView.as_view(),                  name="dues-post"),
    path("ledger/<int:member_id>/export/", LedgerExportView.as_view(),     name="ledger-export"),
    path("reports/export/",               BulkSavingsReportView.as_view(),              name="bulk-savings-report"),
    path("batch-monthly/", BatchMonthlyDeductionView.as_view(), name="batch-monthly"),
    path("change-requests/pending-count/", PendingChangeRequestsCountView.as_view(), name="pending-count"),
    path("withdraw/<int:member_id>/", FullWithdrawalView.as_view(), name="full-withdrawal"),
    path("move-to-special/<int:member_id>/", MoveToSpecialView.as_view(), name="move-to-special"),
    path("withdraw-special/<int:member_id>/", WithdrawSpecialView.as_view(), name="withdraw-special"),
    path("reconciliation/", ReconciliationView.as_view(), name="reconciliation"),
]

