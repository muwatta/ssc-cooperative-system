import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RequireAuth, RequireRole, GuestOnly } from "./guards";

import AppLayout from "@/components/layout/AppLayout";

import LoginPage from "@/pages/auth/LoginPage";
import SetPasswordPage from "@/pages/auth/SetPasswordPage";
import UnauthorizedPage from "@/pages/auth/UnauthorizedPage";

import DashboardPage from "@/pages/shared/DashboardPage";
import MyProfilePage from "@/pages/shared/MyProfilePage";
import MySavingsPage from "@/pages/shared/MySavingsPage";

import MembersListPage from "@/pages/admin/MembersListPage";
import MemberDetailPage from "@/pages/admin/MemberDetailPage";
import AddMemberPage from "@/pages/admin/AddMemberPage";
import CreateUserPage from "@/pages/admin/CreateUserPage";
import StaffIDRegistryPage from "@/pages/admin/StaffIDRegistryPage";
import PostSavingsPage from "@/pages/admin/PostSavingsPage";
import PostDuesPage from "@/pages/admin/PostDuesPage";
import LoanSettingsPage from "@/pages/admin/LoanSettingsPage";
import LegacyImportPage from "@/pages/admin/LegacyImportPage";

import LoanQueuePage from "@/pages/committee/LoanQueuePage";
import ApplyLoanPage from "@/pages/staff/ApplyLoanPage";
import MyLoansPage from "@/pages/staff/MyLoansPage";
import LoanDetailPage from "@/pages/staff/LoanDetailPage";
import ReportsPage from "@/pages/shared/ReportsPage";
import SavingsChangeRequestsPage from "@/pages/admin/SavingsChangeRequestsPage";

import ComingSoonPage from "@/pages/shared/ComingSoonPage";
import ChangePasswordPage from "@/pages/shared/ChangePasswordPage";

const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/set-password", element: <SetPasswordPage /> },
    ],
  },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // ✅ ADD THIS INDEX ROUTE – makes Dashboard the default page
          { index: true, element: <DashboardPage /> },

          // All roles – explicit paths
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/profile", element: <MyProfilePage /> },
          { path: "/my-savings", element: <MySavingsPage /> },
          { path: "/my-loans", element: <MyLoansPage /> },
          { path: "/loans/apply", element: <ApplyLoanPage /> },
          { path: "/loans/:id", element: <LoanDetailPage /> },
          { path: "/change-password", element: <ChangePasswordPage /> },

          // Admin only
          {
            element: <RequireRole roles={["admin"]} />,
            children: [
              { path: "/members", element: <MembersListPage /> },
              { path: "/members/import", element: <LegacyImportPage /> },
              { path: "/members/add", element: <AddMemberPage /> },
              { path: "/members/:id", element: <MemberDetailPage /> },
              { path: "/users/create", element: <CreateUserPage /> },
              { path: "/staff-ids", element: <StaffIDRegistryPage /> },
              { path: "/loan-settings", element: <LoanSettingsPage /> },
              { path: "/savings/post", element: <PostSavingsPage /> },
              { path: "/savings/dues", element: <PostDuesPage /> },
            ],
          },

          // Admin + Committee
          {
            element: <RequireRole roles={["admin", "committee"]} />,
            children: [
              { path: "/loans/queue", element: <LoanQueuePage /> },
              { path: "/reports", element: <ReportsPage /> },
              {
                path: "/savings/change-requests",
                element: <SavingsChangeRequestsPage />,
              },
            ],
          },

          // Head of School
          {
            element: <RequireRole roles={["head_of_school"]} />,
            children: [
              { path: "/loan-approvals", element: <ComingSoonPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: "/unauthorized", element: <UnauthorizedPage /> },
  { path: "/", element: <LoginPage /> },
  { path: "*", element: <UnauthorizedPage /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
