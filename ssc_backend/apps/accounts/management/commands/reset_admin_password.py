from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "One-time admin password reset"

    def handle(self, *args, **options):
        from apps.accounts.models import User
        try:
            u = User.objects.get(staff_id='S43-0094')
            u.set_password('solace1234')
            u.save()
            self.stdout.write(self.style.SUCCESS('Password reset to solace1234'))
        except User.DoesNotExist:
            self.stderr.write('User S43-0094 not found')
