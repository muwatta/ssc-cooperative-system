from datetime import datetime, timedelta
from django.shortcuts import redirect
from django.conf import settings
from django.contrib.auth import logout

class AdminSessionTimeoutMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith(settings.ADMIN_URL) and request.user.is_authenticated:
            # enforce timeout for admin users (role = admin)
            if getattr(request.user, 'role', None) == 'admin':
                last_activity = request.session.get('admin_last_activity')
                now = datetime.now()
                timeout_minutes = getattr(settings, 'ADMIN_SESSION_TIMEOUT_MINUTES', 15)
                if last_activity:
                    if now - last_activity > timedelta(minutes=timeout_minutes):
                        logout(request)
                        return redirect(settings.ADMIN_URL)
                request.session['admin_last_activity'] = now
        return self.get_response(request)