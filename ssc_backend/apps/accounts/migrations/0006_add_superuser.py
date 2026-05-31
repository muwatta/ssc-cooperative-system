from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_superuser(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    StaffIDRegistry = apps.get_model('accounts', 'StaffIDRegistry')

    staff_id = "S43-0001"
    password = "solace1234!"

    StaffIDRegistry.objects.get_or_create(staff_id=staff_id, defaults={'is_active': True})

    # Create superuser
    if not User.objects.filter(staff_id=staff_id).exists():
        User.objects.create(
            staff_id=staff_id,
            password=make_password(password),
            role="admin",
            is_superuser=True,
            is_staff=True,
            is_first_login=False,
        )
        print(f"Superuser {staff_id} created.")
    else:
        print(f"Superuser {staff_id} already exists.")

def reverse_func(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_superuser, reverse_func),
    ]