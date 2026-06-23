import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
        ('accounts', '0012_empty'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_role', models.CharField(blank=True, default='', max_length=50)),
                ('action', models.CharField(choices=[('profile_create', 'Profile Created'), ('profile_update', 'Profile Updated'), ('profile_approve', 'Profile Approved'), ('savings_post', 'Savings Posted'), ('dues_post', 'Dues Posted'), ('loan_apply', 'Loan Applied'), ('loan_approve', 'Loan Approved'), ('loan_reject', 'Loan Rejected'), ('loan_repayment', 'Loan Repayment'), ('surety_confirm', 'Surety Confirmed'), ('surety_decline', 'Surety Declined'), ('user_create', 'User Created'), ('user_approve', 'User Approved'), ('settings_update', 'Settings Updated'), ('other', 'Other Action')], default='other', max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('object_type', models.CharField(max_length=100)),
                ('object_id', models.IntegerField(blank=True, null=True)),
                ('object_name', models.CharField(blank=True, default='', max_length=255)),
                ('old_values', models.JSONField(blank=True, default=dict, null=True)),
                ('new_values', models.JSONField(blank=True, default=dict, null=True)),
                ('request_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='MemberProfileAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('field_name', models.CharField(max_length=100)),
                ('old_value', models.TextField(blank=True, null=True)),
                ('new_value', models.TextField(blank=True, null=True)),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('changed_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='accounts.memberprofile')),
            ],
            options={
                'ordering': ['-changed_at'],
            },
        ),
    ]
