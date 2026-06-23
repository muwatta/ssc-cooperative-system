# Generated migration for Invitation model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_alter_user_staff_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="Invitation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(help_text="Secure token for password reset link", max_length=64, unique=True)),
                ("email_sent_at", models.DateTimeField(auto_now_add=True)),
                ("email_expires_at", models.DateTimeField(help_text="Token expires at this timestamp")),
                (
                    "status",
                    models.CharField(
                        choices=[("sent", "Sent"), ("opened", "Opened"), ("completed", "Password Set"), ("expired", "Expired")],
                        default="sent",
                        max_length=20,
                    ),
                ),
                ("clicked_at", models.DateTimeField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="invitations", to="accounts.user")),
            ],
            options={
                "verbose_name": "Invitation",
                "verbose_name_plural": "Invitations",
                "db_table": "SSC_invitations",
                "ordering": ["-email_sent_at"],
            },
        ),
    ]
