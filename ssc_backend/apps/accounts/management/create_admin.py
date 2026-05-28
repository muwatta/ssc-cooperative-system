from django.core.management.base import BaseCommand
from apps.accounts.models import StaffIDRegistry, User, MemberProfile
from django.db import transaction

class Command(BaseCommand):
    help = 'Create admin user and staff ID registry'

    @transaction.atomic
    def handle(self, *args, **options):
        staff_id = "S(45)-0001"
        
        # Create registry
        registry, reg_created = StaffIDRegistry.objects.get_or_create(
            staff_id=staff_id,
            defaults={'is_active': True}
        )
        self.stdout.write(f"Registry: {'Created' if reg_created else 'Exists'} - {staff_id}")
        
        # Create user
        user, user_created = User.objects.get_or_create(
            staff_id=staff_id,
            defaults={
                'is_active': True,
                'is_first_login': False,
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True
            }
        )
        
        if user_created:
            user.set_password('AdminPass123!')
            user.save()
            self.stdout.write(self.style.SUCCESS(f"User created: {staff_id}"))
        else:
            self.stdout.write(f"User already exists: {staff_id}")
        
        # Create profile
        profile, prof_created = MemberProfile.objects.get_or_create(
            user=user,
            defaults={
                'file_number': 'A001',
                '_file_sequence': 1,
                'full_name': 'System Administrator',
                'phone_primary': '08000000000',
                'school_branch': 'administration',
                'designation': 'System Admin',
                'date_joined_school': '2024-01-01',
                'membership_status': 'active'
            }
        )
        self.stdout.write(f"Profile: {'Created' if prof_created else 'Exists'} - {profile.file_number}")
        self.stdout.write(self.style.SUCCESS("\n✅ Admin setup complete!"))
        self.stdout.write(f"   Staff ID: {staff_id}")
        self.stdout.write(f"   Password: AdminPass123!")