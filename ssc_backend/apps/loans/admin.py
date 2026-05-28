from django.contrib import admin
from .models import LoanApplication, LoanRepaymentLedger

@admin.register(LoanApplication)
class LoanApplicationAdmin(admin.ModelAdmin):
    list_display  = ["applicant", "amount_applied", "status", "outstanding_balance", "created_at"]
    list_filter   = ["status"]
    search_fields = ["applicant__file_number", "applicant__full_name"]
    readonly_fields = ["created_at", "updated_at"]

@admin.register(LoanRepaymentLedger)
class LoanRepaymentLedgerAdmin(admin.ModelAdmin):
    list_display  = ["loan", "hijri_display", "amount", "balance_after"]
    readonly_fields = ["created_at"]
