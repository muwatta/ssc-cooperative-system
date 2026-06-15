from django.core.management.base import BaseCommand
from django_otp.plugins.otp_totp.models import TOTPDevice
from django.contrib.auth import get_user_model
import pyotp

class Command(BaseCommand):
    help = 'Generate TOTP secrets for all admin users (run once)'

    def handle(self, *args, **options):
        User = get_user_model()
        admins = User.objects.filter(role='admin')
        if not admins:
            self.stdout.write(self.style.WARNING('No admin users found.'))
            return

        for admin in admins:
            device, created = TOTPDevice.objects.get_or_create(
                user=admin,
                defaults={'key': pyotp.random_base32()}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f"User {admin.staff_id} – Secret key: {device.key}"
                ))
            else:
                self.stdout.write(f"User {admin.staff_id} already has 2FA (device confirmed: {device.confirmed})")