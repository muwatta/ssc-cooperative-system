from django.urls import path
from .services import InvestmentListCreateView, DistributionListCreateView, DistributeProfit

urlpatterns = [
    path("",                              InvestmentListCreateView.as_view(),  name="investment-list"),
    path("distributions/",               DistributionListCreateView.as_view(), name="distribution-list"),
    path("distributions/<int:pk>/distribute/", DistributeProfit.as_view(),     name="distribute-profit"),
]
