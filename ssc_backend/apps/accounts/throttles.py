from rest_framework.throttling import UserRateThrottle

class LoginRateThrottle(UserRateThrottle):
    scope = "login"

class InviteRateThrottle(UserRateThrottle):
    scope = "invite"

class ImportRateThrottle(UserRateThrottle):
    scope = "import"

class PasswordChangeRateThrottle(UserRateThrottle):
    scope = "password_change"
