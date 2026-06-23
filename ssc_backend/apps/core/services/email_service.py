from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class EmailService:
    """Professional email service for SSC Cooperative"""
    
    FROM_EMAIL = settings.DEFAULT_FROM_EMAIL
    FRONTEND_URL = settings.FRONTEND_URL
    
    @classmethod
    def send_password_reset(cls, email: str, reset_link: str, user_name: str = "") -> bool:
        """Send password reset email (banking style)"""
        try:
            html_content = render_to_string('emails/password_reset.html', {
                'reset_link': reset_link,
                'email': email,
                'year': settings.TIME_ZONE.now().year if hasattr(settings, 'TIME_ZONE') else 2026,
                'title': 'Reset Your SSC Cooperative Password'
            })
            
            send_mail(
                subject='Reset Your SSC Cooperative Password',
                message=f'Click the link to reset your password: {reset_link}',
                from_email=cls.FROM_EMAIL,
                recipient_list=[email],
                html_message=html_content,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send password reset email to {email}: {e}")
            return False
    
    @classmethod
    def send_login_alert(cls, email: str, device: str, location: str, time: str) -> bool:
        """Send login alert email"""
        try:
            html_content = render_to_string('emails/login_alert.html', {
                'device': device,
                'location': location,
                'time': time,
                'security_link': f"{cls.FRONTEND_URL}/change-password",
                'year': settings.TIME_ZONE.now().year if hasattr(settings, 'TIME_ZONE') else 2026,
                'title': 'New Login Detected'
            })
            
            send_mail(
                subject='New Login Detected on Your Account',
                message=f'New login from {device} at {location}',
                from_email=cls.FROM_EMAIL,
                recipient_list=[email],
                html_message=html_content,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send login alert to {email}: {e}")
            return False
    
    @classmethod
    def send_loan_status(cls, email: str, status: str, amount: float, duration: int, monthly_repayment: float, message: str = "") -> bool:
        """Send loan status update email"""
        try:
            status_display = {
                'approved': 'Approved ✅',
                'rejected': 'Rejected',
                'pending': 'Under Review',
            }.get(status.lower(), status)
            
            html_content = render_to_string('emails/loan_approval.html', {
                'status': status_display,
                'amount': amount,
                'duration': duration,
                'monthly_repayment': monthly_repayment,
                'message': message or f'Your loan has been {status.lower()}',
                'dashboard_link': f"{cls.FRONTEND_URL}/dashboard",
                'year': settings.TIME_ZONE.now().year if hasattr(settings, 'TIME_ZONE') else 2026,
                'title': f'Loan Application {status_display}'
            })
            
            send_mail(
                subject=f'Loan Application {status_display}',
                message=f'Your loan of ₦{amount} has been {status.lower()}',
                from_email=cls.FROM_EMAIL,
                recipient_list=[email],
                html_message=html_content,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send loan status email to {email}: {e}")
            return False
    
    @classmethod
    def send_savings_update(cls, email: str, amount: float, balance: float, date: str, reference: str) -> bool:
        """Send savings update email"""
        try:
            html_content = render_to_string('emails/savings_update.html', {
                'amount': amount,
                'balance': balance,
                'date': date,
                'reference': reference,
                'dashboard_link': f"{cls.FRONTEND_URL}/my-savings",
                'year': settings.TIME_ZONE.now().year if hasattr(settings, 'TIME_ZONE') else 2026,
                'title': 'Savings Update Confirmation'
            })
            
            send_mail(
                subject='Savings Update Confirmation',
                message=f'Your savings has been updated. New balance: ₦{balance}',
                from_email=cls.FROM_EMAIL,
                recipient_list=[email],
                html_message=html_content,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send savings update to {email}: {e}")
            return False