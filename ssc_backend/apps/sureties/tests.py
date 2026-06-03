from datetime import date
from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import (
    User,
    MemberProfile,
    MaritalStatus,
    Gender,
    SchoolBranch,
    MembershipStatus,
)
from apps.notifications.models import Notification, NotificationType
from apps.savings.models import MemberBalance
from apps.loans.models import LoanConfiguration, LoanStatus
from apps.loans.services import submit_loan_application


class SuretyNotificationTests(TestCase):
    def setUp(self):
        # Ensure loan configuration exists for the tests.
        config = LoanConfiguration.get_solo()
        # Ensure max borrowable is larger than self-surety ratio so external
        # sureties may be required in tests (allow up to 100% of available balance).
        config.max_borrowable_ratio = Decimal("1.00")
        config.self_surety_ratio = Decimal("0.75")
        config.save()

        self.borrower_user = User.objects.create_user(staff_id="S26-0001", password="password123")
        self.borrower_profile = MemberProfile.objects.create(
            user=self.borrower_user,
            file_number="A001",
            _file_sequence=1,
            full_name="Borrower One",
            phone_primary="08000000001",
            phone_secondary="",
            marital_status=MaritalStatus.SINGLE,
            gender=Gender.MALE,
            date_of_birth=date(1990, 1, 1),
            place_of_birth="Lagos",
            school_branch=SchoolBranch.PRIMARY,
            designation="Teacher",
            date_joined_school=date(2015, 1, 1),
            monthly_income=Decimal("50000.00"),
            approved_monthly_contribution=Decimal("5000.00"),
            residential_address="123 Main Street",
            permanent_home_address="123 Main Street",
            email_address="borrower@example.com",
            social_media_handle="",
            state_of_origin="Lagos",
            local_government_area="Ikeja",
            next_of_kin_name="Next Kin",
            next_of_kin_address="456 Kin Street",
            next_of_kin_phone="08000000002",
            next_of_kin_relationship="Sibling",
            next_of_kin_place_of_work="School",
            membership_status=MembershipStatus.ACTIVE,
            is_new_member=False,
            consecutive_savings_months=12,
        )
        MemberBalance.objects.create(
            member=self.borrower_profile,
            total_savings=Decimal("2000.00"),
            suretyship_committed=Decimal("0.00"),
        )

        self.surety_user = User.objects.create_user(staff_id="S26-0002", password="password123")
        self.surety_profile = MemberProfile.objects.create(
            user=self.surety_user,
            file_number="A002",
            _file_sequence=2,
            full_name="Surety One",
            phone_primary="08000000003",
            phone_secondary="",
            marital_status=MaritalStatus.SINGLE,
            gender=Gender.FEMALE,
            date_of_birth=date(1992, 2, 2),
            place_of_birth="Abuja",
            school_branch=SchoolBranch.PRIMARY,
            designation="Clerk",
            date_joined_school=date(2016, 2, 2),
            monthly_income=Decimal("45000.00"),
            approved_monthly_contribution=Decimal("4000.00"),
            residential_address="789 Surety Lane",
            permanent_home_address="789 Surety Lane",
            email_address="surety@example.com",
            social_media_handle="",
            state_of_origin="Abuja",
            local_government_area="Gwagwalada",
            next_of_kin_name="Surety Kin",
            next_of_kin_address="101 Kin Road",
            next_of_kin_phone="08000000004",
            next_of_kin_relationship="Friend",
            next_of_kin_place_of_work="Office",
            membership_status=MembershipStatus.ACTIVE,
            is_new_member=False,
            consecutive_savings_months=6,
        )
        MemberBalance.objects.create(
            member=self.surety_profile,
            total_savings=Decimal("2000.00"),
            suretyship_committed=Decimal("0.00"),
        )

    def test_surety_request_notification_includes_applicant_note(self):
        note_text = "Please note this is an urgent salary advance request."
        loan = submit_loan_application(
            member=self.borrower_profile,
            data={
                "home_address": self.borrower_profile.residential_address,
                "phone_numbers": self.borrower_profile.phone_primary,
                "amount_applied": Decimal("1600.00"),
                "purpose": "School supplies",
                "proposed_monthly_repayment": Decimal("266.67"),
                "proposed_duration_months": 6,
                "date_of_last_loan": None,
                "amount_outstanding_prev": Decimal("0.00"),
                "monthly_salary": self.borrower_profile.monthly_income,
                "note": note_text,
            },
            sureties=[
                {
                    "member_id": self.surety_profile.pk,
                    "amount": Decimal("150.00"),
                }
            ],
        )

        self.assertEqual(loan.status, LoanStatus.PENDING_SURETIES)

        notification = Notification.objects.filter(
            recipient=self.surety_user,
            notif_type=NotificationType.SURETY_REQUEST,
            related_id=loan.id,
        ).first()

        self.assertIsNotNone(notification, "Expected a surety request notification for external surety.")
        self.assertIn(note_text, notification.message)
        self.assertIn("has requested your consent as a surety", notification.message)
