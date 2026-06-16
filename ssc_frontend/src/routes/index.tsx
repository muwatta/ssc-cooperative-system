import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequireRole, GuestOnly } from "./guards";
import AppLayout from "@/components/layout/AppLayout";

// Auth pages
import LoginPage from "@/pages/auth/LoginPage";
import SetPasswordPage from "@/pages/auth/SetPasswordPage";
import UnauthorizedPage from "@/pages/auth/UnauthorizedPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

// Shared pages
import DashboardPage from "@/pages/shared/DashboardPage";
import MyProfilePage from "@/pages/shared/MyProfilePage";
import MySavingsPage from "@/pages/shared/MySavingsPage";
import ReportsPage from "@/pages/shared/ReportsPage";
import ChangePasswordPage from "@/pages/shared/ChangePasswordPage";

// Admin pages
import MembersListPage from "@/pages/admin/MembersListPage";
import MemberDetailPage from "@/pages/admin/MemberDetailPage";
import AddMemberPage from "@/pages/admin/AddMemberPage";
import CreateUserPage from "@/pages/admin/CreateUserPage";
import StaffIDRegistryPage from "@/pages/admin/StaffIDRegistryPage";
import PostSavingsPage from "@/pages/admin/PostSavingsPage";
import PostDuesPage from "@/pages/admin/PostDuesPage";
import LoanSettingsPage from "@/pages/admin/LoanSettingsPage";
import LegacyImportPage from "@/pages/admin/LegacyImportPage";
import ReconciliationPage from "@/pages/admin/ReconciliationPage";
import PostSpecialSavingsPage from "@/pages/admin/PostSpecialSavingsPage";
import AuditReportPage from "@/pages/admin/AuditReportPage";
import SavingsChangeRequestsPage from "@/pages/admin/SavingsChangeRequestsPage";

// Committee pages
import LoanQueuePage from "@/pages/committee/LoanQueuePage";

// Staff pages
import ApplyLoanPage from "@/pages/staff/ApplyLoanPage";
import MyLoansPage from "@/pages/staff/MyLoansPage";
import LoanDetailPage from "@/pages/staff/LoanDetailPage";
import LoanSuccessPage from "@/pages/staff/LoanSuccessPage";

// Other
import ComingSoonPage from "@/pages/shared/ComingSoonPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes – no authentication required */}
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
        </Route>

        {/* Public password reset routes (no auth needed) */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/reset-password/:uid/:token"
          element={<ResetPasswordPage />}
        />

        {/* Authenticated routes – require login */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<MyProfilePage />} />
            <Route path="/my-savings" element={<MySavingsPage />} />
            <Route path="/my-loans" element={<MyLoansPage />} />
            <Route path="/loans/apply" element={<ApplyLoanPage />} />
            <Route path="/loans/success" element={<LoanSuccessPage />} />
            <Route path="/loans/:id" element={<LoanDetailPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />

            {/* Admin only */}
            <Route element={<RequireRole roles={["admin"]} />}>
              <Route path="/members" element={<MembersListPage />} />
              <Route path="/members/import" element={<LegacyImportPage />} />
              <Route path="/members/add" element={<AddMemberPage />} />
              <Route path="/members/:id" element={<MemberDetailPage />} />
              <Route path="/users/create" element={<CreateUserPage />} />
              <Route path="/staff-ids" element={<StaffIDRegistryPage />} />
              <Route path="/loan-settings" element={<LoanSettingsPage />} />
              <Route path="/savings/post" element={<PostSavingsPage />} />
              <Route path="/savings/dues" element={<PostDuesPage />} />
              <Route
                path="/special-savings"
                element={<PostSpecialSavingsPage />}
              />
              <Route path="/reconciliation" element={<ReconciliationPage />} />
              <Route path="/audit-report" element={<AuditReportPage />} />
            </Route>

            {/* Admin + Committee */}
            <Route element={<RequireRole roles={["admin", "committee"]} />}>
              <Route path="/loans/queue" element={<LoanQueuePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route
                path="/savings/change-requests"
                element={<SavingsChangeRequestsPage />}
              />
            </Route>

            {/* Head of School */}
            <Route element={<RequireRole roles={["head_of_school"]} />}>
              <Route path="/loan-approvals" element={<ComingSoonPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<UnauthorizedPage />} />
      </Routes>
    </BrowserRouter>
  );
}
