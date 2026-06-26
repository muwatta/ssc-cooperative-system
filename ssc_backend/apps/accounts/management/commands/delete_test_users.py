from django.core.management.base import BaseCommand
from django.db import transaction
from apps.accounts.models import StaffIDRegistry, User, MemberProfile
from apps.loans.models import LoanApplication
from apps.savings.models import MemberBalance, SavingsLedger
from apps.sureties.models import SuretyRecord

class Command(BaseCommand):
    help = "Delete specific test Staff IDs and all associated records."

    def add_arguments(self, parser):
        parser.add_argument(
            '--staff-ids',
            nargs='+',
            default=['test-0001', 'S43-0094'],
            help='List of Staff IDs to delete (space separated)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompt'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        target_ids = options['staff_ids']
        force = options['force']

        if 'S43-0094' in target_ids:
            self.stdout.write(self.style.WARNING("S43-0094 is the primary admin – skipping it."))
            target_ids = [s for s in target_ids if s != 'S43-0094']

        if not target_ids:
            self.stdout.write(self.style.WARNING("No valid Staff IDs to delete."))
            return

        self.stdout.write(f"Will delete these Staff IDs: {', '.join(target_ids)}")
        if not force:
            confirm = input("Type 'yes' to confirm: ")
            if confirm.lower() != 'yes':
                self.stdout.write("Aborted.")
                return

        for staff_id in target_ids:
            self.stdout.write(f"\nProcessing {staff_id}...")

            try:
                reg = StaffIDRegistry.objects.get(staff_id=staff_id)
            except StaffIDRegistry.DoesNotExist:
                self.stdout.write(f"  → Registry entry not found. Skipping.")
                continue

            try:
                user = User.objects.get(staff_id=staff_id)
            except User.DoesNotExist:
                reg.delete()
                self.stdout.write(f"  → Orphan registry entry deleted (no user).")
                continue

            try:
                profile = user.member_profile
            except MemberProfile.DoesNotExist:
                self.stdout.write(f"  → No member profile for {staff_id}. Cleaning up related records...")
                deleted_savings = SavingsLedger.objects.filter(posted_by=user).delete()
                self.stdout.write(f"    → Deleted {deleted_savings[0]} savings ledger entries.")
                user.delete()
                reg.delete()
                self.stdout.write(f"  → User {staff_id} deleted (no profile). Registry removed.")
                continue

            active_loans = LoanApplication.objects.filter(applicant=profile, status='active')
            if active_loans.exists():
                self.stdout.write(self.style.ERROR(
                    f"  → WARNING: {staff_id} has {active_loans.count()} active loan(s). Skipping."
                ))
                continue

            deleted_savings = SavingsLedger.objects.filter(posted_by=user).delete()
            self.stdout.write(f"    → Deleted {deleted_savings[0]} savings ledger entries posted by this user.")

            MemberBalance.objects.filter(member=profile).delete()
            SuretyRecord.objects.filter(surety=profile).delete()
            SuretyRecord.objects.filter(loan__applicant=profile).delete()
            loans = LoanApplication.objects.filter(applicant=profile)
            loans.delete()

            profile.delete()
            user.delete()
            reg.delete()
            self.stdout.write(self.style.SUCCESS(f"  → Successfully deleted {staff_id}."))

        self.stdout.write(self.style.SUCCESS("\nAll specified test users have been processed."))