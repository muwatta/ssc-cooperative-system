from django.core.mail import send_mail
from django.conf import settings
from django.utils.html import strip_tags
from typing import List, Dict, Any
import os


def send_password_invitation(user, invitation, frontend_url: str = None) -> bool:

    if frontend_url is None:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Build the password-set link
    set_password_url = f"{frontend_url}/set-password?token={invitation.token}&staff_id={user.staff_id}"

    # Email context
    context = {
        "user": user,
        "staff_id": user.staff_id,
        "set_password_url": set_password_url,
        "expires_days": 7,
    }

    # Simple HTML template (in production, use a proper template file)
    html_message = f"""
    <h2>Welcome to SSC Cooperative Management System</h2>
    <p>Dear {user.staff_id},</p>
    <p>You have been invited to join the SSC Cooperative system. Please set your password to get started:</p>
    <p>
        <a href="{set_password_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Set Password
        </a>
    </p>
    <p>Or copy this link: <a href="{set_password_url}">{set_password_url}</a></p>
    <p>This link expires in 7 days.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <hr/>
    <p><small>SSC Cooperative Management System</small></p>
    """

    subject = "SSC Cooperative — Set Your Password"
    text_message = strip_tags(html_message)
    recipient_email = user.email_address

    if not recipient_email:
        return False

    try:
        send_mail(
            subject=subject,
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL or "noreply@SSC.internal",
            recipient_list=[recipient_email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Failed to send invitation email to {user.staff_id}: {e}")
        return False


def send_bulk_invitations(user_ids: List[int], frontend_url: str = None) -> Dict[str, Any]:
    from .models import User, Invitation

    sent_count = 0
    failed_count = 0
    errors = []

    for user_id in user_ids:
        try:
            user = User.objects.get(id=user_id)
            # Create invitation token
            invitation = Invitation.create_for_user(user, expires_in_days=7)

            # Send email
            if send_password_invitation(user, invitation, frontend_url):
                sent_count += 1
            else:
                failed_count += 1
                errors.append({"user_id": user_id, "error": "Email send failed"})
        except Exception as e:
            failed_count += 1
            errors.append({"user_id": user_id, "error": str(e)})

    return {
        "sent": sent_count,
        "failed": failed_count,
        "errors": errors,
    }
