from django.urls import path
from .views import (
    PostSavingsView, MemberLedgerView, MemberBalanceView,
    MyBalanceView, MyLedgerView, SavingsSummaryView,
    SavingsChangeRequestListCreateView, ApproveSavingsChangeView, RejectSavingsChangeView,
    DuesCycleListCreateView, PostDuesCycleView, LedgerExportView,
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
    path("summary/",                       SavingsSummaryView.as_view(),   name="savings-summary"),
    path("ledger/<int:member_id>/export/", LedgerExportView.as_view(),     name="ledger-export"),

]
