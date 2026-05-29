from django.core.management.base import BaseCommand, CommandError
from apps.accounts.services import import_legacy_members


class Command(BaseCommand):
    help = 'Import legacy members from CSV file. Usage: python manage.py import_legacy_members <path> [--dry-run] [--start-seq=9000]'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str, help='Path to CSV file to import')
        parser.add_argument('--dry-run', action='store_true', help='Parse CSV and report but do not create records')
        parser.add_argument('--start-seq', type=int, default=9000, help='Starting sequence number for generated staff IDs')
        parser.add_argument('--staff-id-template', type=str, default='S{seq:04d}', help='Template for generated staff IDs, use {seq} placeholder')
        parser.add_argument('--create-registry', action='store_true', help='Create StaffIDRegistry entries for generated staff IDs')
        parser.add_argument('--field-map', type=str, help='JSON string mapping target_field->csv_column')

    def handle(self, *args, **options):
        path = options['csv_path']
        dry_run = options['dry_run']
        start_seq = options['start_seq']

        import json
        field_map = None
        if options.get('field_map'):
            try:
                field_map = json.loads(options.get('field_map'))
            except Exception as e:
                raise CommandError(f"Invalid field_map JSON: {e}")

        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                summary = import_legacy_members(
                    f,
                    start_seq=start_seq,
                    dry_run=dry_run,
                    field_map=field_map,
                    staff_id_template=options.get('staff_id_template'),
                    create_staff_id_registry=options.get('create_registry'),
                )
        except FileNotFoundError:
            raise CommandError(f"File not found: {path}")

        self.stdout.write(self.style.SUCCESS(f"Import summary: Created={summary['created']} Skipped={summary['skipped']} Errors={len(summary['errors'])}"))
        if summary['errors']:
            self.stdout.write("Errors:")
            for e in summary['errors']:
                self.stdout.write(str(e))
