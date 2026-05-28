from hijri_converter import convert
from datetime import date


# ISLAMIC MONTH CONSTANTS
# Stored as integers (1–12) in the DB.
# Displayed as Arabic names in the UI.

HIJRI_MONTHS = [
    (1,  "Muharram"),
    (2,  "Safar"),
    (3,  "Rabi' al-Awwal"),
    (4,  "Rabi' al-Thani"),
    (5,  "Jumada al-Ula"),
    (6,  "Jumada al-Akhira"),
    (7,  "Rajab"),
    (8,  "Sha'ban"),
    (9,  "Ramadan"),
    (10, "Shawwal"),
    (11, "Dhul Qa'da"),
    (12, "Dhul Hijja"),
]

HIJRI_MONTH_NAMES = {num: name for num, name in HIJRI_MONTHS}


def hijri_month_display(month_num: int, year: int) -> str:
    """
    Returns a human-readable string e.g. "Rajab 1443"
    Used for ledger entries, loan schedules, reports.
    """
    name = HIJRI_MONTH_NAMES.get(month_num, f"Month {month_num}")
    return f"{name} {year}"


def current_hijri() -> tuple[int, int]:
    """
    Returns (month, year) of the current Islamic date.
    Used as default when Admin opens a posting form.
    """
    today = date.today()
    hijri = convert.Gregorian(today.year, today.month, today.day).to_hijri()
    return hijri.month, hijri.year


def gregorian_to_hijri(greg_date: date) -> tuple[int, int, int]:
    """
    Convert a Gregorian date to Hijri (day, month, year).
    """
    h = convert.Gregorian(greg_date.year, greg_date.month, greg_date.day).to_hijri()
    return h.day, h.month, h.year


def hijri_to_gregorian(day: int, month: int, year: int) -> date:
    """
    Convert Hijri (day, month, year) to a Python date object.
    Used for computing Gregorian equivalents of Islamic dates.
    """
    g = convert.Hijri(year, month, day).to_gregorian()
    return date(g.year, g.month, g.day)


def validate_hijri_month(month: int, year: int) -> bool:
    """Basic validation — month must be 1-12, year must be positive."""
    return 1 <= month <= 12 and year > 0
