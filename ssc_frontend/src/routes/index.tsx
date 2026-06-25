import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequireRole, GuestOnly } from "./guards";
import AppLayout from "@/components/layout/AppLayout";
import { PageLoader } from "@/components/common";

// Lazy-load all pages
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const SetPasswordPage = lazy(() => import("@/pages/auth/SetPasswordPage"));
const UnauthorizedPage = lazy(() => import("@/pages/auth/UnauthorizedPage"));
const ForgotPasswordPage = lazy(
  () => import("@/pages/auth/ForgotPasswordPage"),
);
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));

const DashboardPage = lazy(() => import("@/pages/shared/DashboardPage"));
const MyProfilePage = lazy(() => import("@/pages/shared/MyProfilePage"));
const MySavingsPage = lazy(() => import("@/pages/shared/MySavingsPage"));
const ReportsPage = lazy(() => import("@/pages/shared/ReportsPage"));
const ChangePasswordPage = lazy(
  () => import("@/pages/shared/ChangePasswordPage"),
);

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
const SavingsChangeRequestsPage = lazy(
  () => import("@/pages/admin/SavingsChangeRequestsPage"),
);

const LoanQueuePage = lazy(() => import("@/pages/committee/LoanQueuePage"));

const ApplyLoanPage = lazy(() => import("@/pages/staff/ApplyLoanPage"));
const MyLoansPage = lazy(() => import("@/pages/staff/MyLoansPage"));
const LoanDetailPage = lazy(() => import("@/pages/staff/LoanDetailPage"));
const LoanSuccessPage = lazy(() => import("@/pages/staff/LoanSuccessPage"));


// Loading fallback
const PageFallback = () => (
  <div className="flex h-full items-center justify-center p-8">
    <PageLoader />
  </div>
);

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
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
                <Route
                  path="/reconciliation"
                  element={<ReconciliationPage />}
                />
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
                <Route path="/loan-approvals" element={<Navigate to="/loans/queue" replace />} />
              </Route>
            </Route>
          </Route>

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<UnauthorizedPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
