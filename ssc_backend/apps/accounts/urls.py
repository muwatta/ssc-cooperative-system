from django.urls import path
from .views import (
    SetInitialPasswordView,
    CreateUserView,
    StaffIDRegistryListCreateView,
    StaffIDRegistryDetailView,
    MemberListCreateView,
    MemberDetailView,
    MemberSummaryListView,
    MyProfileView,
    ApproveMemberView,
    DeactivateMemberView,
)

urlpatterns = [
    # Password setup (first login — no auth required)
    path("set-password/", SetInitialPasswordView.as_view(), name="set-password"),

    # Admin create user
    path("users/", CreateUserView.as_view(), name="user-create"),

    # My own profile
    path("me/", MyProfileView.as_view(), name="my-profile"),

    # Staff ID registry (Admin only)
    path("staff-ids/", StaffIDRegistryListCreateView.as_view(), name="staff-id-list"),
    path("staff-ids/<int:pk>/", StaffIDRegistryDetailView.as_view(), name="staff-id-detail"),

    # Member management
    path("members/", MemberListCreateView.as_view(), name="member-list"),
    path("members/summary/", MemberSummaryListView.as_view(), name="member-summary"),
    path("members/<int:pk>/", MemberDetailView.as_view(), name="member-detail"),
    path("members/<int:pk>/approve/", ApproveMemberView.as_view(), name="member-approve"),
    path("members/<int:pk>/deactivate/", DeactivateMemberView.as_view(), name="member-deactivate"),
]
