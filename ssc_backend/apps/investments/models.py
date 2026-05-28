"""SSC Cooperative — Investments App (Models + Views + URLs in one file for brevity)"""

# ── models.py content ─────────────────────────────────────────────
from django.db import models
from decimal import Decimal


class Investment(models.Model):
    name        = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    amount      = models.DecimalField(max_digits=14, decimal_places=2)
    hijri_month = models.PositiveSmallIntegerField()
    hijri_year  = models.PositiveIntegerField()
    hijri_display = models.CharField(max_length=50)
    recorded_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ssc_investments"
        ordering = ["-hijri_year", "-hijri_month"]

    def __str__(self):
        return f"{self.name} | ₦{self.amount} | {self.hijri_display}"


class ProfitDistribution(models.Model):
    """Admin declares fixed % profit for a cycle. Distributed to all contributing members."""
    investment      = models.ForeignKey(Investment, on_delete=models.PROTECT, related_name="distributions")
    profit_percentage = models.DecimalField(max_digits=5, decimal_places=2, help_text="e.g. 10.00 for 10%")
    total_profit    = models.DecimalField(max_digits=14, decimal_places=2)
    hijri_month     = models.PositiveSmallIntegerField()
    hijri_year      = models.PositiveIntegerField()
    hijri_display   = models.CharField(max_length=50)
    distributed_by  = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    is_distributed  = models.BooleanField(default=False)
    distributed_at  = models.DateTimeField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ssc_profit_distributions"
        ordering = ["-hijri_year"]

    def __str__(self):
        return f"{self.investment.name} | {self.profit_percentage}% | {self.hijri_display}"
