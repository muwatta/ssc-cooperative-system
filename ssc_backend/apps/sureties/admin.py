from django.contrib import admin
from .models import SuretyRecord

@admin.register(SuretyRecord)
class SuretyRecordAdmin(admin.ModelAdmin):
    list_display  = ["loan", "surety", "layer", "amount_guaranteed", "current_liability", "status"]
    list_filter   = ["status", "is_self_surety"]
    search_fields = ["surety__file_number"]
