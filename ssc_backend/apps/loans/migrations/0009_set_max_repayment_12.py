from django.db import migrations

def set_max_repayment(apps, schema_editor):
    LoanConfiguration = apps.get_model('loans', 'LoanConfiguration')
    config = LoanConfiguration.objects.first()
    if config:
        config.max_repayment_months = 12
        config.save()

class Migration(migrations.Migration):
    dependencies = [
        ('loans', '0008_loanconfiguration_external_surety_max_ratio'),  # your latest migration
    ]

    operations = [
        migrations.RunPython(set_max_repayment, reverse_code=migrations.RunPython.noop),
    ]