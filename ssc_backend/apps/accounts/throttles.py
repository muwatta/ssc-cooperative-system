from rest_framework.throttling import UserRateThrottle

class LoginRateThrottle(UserRateThrottle):
    rate = "5/minute"

class InviteRateThrottle(UserRateThrottle):
    rate = "20/hour"

class ImportRateThrottle(UserRateThrottle):
    rate = "10/hour"

class PasswordChangeRateThrottle(UserRateThrottle):
    rate = "3/minute"