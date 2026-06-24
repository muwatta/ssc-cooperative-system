from django.contrib import admin
from .models import LoanApplication, LoanConfiguration, LoanRepaymentLedger

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


@admin.register(LoanConfiguration)
class LoanConfigurationAdmin(admin.ModelAdmin):
    list_display = [
        'consecutive_savings_months_required',
        'max_loans_per_year',
        'max_repayment_months',
        'self_surety_ratio',
        'max_borrowable_ratio',
        'external_surety_max_ratio',
        'max_sureties',
        'min_loan_amount',
        'max_loan_amount',
        'require_no_active_loan',
        'require_no_surety_liabilities',
        'reapplication_cooldown_hours',  
    ]
    fieldsets = (
        (None, {
            'fields': (
                'consecutive_savings_months_required',
                'max_loans_per_year',
                'max_repayment_months',
                'self_surety_ratio',
                'max_borrowable_ratio',
                'external_surety_max_ratio',
                'max_sureties',
                'min_loan_amount',
                'max_loan_amount',
                'require_no_active_loan',
                'require_no_surety_liabilities',
                'reapplication_cooldown_hours', 
            )
        }),
    )