import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

// Nav item 
interface NavItem {
  label: string;
  to: string;
  icon: string;
}

// Role-based nav items
function useNavItems(): NavItem[] {
  const { isAdmin, isCommittee, isHOS } = useAuth();

  const shared: NavItem[] = [
    { label: "Dashboard", to: "/dashboard", icon: "⊞" },
    { label: "My Savings", to: "/my-savings", icon: "₦" },
    { label: "My Loans", to: "/my-loans", icon: "🏦" },
    { label: "My Profile", to: "/profile", icon: "👤" },
  ];

  const adminItems: NavItem[] = [
    { label: "Members", to: "/members", icon: "👥" },
    { label: "Create User", to: "/users/create", icon: "➕" },
    { label: "Staff IDs", to: "/staff-ids", icon: "🪪" },
    { label: "Post Savings", to: "/savings/post", icon: "📥" },
    { label: "Post Dues", to: "/savings/dues", icon: "📋" },
  ];

  const committeeItems: NavItem[] = [
    { label: "Loan Queue", to: "/loans/queue", icon: "📑" },
    { label: "Reports", to: "/reports", icon: "📊" },
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
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const navItems = useNavItems();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside
        className={clsx(
          "flex flex-col bg-white border-r border-gray-200 transition-all duration-200 shrink-0",
          sidebarOpen ? "w-60" : "w-16",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            S
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-gray-900 truncate">SSC</p>
              <p className="text-xs text-gray-400 truncate">Cooperative</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                )
              }
            >
              <span className="text-base shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-gray-100 p-3">
          {sidebarOpen ? (
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs shrink-0">
                {(user?.full_name || user?.staff_id)?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {user?.full_name || user?.staff_id}
                </p>
                <span className={clsx("badge text-xs mt-0.5", roleBadgeClass)}>
                  {roleLabel}
                </span>
              </div>
            </div>
          ) : null}
          <button
            onClick={handleLogout}
            className={clsx(
              "btn-ghost w-full mt-2 text-xs text-gray-500 justify-start",
              !sidebarOpen && "justify-center px-2",
            )}
          >
            <span>🚪</span>
            {sidebarOpen && "Logout"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-ghost p-2"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary btn-sm px-3 py-2"
              aria-label="Go back"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="btn-primary btn-sm px-3 py-2"
              aria-label="Go forward"
            >
              Next →
            </button>
          </div>
          <div className="flex-1" />
          <span className="text-sm text-gray-500">
            {user?.full_name || user?.staff_id}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
