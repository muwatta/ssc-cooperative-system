from decimal import Decimal
from django.db import migrations, models


def create_default_loan_configuration(apps, schema_editor):
    LoanConfiguration = apps.get_model("loans", "LoanConfiguration")
    if not LoanConfiguration.objects.filter(pk=1).exists():
        LoanConfiguration.objects.create(
            id=1,
            consecutive_savings_months_required=12,
            max_loans_per_year=4,
            max_repayment_months=6,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="LoanConfiguration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "consecutive_savings_months_required",
                    models.PositiveSmallIntegerField(
                        default=12,
                        help_text="Number of consecutive savings months required before loan eligibility.",
                    ),
                ),
                (
                    "max_loans_per_year",
                    models.PositiveSmallIntegerField(
                        default=4,
                        help_text="Maximum approved loans per calendar year.",
                    ),
                ),
                (
                    "max_repayment_months",
                    models.PositiveSmallIntegerField(
                        default=6,
                        help_text="Maximum allowed repayment duration in months.",
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "SSC_loan_configuration",
            },
        ),
        migrations.RunPython(create_default_loan_configuration),
    ]
