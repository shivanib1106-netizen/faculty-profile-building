import math
import re
from datetime import date, datetime


def validate_email(email):
    """Validate a practical RFC-style email address format."""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$"
    return bool(re.fullmatch(pattern, str(email).strip())) if email else False


def validate_username(username):
    """Allow letters, numbers, dots, underscores and hyphens."""
    if not username:
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9_.-]{3,80}", str(username).strip()))


def validate_password(password, min_length=8):
    """Return (is_valid, message).

    Requires at least one letter and one digit, in addition to the configured
    minimum length.  The rule is deliberately conservative and easy to explain.
    """
    if not isinstance(password, str) or len(password) < min_length:
        return False, f"Password must be at least {min_length} characters long."
    if not re.search(r"[A-Za-z]", password):
        return False, "Password must contain at least one letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    return True, None


def validate_required_fields(data, required_fields):
    """Return (is_valid, list_of_missing_or_blank_fields)."""
    if not isinstance(data, dict):
        return False, ["Invalid payload: expected a JSON object"]
    missing = []
    for field in required_fields:
        value = data.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(field)
    return len(missing) == 0, missing


def parse_date(date_str, field_name="Date"):
    """Parse an ISO date (YYYY-MM-DD). Returns (date, error)."""
    if date_str is None or date_str == "":
        return None, None
    try:
        return datetime.strptime(str(date_str).strip(), "%Y-%m-%d").date(), None
    except ValueError:
        return None, f"Invalid {field_name} format. Expected YYYY-MM-DD."


def parse_int(value, field_name="id", minimum=None):
    """Parse an integer safely. Returns (int, error)."""
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None, f"{field_name} must be an integer."
    if minimum is not None and parsed < minimum:
        return None, f"{field_name} must be at least {minimum}."
    return parsed, None


def validate_number(value, field_name="Number", min_val=None, max_val=None):
    """Validate a finite numeric value and return (float, error)."""
    try:
        number = float(value)
        if not math.isfinite(number):
            return None, f"{field_name} must be a finite number."
        if min_val is not None and number < min_val:
            return None, f"{field_name} must be at least {min_val}."
        if max_val is not None and number > max_val:
            return None, f"{field_name} cannot exceed {max_val}."
        return number, None
    except (ValueError, TypeError):
        return None, f"{field_name} must be a valid number."


def validate_choice(value, allowed, field_name="value"):
    normalized = str(value).strip().upper()
    if normalized not in allowed:
        return None, f"{field_name} must be one of: {', '.join(sorted(allowed))}."
    return normalized, None


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def validate_date_range(start_date, end_date, field_name="date range"):
    if start_date is None or end_date is None:
        return False, f"Both dates are required for {field_name}."
    if isinstance(start_date, date) and isinstance(end_date, date):
        if start_date >= end_date:
            return False, f"{field_name} start_date must be before end_date."
        return True, None
    return False, f"Invalid {field_name}."


def before_today(value, field_name="date"):
    if value and value > date.today():
        return False, f"{field_name} cannot be in the future."
    return True, None
