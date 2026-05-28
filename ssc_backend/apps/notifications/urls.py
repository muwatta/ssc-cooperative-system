from django.urls import path
from .views import NotificationListView, UnreadCountView, MarkReadView, MarkAllReadView

urlpatterns = [
    path("",              NotificationListView.as_view(), name="notifications"),
    path("unread-count/", UnreadCountView.as_view(),      name="unread-count"),
    path("<int:pk>/read/", MarkReadView.as_view(),        name="mark-read"),
    path("mark-all-read/", MarkAllReadView.as_view(),     name="mark-all-read"),
]
