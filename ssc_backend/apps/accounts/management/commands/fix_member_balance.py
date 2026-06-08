from django.core.management.base import BaseCommand
from apps.accounts.models import MemberProfile
from apps.savings.models import MemberBalance
from decimal import Decimal


class Command(BaseCommand):
    help = "Fix corrupted member balance for a specific member"

    def add_arguments(self, parser):
        parser.add_argument("file_number", type=str)
        parser.add_argument("total_savings", type=str)
        parser.add_argument("suretyship_committed", type=str)

    def handle(self, *args, **options):
        try:
            profile = MemberProfile.objects.get(
                file_number=options["file_number"]
            )
            balance = MemberBalance.objects.get(member=profile)
            old_total = balance.total_savings
            old_committed = balance.suretyship_committed

            balance.total_savings = Decimal(options["total_savings"])
            balance.suretyship_committed = Decimal(
                options["suretyship_committed"]
            )
            balance.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Fixed {profile.file_number} ({profile.full_name})\n"
                    f"  total_savings: {old_total} → {balance.total_savings}\n"
                    f"  suretyship_committed: {old_committed} → {balance.suretyship_committed}\n"
                    f"  available_balance: {balance.available_balance}"
                )
            )
        except MemberProfile.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Member not found."))
        except MemberBalance.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Balance record not found."))