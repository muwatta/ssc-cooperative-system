from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from datetime import date
from utils.hijri import gregorian_to_hijri, HIJRI_MONTH_NAMES


class CurrentDateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        today = date.today()
        h_day, h_month, h_year = gregorian_to_hijri(today)
        month_name = HIJRI_MONTH_NAMES.get(h_month, f"Month {h_month}")
        hijri_display = f"{h_day} {month_name} {h_year}"

        return Response({
            "hijri": {
                "day": h_day,
                "month": h_month,
                "year": h_year,
                "display": hijri_display,
            },
            "gregorian": today.isoformat(),
        })
