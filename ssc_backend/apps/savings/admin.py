from django.contrib import admin
from .models import SavingsLedger, MemberBalance, SavingsChangeRequest, TermlyDuesCycle

@admin.register(SavingsLedger)
class SavingsLedgerAdmin(admin.ModelAdmin):
    list_display  = ["member", "hijri_display", "entry_type", "credit", "debit", "balance"]
    list_filter   = ["entry_type", "hijri_year"]
    search_fields = ["member__file_number", "member__full_name"]
    readonly_fields = ["balance", "gregorian_date", "created_at"]

@admin.register(MemberBalance)
class MemberBalanceAdmin(admin.ModelAdmin):
    list_display  = ["member", "total_savings", "suretyship_committed", "updated_at"]
    readonly_fields = ["updated_at"]

@admin.register(SavingsChangeRequest)
class SavingsChangeRequestAdmin(admin.ModelAdmin):
    list_display  = ["member", "current_amount", "requested_amount", "status", "submitted_at"]
    list_filter   = ["status"]

@admin.register(TermlyDuesCycle)
class TermlyDuesCycleAdmin(admin.ModelAdmin):
    list_display  = ["name", "amount", "hijri_display", "is_posted", "posted_at"]
    list_filter   = ["is_posted"]
