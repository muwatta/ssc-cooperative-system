import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RequireAuth, RequireRole, GuestOnly } from "./guards";

import AppLayout from "@/components/layout/AppLayout";
import { PageLoader } from "@/components/common";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const SetPasswordPage = lazy(() => import("@/pages/auth/SetPasswordPage"));
const UnauthorizedPage = lazy(() => import("@/pages/auth/UnauthorizedPage"));

const DashboardPage = lazy(() => import("@/pages/shared/DashboardPage"));
const MyProfilePage = lazy(() => import("@/pages/shared/MyProfilePage"));
const MySavingsPage = lazy(() => import("@/pages/shared/MySavingsPage"));

const MembersListPage = lazy(() => import("@/pages/admin/MembersListPage"));
const MemberDetailPage = lazy(() => import("@/pages/admin/MemberDetailPage"));
const AddMemberPage = lazy(() => import("@/pages/admin/AddMemberPage"));
const CreateUserPage = lazy(() => import("@/pages/admin/CreateUserPage"));
const StaffIDRegistryPage = lazy(
  () => import("@/pages/admin/StaffIDRegistryPage"),
);
const PostSavingsPage = lazy(() => import("@/pages/admin/PostSavingsPage"));
const PostDuesPage = lazy(() => import("@/pages/admin/PostDuesPage"));
const LoanSettingsPage = lazy(() => import("@/pages/admin/LoanSettingsPage"));
const LegacyImportPage = lazy(() => import("@/pages/admin/LegacyImportPage"));
const ReconciliationPage = lazy(
  () => import("@/pages/admin/ReconciliationPage"),
);
const PostSpecialSavingsPage = lazy(
  () => import("@/pages/admin/PostSpecialSavingsPage"),
);
const AuditReportPage = lazy(() => import("@/pages/admin/AuditReportPage"));
const LoanQueuePage = lazy(() => import("@/pages/committee/LoanQueuePage"));
const ApplyLoanPage = lazy(() => import("@/pages/staff/ApplyLoanPage"));
const MyLoansPage = lazy(() => import("@/pages/staff/MyLoansPage"));
const LoanDetailPage = lazy(() => import("@/pages/staff/LoanDetailPage"));
const LoanSuccessPage = lazy(() => import("@/pages/staff/LoanSuccessPage"));
const ReportsPage = lazy(() => import("@/pages/shared/ReportsPage"));
const SavingsChangeRequestsPage = lazy(
  () => import("@/pages/admin/SavingsChangeRequestsPage"),
);

const ComingSoonPage = lazy(() => import("@/pages/shared/ComingSoonPage"));
const ChangePasswordPage = lazy(
  () => import("@/pages/shared/ChangePasswordPage"),
);

const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      {
        path: "/login",
        element: (
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: "/set-password",
        element: (
          <Suspense fallback={<PageLoader />}>
            <SetPasswordPage />
          </Suspense>
        ),
      },
    ],
  },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: "/dashboard",
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: "/profile",
            element: (
              <Suspense fallback={<PageLoader />}>
                <MyProfilePage />
              </Suspense>
            ),
          },
          {
            path: "/my-savings",
            element: (
              <Suspense fallback={<PageLoader />}>
                <MySavingsPage />
              </Suspense>
            ),
          },
          {
            path: "/my-loans",
            element: (
              <Suspense fallback={<PageLoader />}>
                <MyLoansPage />
              </Suspense>
            ),
          },
          {
            path: "/loans/apply",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ApplyLoanPage />
              </Suspense>
            ),
          },
          {
            path: "/loans/success",
            element: (
              <Suspense fallback={<PageLoader />}>
                <LoanSuccessPage />
              </Suspense>
            ),
          },
          {
            path: "/loans/:id",
            element: (
              <Suspense fallback={<PageLoader />}>
                <LoanDetailPage />
              </Suspense>
            ),
          },
          {
            path: "/change-password",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ChangePasswordPage />
              </Suspense>
            ),
          },

          // Admin only
          {
            element: <RequireRole roles={["admin"]} />,
            children: [
              {
                path: "/members",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <MembersListPage />
                  </Suspense>
                ),
              },
              {
                path: "/members/import",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <LegacyImportPage />
                  </Suspense>
                ),
              },
              {
                path: "/members/add",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <AddMemberPage />
                  </Suspense>
                ),
              },
              {
                path: "/members/:id",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <MemberDetailPage />
                  </Suspense>
                ),
              },
              {
                path: "/users/create",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <CreateUserPage />
                  </Suspense>
                ),
              },
              {
                path: "/staff-ids",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <StaffIDRegistryPage />
                  </Suspense>
                ),
              },
              {
                path: "/loan-settings",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <LoanSettingsPage />
                  </Suspense>
                ),
              },
              {
                path: "/savings/post",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <PostSavingsPage />
                  </Suspense>
                ),
              },
              {
                path: "/savings/dues",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <PostDuesPage />
                  </Suspense>
                ),
              },
              {
                path: "/special-savings",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <PostSpecialSavingsPage />
                  </Suspense>
                ),
              },
                            {
                path: "/reconciliation",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <ReconciliationPage />
                  </Suspense>
                ),
              },
              {
                path: "/audit-report",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <AuditReportPage />
                  </Suspense>
                ),
              },
            ],
          },

          // Admin + Committee
          {
            element: <RequireRole roles={["admin", "committee"]} />,
            children: [
              {
                path: "/loans/queue",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <LoanQueuePage />
                  </Suspense>
                ),
              },
              {
                path: "/reports",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <ReportsPage />
                  </Suspense>
                ),
              },
              {
                path: "/savings/change-requests",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SavingsChangeRequestsPage />
                  </Suspense>
                ),
              },
            ],
          },

          // Head of School
          {
            element: <RequireRole roles={["head_of_school"]} />,
            children: [
              {
                path: "/loan-approvals",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <ComingSoonPage />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
    ],
  },

  {
    path: "/unauthorized",
    element: (
      <Suspense fallback={<PageLoader />}>
        <UnauthorizedPage />
      </Suspense>
    ),
  },
  {
    path: "/",
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "*",
    element: (
      <Suspense fallback={<PageLoader />}>
        <UnauthorizedPage />
      </Suspense>
    ),
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
