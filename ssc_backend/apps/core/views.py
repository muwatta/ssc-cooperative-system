from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from datetime import date
from utils.hijri import current_hijri, hijri_month_display


class CurrentDateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        h_month, h_year = current_hijri()
        hijri_display = hijri_month_display(h_month, h_year)
        today = date.today()

        return Response({
            "hijri": {
                "month": h_month,
                "year": h_year,
                "display": hijri_display,
            },
            "gregorian": today.isoformat()
        })
