import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { loansApi } from "@/api/services";
import clsx from "clsx";
import DeveloperContactModal from "@/components/common/DeveloperContactModal";

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

function useNavItems(): NavItem[] {
  const { isAdmin, isCommittee, isHOS } = useAuth();

  const shared: NavItem[] = [
    { label: "Dashboard", to: "/dashboard", icon: "⊞" },
    { label: "Savings", to: "/my-savings", icon: "₦" },
    { label: "Loans", to: "/my-loans", icon: "🏦" },
    { label: "Profile", to: "/profile", icon: "👤" },
  ];

  const adminItems: NavItem[] = [
    { label: "Members", to: "/members", icon: "👥" },
    { label: "Create User", to: "/users/create", icon: "➕" },
    { label: "Staff IDs", to: "/staff-ids", icon: "🪪" },
    { label: "Loan Rules", to: "/loan-settings", icon: "⚙️" },
    { label: "Post Savings", to: "/savings/post", icon: "📥" },
    { label: "Post Dues", to: "/savings/dues", icon: "📋" },
    { label: "Special Savings", to: "/special-savings", icon: "🔒" },
    { label: "Reconciliation", to: "/reconciliation", icon: "📊" },
    { label: "Audit Trail", to: "/audit-report", icon: "🕵️" },
  ];

  const committeeItems: NavItem[] = [
    { label: "Loan Queue", to: "/loans/queue", icon: "📑" },
    { label: "Reports", to: "/reports", icon: "📊" },
    { label: "Change Requests", to: "/savings/change-requests", icon: "📝" },
  ];

  const hosItems: NavItem[] = [
    { label: "Loan Approvals", to: "/loan-approvals", icon: "✅" },
    { label: "Reports", to: "/reports", icon: "📊" },
  ];

  if (isAdmin) return [...shared, ...adminItems, ...committeeItems];
  if (isCommittee) return [...shared, ...committeeItems];
  if (isHOS) return [...shared, ...hosItems];
  return shared;
}

export default function AppLayout() {
  const { user, logout, isAdmin, isCommittee } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeveloperModal, setShowDeveloperModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = useNavItems();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const { data: pendingCountData } = useQuery({
    queryKey: ["pending-change-requests-count"],
    queryFn: () =>
      api
        .get<{ count: number }>("/savings/change-requests/pending-count/")
        .then((r) => r.data.count),
    refetchInterval: 30000,
    enabled: isAdmin || isCommittee,
  });
  const pendingCount = pendingCountData ?? 0;

  const { data: pendingLoanCountsData } = useQuery({
    queryKey: ["pending-loan-counts"],
    queryFn: () => loansApi.pendingCount().then((r) => r.data),
    refetchInterval: 30000,
    enabled: isAdmin || isCommittee,
  });
  const pendingLoanCounts = pendingLoanCountsData ?? {};

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileMenuOpen((open) => !open);
      return;
    }
    setSidebarOpen((open) => !open);
  };

  const roleLabel = {
    admin: "Administrator",
    committee: "Committee Member",
    head_of_school: "Head of School",
    staff: "Staff Member",
  }[user?.role ?? "staff"];

  const roleBadgeClass = {
    admin: "badge-primary",
    committee: "badge-warning",
    head_of_school: "badge-success",
    staff: "badge-gray",
  }[user?.role ?? "staff"];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "hidden lg:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 shrink-0",
          sidebarOpen ? "w-72" : "w-20",
        )}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            S
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                SSC
              </p>
              <p className="text-xs text-gray-400 truncate">Cooperative</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                )
              }
            >
              <span className="text-base shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <span className="truncate flex-1">{item.label}</span>
              )}
              {item.to === "/savings/change-requests" && pendingCount > 0 && (
                <span
                  className={clsx(
                    "ml-auto inline-flex items-center justify-center rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white",
                    !sidebarOpen && "ml-0",
                  )}
                >
                  {pendingCount}
                </span>
              )}
              {item.to === "/loans/queue" &&
                (pendingLoanCounts.submitted ||
                  pendingLoanCounts.under_review ||
                  pendingLoanCounts.pending_sureties ||
                  pendingLoanCounts.pending_admin) && (
                  <span
                    className={clsx(
                      "ml-auto inline-flex items-center justify-center rounded-full bg-orange-600 px-2 py-0.5 text-xs font-medium text-white",
                      !sidebarOpen && "ml-0",
                    )}
                  >
                    {(pendingLoanCounts.submitted ?? 0) +
                      (pendingLoanCounts.under_review ?? 0) +
                      (pendingLoanCounts.pending_sureties ?? 0) +
                      (pendingLoanCounts.pending_admin ?? 0)}
                  </span>
                )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3">
          {sidebarOpen ? (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm shrink-0">
                {(user?.full_name || user?.staff_id)?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.full_name || user?.staff_id}
                </p>
                <span className={clsx("badge text-xs mt-1", roleBadgeClass)}>
                  {roleLabel}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm">
                {(user?.full_name || user?.staff_id)?.slice(0, 2).toUpperCase()}
              </div>
            </div>
          )}

          <button
            onClick={() => navigate("/change-password")}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
              !sidebarOpen && "justify-center px-2",
            )}
          >
            <span>🔒</span>
            {sidebarOpen && "Change Password"}
          </button>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
              !sidebarOpen && "justify-center px-2",
            )}
          >
            <span>🚪</span>
            {sidebarOpen && "Logout"}
          </button>

          {/* Developer credit link */}
          <button
            onClick={() => setShowDeveloperModal(true)}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors",
              "text-gray-400 hover:text-primary-600 dark:hover:text-primary-400",
              !sidebarOpen && "justify-center px-2",
            )}
          >
            <span>👨‍💻</span>
            {sidebarOpen && "Built by Abdullahi Musliudeen"}
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex flex-col gap-3 lg:px-6">
          <div className="w-full max-w-screen-2xl mx-auto">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleSidebar}
                  className="btn-ghost p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
                >
                  ☰
                </button>

                <button
                  onClick={handleToggleSidebar}
                  className="btn-ghost p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hidden lg:inline-flex"
                >
                  {sidebarOpen ? "⟨" : "⟩"}
                </button>

                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    SSC Cooperative
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    Quick access to your dashboard and reports
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary btn-sm px-3 py-2"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                className="btn-primary btn-sm px-3 py-2"
              >
                Next →
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <div className="hidden md:flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold truncate">
                    {(user?.full_name || user?.staff_id) ?? "Guest"}
                  </span>
                </div>
                <button
                  onClick={toggleTheme}
                  className="rounded-full bg-gray-100 dark:bg-gray-800 p-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === "light" ? "🌙" : "☀️"}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={clsx(
          "fixed inset-0 z-40 transition-opacity lg:hidden",
          mobileMenuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Mobile sidebar drawer */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-transform duration-200 lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">
                SSC
              </p>
              <p className="text-xs text-gray-400">Cooperative</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="btn-ghost text-gray-700 dark:text-gray-300"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                )
              }
            >
              <span className="text-base">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.to === "/savings/change-requests" && pendingCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white">
                  {pendingCount}
                </span>
              )}
              {item.to === "/loans/queue" &&
                (pendingLoanCounts.submitted ||
                  pendingLoanCounts.under_review ||
                  pendingLoanCounts.pending_sureties ||
                  pendingLoanCounts.pending_admin) && (
                  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-orange-600 px-2 py-0.5 text-xs font-medium text-white">
                    {(pendingLoanCounts.submitted ?? 0) +
                      (pendingLoanCounts.under_review ?? 0) +
                      (pendingLoanCounts.pending_sureties ?? 0) +
                      (pendingLoanCounts.pending_admin ?? 0)}
                  </span>
                )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm">
              {(user?.full_name || user?.staff_id)?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.full_name || user?.staff_id}
              </p>
              <span className={clsx("badge text-xs mt-1", roleBadgeClass)}>
                {roleLabel}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/change-password");
            }}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            🔒 Change Password
          </button>

          <button
            onClick={handleLogout}
            className="w-full rounded-md bg-red-600 px-4 py-2 text-left text-sm font-medium text-white hover:bg-red-700"
          >
            🚪 Logout
          </button>

          {/* Developer credit link in mobile sidebar */}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setShowDeveloperModal(true);
            }}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-left text-xs text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            👨‍💻 Built by Abdullahi Musliudeen
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="card w-full max-w-sm p-6 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Confirm Logout
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to logout? You will need to login again to
              access your account.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button onClick={handleLogout} className="btn-danger px-4 py-2">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Contact Modal */}
      <DeveloperContactModal
        isOpen={showDeveloperModal}
        onClose={() => setShowDeveloperModal(false)}
      />
    </div>
  );
}
