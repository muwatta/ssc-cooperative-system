"""SSC Cooperative — Audit Utilities

Helper functions to log actions throughout the application.
"""

from .models import AuditLog


def log_action(
    user=None,
    action="other",
    description="",
    object_type="",
    object_id=None,
    object_name="",
    old_values=None,
    new_values=None,
    request_ip=None,
):
    """
    Create an audit log entry.

    Args:
        user: User object who performed the action
        action: Action type from AuditLog.ACTION_CHOICES
        description: Human-readable description of what happened
        object_type: Django model name (e.g., 'MemberProfile')
        object_id: Primary key of the affected object
        object_name: Human-readable name of affected object
        old_values: Dict of previous values (for updates)
        new_values: Dict of new values (for updates)
        request_ip: Client IP address if available
    """
    user_role = ""
    if user:
        if hasattr(user, "get_role_display"):
            user_role = user.get_role_display()
        elif hasattr(user, "role"):
            user_role = user.role

    AuditLog.objects.create(
        user=user,
        user_role=user_role,
        action=action,
        description=description,
        object_type=object_type,
        object_id=object_id,
        object_name=object_name,
        old_values=old_values or {},
        new_values=new_values or {},
        request_ip=request_ip,
    )


def get_client_ip(request):
    """Extract client IP from request."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip
