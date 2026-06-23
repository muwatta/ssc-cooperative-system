from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Max
from datetime import date

class Command(BaseCommand):
    help = "Seed the initial admin user, member profile, and staff ID registry entry."

    def add_arguments(self, parser):
        parser.add_argument(
            "--staff-id",
            default="S43-0094",
            help="Staff ID for the admin user (default: S43-0094)",
        )
        parser.add_argument(
            "--password",
            default="solace1234",
            help="Password for the admin user (default: solace1234)",
        )
        parser.add_argument(
            "--full-name",
            default="System Admin",
            help="Full name for the admin profile (default: System Admin)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-seed even if the admin user already exists",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.accounts.models import User, MemberProfile, StaffIDRegistry

        staff_id = options["staff_id"]
        password = options["password"]
        full_name = options["full_name"]
        force = options["force"]

        # Check existing
        user_exists = User.objects.filter(staff_id=staff_id).exists()

        if user_exists and not force:
            self.stdout.write(self.style.WARNING(f"Admin user '{staff_id}' already exists. Use --force to recreate."))
            return

        if user_exists and force:
            self.stdout.write(self.style.WARNING(f"--force: removing existing user '{staff_id}'..."))
            user = User.objects.get(staff_id=staff_id)
            MemberProfile.objects.filter(user=user).delete()
            user.delete()
            StaffIDRegistry.objects.filter(staff_id=staff_id).delete()

        # 1. Ensure StaffIDRegistry entry exists
        registry, created = StaffIDRegistry.objects.get_or_create(
            staff_id=staff_id,
            defaults={"is_active": True},
        )
        if not created:
            registry.is_active = True
            registry.save(update_fields=["is_active"])
        self.stdout.write(f"  [1/3] StaffIDRegistry: {'created' if created else 'already exists, ensured active'}")

        # 2. Create superuser
        user = User.objects.create_superuser(staff_id=staff_id, password=password)
        self.stdout.write(f"  [2/3] User '{staff_id}' created (role=admin)")

        # 3. Create MemberProfile
        max_seq = MemberProfile.objects.aggregate(m=Max('_file_sequence'))['m'] or 0
        next_seq = max_seq + 1

        MemberProfile.objects.create(
            user=user,
            file_number=staff_id,
            _file_sequence=next_seq,
            full_name=full_name,
            phone_primary="08000000000",
            marital_status="single",
            gender="male",
            date_of_birth=date(1990, 1, 1),
            place_of_birth="Abuja",
            school_branch="HQ",
            designation="System Administrator",
            date_joined_school=date(2020, 1, 1),
            monthly_income=0,
            residential_address="HQ",
            permanent_home_address="HQ",
            email_address=f"admin@ssc.com",
            state_of_origin="FCT",
            local_government_area="AMAC",
            next_of_kin_name="Admin NOK",
            next_of_kin_address="HQ",
            next_of_kin_phone="08000000001",
            next_of_kin_relationship="sibling",
            membership_status="active",
        )
        self.stdout.write(f"  [3/3] MemberProfile created for '{staff_id}'")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("✓ Admin seeded successfully!"))
        self.stdout.write(f"  Staff ID : {staff_id}")
        self.stdout.write(f"  Password : {password}")
        self.stdout.write(f"  Full Name: {full_name}")