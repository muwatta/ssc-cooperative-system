    

from os import path

from core.views import DashboardSummaryView


path("api/v1/dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),