from django.contrib import admin
from .models import Investment, ProfitDistribution

@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ["name", "amount", "hijri_display", "created_at"]

@admin.register(ProfitDistribution)
class ProfitDistributionAdmin(admin.ModelAdmin):
    list_display = ["investment", "profit_percentage", "total_profit", "is_distributed"]
