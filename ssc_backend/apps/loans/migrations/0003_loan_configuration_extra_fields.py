from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0002_loan_configuration"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanconfiguration",
            name="self_surety_ratio",
            field=models.DecimalField(
                default="0.75",
                help_text="Fraction of available balance a member may borrow.",
                max_digits=4,
                decimal_places=2,
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(1)],
            ),
        ),
        migrations.AddField(
            model_name="loanconfiguration",
            name="max_sureties",
            field=models.PositiveSmallIntegerField(
                default=5,
                help_text="Maximum number of surety members allowed for a loan application.",
            ),
        ),
        migrations.AddField(
            model_name="loanconfiguration",
            name="min_loan_amount",
            field=models.DecimalField(
                default="1000.00",
                help_text="Minimum loan amount allowed.",
                max_digits=12,
                decimal_places=2,
            ),
        ),
        migrations.AddField(
            model_name="loanconfiguration",
            name="max_loan_amount",
            field=models.DecimalField(
                default="0.00",
                help_text="Maximum loan amount allowed. Set 0 for no limit.",
                max_digits=14,
                decimal_places=2,
            ),
        ),
        migrations.AddField(
            model_name="loanconfiguration",
            name="require_no_active_loan",
            field=models.BooleanField(
                default=True,
                help_text="Require members to clear active loans before applying for a new loan.",
            ),
        ),
        migrations.AddField(
            model_name="loanconfiguration",
            name="require_no_surety_liabilities",
            field=models.BooleanField(
                default=True,
                help_text="Require members to have no active surety liabilities before applying.",
            ),
        ),
    ]
