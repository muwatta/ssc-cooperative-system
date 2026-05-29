import csv
from typing import IO, Dict, Any, Optional
from django.db import transaction
from datetime import datetime

from .models import User, MemberProfile, generate_file_number
from .models import Role


def _next_staff_id(start_seq: int, template: str = "S{seq:04d}"):
    seq = start_seq
    while True:
        candidate = template.format(seq=seq)
        if not User.objects.filter(staff_id=candidate).exists():
            return candidate, seq
        seq += 1


def import_legacy_members(
    file_obj: IO,
    *,
    start_seq: int = 9000,
    dry_run: bool = False,
    field_map: Optional[Dict[str, str]] = None,
    staff_id_template: str = "S{seq:04d}",
    create_staff_id_registry: bool = False,
):
    """
    Import legacy members from a CSV file-like object.
    CSV must have columns matching MemberProfile fields where possible.

    Returns: dict summary with counts and errors
    """
    reader = csv.DictReader(file_obj)
    created = 0
    skipped = 0
    errors = []
    seq = start_seq
    preview_rows = []

    for idx, row in enumerate(reader, start=1):
        try:
            # collect preview rows
            if len(preview_rows) < 5:
                preview_rows.append(row)

            # apply field mapping if provided
            if field_map:
                mapped = {}
                for target_field, csv_col in field_map.items():
                    mapped[target_field] = row.get(csv_col)
                # make mapped row available as row
                row = mapped
            # Required minimal fields
            full_name = row.get("full_name") or row.get("name")
            phone_primary = row.get("phone_primary") or row.get("phone")
            dob = row.get("date_of_birth")
            school_branch = row.get("school_branch") or row.get("branch")
            designation = row.get("designation") or ""
            date_joined = row.get("date_joined_school") or row.get("date_joined")

            if not (full_name and phone_primary and dob and school_branch and date_joined):
                skipped += 1
                errors.append({"row": idx, "error": "missing required field(s)"})
                continue

            # Parse dates
            try:
                dob_parsed = datetime.strptime(dob, "%Y-%m-%d").date()
            except Exception:
                dob_parsed = datetime.strptime(dob, "%d/%m/%Y").date() if "/" in dob else datetime.strptime(dob, "%Y-%m-%d").date()

            try:
                joined_parsed = datetime.strptime(date_joined, "%Y-%m-%d").date()
            except Exception:
                joined_parsed = datetime.strptime(date_joined, "%d/%m/%Y").date() if "/" in date_joined else datetime.strptime(date_joined, "%Y-%m-%d").date()

            # File number: use provided or generate
            file_number = row.get("file_number")
            if file_number:
                # preserve sequence number if provided (assume format A{num})
                seq_val = None
                try:
                    seq_val = int(file_number.lstrip("A"))
                except Exception:
                    seq_val = None
                _file_sequence = seq_val or None
            else:
                file_number, _file_sequence = generate_file_number()

            # Create user staff_id
            staff_id, seq = _next_staff_id(seq, template=staff_id_template)
            seq += 1

            # Prepare member data
            member_data: Dict[str, Any] = {
                "file_number": file_number,
                "_file_sequence": _file_sequence or 0,
                "full_name": full_name,
                "phone_primary": phone_primary,
                "phone_secondary": row.get("phone_secondary", ""),
                "marital_status": row.get("marital_status", "single"),
                "gender": row.get("gender", "male"),
                "date_of_birth": dob_parsed,
                "place_of_birth": row.get("place_of_birth", ""),
                "school_branch": school_branch,
                "designation": designation,
                "date_joined_school": joined_parsed,
                "monthly_income": row.get("monthly_income") or 0,
                "approved_monthly_contribution": row.get("approved_monthly_contribution") or 0,
                "residential_address": row.get("residential_address", ""),
                "permanent_home_address": row.get("permanent_home_address", ""),
                "email_address": row.get("email_address", ""),
                "social_media_handle": row.get("social_media_handle", ""),
                "state_of_origin": row.get("state_of_origin", ""),
                "local_government_area": row.get("local_government_area", ""),
                "next_of_kin_name": row.get("next_of_kin_name", ""),
                "next_of_kin_address": row.get("next_of_kin_address", ""),
                "next_of_kin_phone": row.get("next_of_kin_phone", ""),
                "next_of_kin_relationship": row.get("next_of_kin_relationship", ""),
                "next_of_kin_place_of_work": row.get("next_of_kin_place_of_work", ""),
                "membership_status": row.get("membership_status", "active"),
                "is_legacy": True,
                "approved_by_name": row.get("approved_by_name", ""),
                "officer_in_charge": row.get("officer_in_charge", ""),
                "approval_date": row.get("approval_date") or None,
                "consecutive_savings_months": row.get("consecutive_savings_months") or 0,
            }

            if dry_run:
                created += 1
                continue

            with transaction.atomic():
                user = User.objects.create(
                    staff_id=staff_id,
                    role=Role.STAFF,
                    is_active=True,
                    is_first_login=True,
                )
                user.set_unusable_password()
                user.save()

                # Optionally add staff id to registry so legacy users can be used to create logins
                if create_staff_id_registry:
                    from .models import StaffIDRegistry

                    StaffIDRegistry.objects.get_or_create(staff_id=staff_id, defaults={"is_active": True, "created_by": None})

                # For approval_date if provided, try parse
                if member_data.get("approval_date"):
                    try:
                        member_data["approval_date"] = datetime.strptime(member_data["approval_date"], "%Y-%m-%d").date()
                    except Exception:
                        member_data["approval_date"] = None

                MemberProfile.objects.create(user=user, **member_data)
                created += 1

        except Exception as e:
            errors.append({"row": idx, "error": str(e)})

    result = {"created": created, "skipped": skipped, "errors": errors}
    if dry_run:
        result["preview"] = preview_rows
    return result
