import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout() {
  const { user, logout, isAdmin, isCommittee, isHOS } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Navigation items based on role
  const getNavItems = () => {
    const baseItems = [
      { label: "Dashboard", path: "/dashboard", icon: "📊" },
      { label: "My Savings", path: "/my-savings", icon: "💰" },
      { label: "My Loans", path: "/my-loans", icon: "📋" },
      { label: "My Profile", path: "/profile", icon: "👤" },
    ];

    const adminCommitteeItems = [
      { label: "Members", path: "/members", icon: "👥", roles: ["admin"] },
      {
        label: "Loan Queue",
        path: "/loans/queue",
        icon: "⏳",
        roles: ["admin", "committee"],
      },
      {
        label: "Reports",
        path: "/reports",
        icon: "📈",
        roles: ["admin", "committee"],
      },
      {
        label: "Loan Settings",
        path: "/loan-settings",
        icon: "⚙️",
        roles: ["admin"],
      },
      {
        label: "Post Savings",
        path: "/savings/post",
        icon: "➕",
        roles: ["admin"],
      },
      {
        label: "Post Dues",
        path: "/savings/dues",
        icon: "💳",
        roles: ["admin"],
      },
    ];

    const hosItems = [
      {
        label: "Loan Approvals",
        path: "/loan-approvals",
        icon: "✅",
        roles: ["head_of_school"],
      },
    ];

    let items = [...baseItems];

    if (isAdmin || isCommittee) {
      items = [
        ...items,
        ...adminCommitteeItems.filter((item) =>
          item.roles.some(
            (r) =>
              (r === "admin" && isAdmin) || (r === "committee" && isCommittee),
          ),
        ),
      ];
    }

    if (isHOS) {
      items = [...items, ...hosItems];
    }

    return items;
  };

  const navItems = getNavItems();

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 font-bold text-lg"
            >
              <span className="w-8 h-8 bg-primary-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                S
              </span>
              <span className="hidden sm:inline text-gray-900">SSC</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {user?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="hidden sm:inline text-sm text-gray-700 font-medium">
                  {user?.staff_id}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b text-sm">
                    <p className="font-medium text-gray-900">
                      {user?.full_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user?.role.replace(/_/g, " ").toUpperCase()}
                    </p>
                  </div>
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    👤 My Profile
                  </Link>
                  <Link
                    to="/change-password"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    🔐 Change Password
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 border-t"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 hidden lg:flex lg:flex-col lg:w-64`}
        >
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(item.path)
                    ? "bg-primary-100 text-primary-600"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-gray-200 text-xs text-gray-500">
            <p>SSC Cooperative v1.2</p>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 lg:hidden z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 overflow-y-auto transition-transform duration-300 z-40 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:hidden`}
        >
          <div className="p-4 border-b flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2 font-bold">
              <span className="w-8 h-8 bg-primary-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                S
              </span>
              <span>SSC</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              ✕
            </button>
          </div>

          <nav className="px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`block px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(item.path)
                    ? "bg-primary-100 text-primary-600"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
