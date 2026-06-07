from django.utils import timezone
from .models import AuditLog

def log_action(user, action, object_type, object_id, details=""):
    AuditLog.objects.create(
        user=user,
        action=action,
        object_type=object_type,
        object_id=object_id,
        details=details,
        timestamp=timezone.now()
    )