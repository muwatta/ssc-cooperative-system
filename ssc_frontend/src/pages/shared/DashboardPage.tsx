import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { membersApi, savingsApi } from "@/api/services";
import type { MemberProfile, SavingsSummary } from "@/types";

// Normal StatCard (used in At a Glance, Membership Summary, Balance Overview)
function StatCard({
  label,
  value,
  sub,
  color = "primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    primary: "bg-primary-50 text-primary-700 border-primary-100",
    success: "bg-success-50 text-success-700 border-green-100",
    warning: "bg-warning-50 text-warning-700 border-yellow-100",
    danger: "bg-danger-50 text-danger-700 border-red-100",
  };

  return (
    <div
      className={`card p-4 border ${colorMap[color]} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
        {label}
      </p>
      <p className="text-1xl font-bold mt-2">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

// Compact StatCard (used in the 4‑column leadership grid)
function CompactStatCard({
  label,
  value,
  sub,
  color = "primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    primary: "bg-primary-50 text-primary-700 border-primary-100",
    success: "bg-success-50 text-success-700 border-green-100",
    warning: "bg-warning-50 text-warning-700 border-yellow-100",
    danger: "bg-danger-50 text-danger-700 border-red-100",
  };

  return (
    <div
      className={`card p-1 border ${colorMap[color]} min-w-0 overflow-hidden transition-all`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-70 truncate">
        {label}
      </p>
      <p className="text-sm font-bold mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[9px] mt-0.5 opacity-60 truncate">{sub}</p>}
    </div>
  );
}

type DashboardStats = {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  inactiveMembers: number;
  exitedMembers: number;
};

export default function DashboardPage() {
  const { user, isAdmin, isCommittee, isHOS } = useAuth();
  const isLeadership = isAdmin || isCommittee || isHOS;
  const isAuthenticated = !!user;
  const queryClient = useQueryClient();

  const [showBalances, setShowBalances] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("showBalances") !== "false";
  });

  const [showResetModal, setShowResetModal] = useState(false);

  const toggleBalances = () => {
    const nextValue = !showBalances;
    setShowBalances(nextValue);
    localStorage.setItem("showBalances", String(nextValue));
  };

  // Dashboard Summary (loan stats, pending approvals)
  const { data: dashSummary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get("/dashboard/summary/").then((r) => r.data),
    enabled: isLeadership,
    staleTime: 30000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // Optimised member stats – single API call instead of five
  const memberStatsQuery = useQuery<DashboardStats>({
    queryKey: ["dashboard", "member-stats"],
    queryFn: async () => {
      const counts = await membersApi.counts();
      return {
        totalMembers: counts.total,
        activeMembers: counts.active,
        pendingMembers: counts.pending,
        inactiveMembers: counts.inactive,
        exitedMembers: counts.exited,
      };
    },
    enabled: isLeadership,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  // Financial Snapshot (admin only)
  const { data: financialSnapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ["financial-snapshot"],
    queryFn: () => api.get("/reports/financial-snapshot/").then((r) => r.data),
    enabled: isAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const balanceQuery = useQuery<SavingsSummary>({
    queryKey: ["dashboard", "balances"],
    queryFn: async () => {
      const response = await savingsApi.summary();
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  const meQuery = useQuery<MemberProfile | null>({
    queryKey: ["dashboard", "me"],
    queryFn: async () => {
      const response = await membersApi.me();
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  const stats = memberStatsQuery.data as DashboardStats | undefined;
  const balances = balanceQuery.data as SavingsSummary | undefined;
  const myProfile = meQuery.data;
  const loading = memberStatsQuery.isLoading;
  const balanceLoading = balanceQuery.isLoading || meQuery.isLoading;
  const error = memberStatsQuery.error
    ? "Unable to load dashboard statistics. Please refresh the page."
    : "";
  const balanceError = balanceQuery.error
    ? "Unable to load balance summary."
    : "";

  const formatNaira = (value: string | number) => {
    const amount = Number(value);
    return Number.isNaN(amount)
      ? "₦0.00"
      : `₦${amount.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
  };

  const memberBalance = balances?.member;
  const hasMemberBalance = !!memberBalance;
  const coopSummary = balances?.cooperative;

  const displayName =
    myProfile?.full_name || user?.full_name || user?.staff_id || "Guest";

  const maskIfNeeded = (value: string) => {
    if (!showBalances) return "•••••";
    return value;
  };

  // Extract loan summary from new endpoint
  const pendingAdmin = dashSummary?.pending_admin ?? 0;
  const activeLoans = dashSummary?.active_loans ?? 0;
  const totalOutstanding = dashSummary?.total_outstanding
    ? `₦${Number(dashSummary.total_outstanding).toLocaleString()}`
    : "₦0.00";
  const totalSavingsCoop = dashSummary?.total_savings
    ? `₦${Number(dashSummary.total_savings).toLocaleString()}`
    : "₦0.00";

  const totalSpecialSavings = dashSummary?.total_special_savings
    ? `₦${Number(dashSummary.total_special_savings).toLocaleString()}`
    : "₦0.00";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          👋 Welcome back,{" "}
          <span className="font-medium text-gray-700">{displayName}</span>
        </p>
      </div>

      {/* Loan & Approval snapshot (leadership only) */}
      {isLeadership && dashSummary && (
        <div className="card-panel mb-6 bg-white border p-2 border-gray-200">
          <h2 className="text-lg font-semibold text-center">At a Glance</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              label="Pending Admin Approval"
              value={pendingAdmin}
              color="warning"
            />
            <StatCard
              label="Active Loans"
              value={activeLoans}
              color="primary"
            />
            <StatCard
              label="Total Outstanding"
              value={totalOutstanding}
              color="danger"
            />
            <StatCard
              label="Total Savings Pool"
              value={totalSavingsCoop}
              color="success"
            />
            {isAdmin && (
              <StatCard
                label="🔒 Total Special Savings Locked"
                value={totalSpecialSavings}
                color="primary"
              />
            )}
          </div>
        </div>
      )}

      {/* Upcoming Repayments (leadership) */}
      {isLeadership && dashSummary?.upcoming_repayments?.length > 0 && (
        <div className="card-panel mb-6 bg-white border border-gray-200">
          <h2 className="text-lg font-semibold text-center mt-1">
            Upcoming Repayments (next month)
          </h2>
          <div className="text-sm space-y-1 max-h-48 overflow-y-auto m-3">
            {dashSummary.upcoming_repayments.map((r: any) => (
              <div
                key={r.loan_id}
                className="flex justify-between py-1 border-b border-red-100"
              >
                <span>
                  {r.applicant} (Loan #{r.loan_id})
                </span>
                <span className="font-medium">
                  ₦{Number(r.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leadership profile section – uses CompactStatCard for 4‑column layout */}
      {isLeadership && (
        <div className="card-panel mb-6 bg-primary-50 border-primary-100">
          <div className="flex items-center justify-center">
            <span className="badge badge-primary m-2">Leadership</span>
          </div>
          <div className="grid gap-2 p-2 grid-cols-4 min-w-0">
            <CompactStatCard
              label="Your Role"
              value={user ? user.role.replace(/_/g, " ").toUpperCase() : "N/A"}
              sub="Access level assigned by Admin"
            />
            <CompactStatCard
              label="Full Name"
              value={displayName}
              sub="Your registered name"
              color="primary"
            />
            <CompactStatCard
              label="Staff ID"
              value={user?.staff_id ?? "—"}
              sub="Your login identity"
              color="success"
            />
            <CompactStatCard
              label="Member File"
              value={user?.file_number ?? "Not assigned"}
              sub="SSC membership record"
              color="warning"
            />
          </div>
        </div>
      )}

      {!isLeadership && (
        <div className="card-panel mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="sr-only">Quick Info</h3>
            <span className="badge badge-gray">Member</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Your Role"
              value={user ? user.role.replace(/_/g, " ").toUpperCase() : "N/A"}
              sub="Staff access level"
            />
            <StatCard
              label="Full Name"
              value={displayName}
              sub="Your registered name"
              color="primary"
            />
            <StatCard
              label="Staff ID"
              value={user?.staff_id ?? "—"}
              sub="Used for login"
              color="success"
            />
            <StatCard
              label="Member File"
              value={user?.file_number ?? "Pending"}
              sub="Assigned by Admin"
              color="warning"
            />
          </div>
        </div>
      )}

      {/* Membership Summary */}
      {isLeadership && (
        <div className="card-panel p-2 text-sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-lg font-semibold m-3">Membership Summary</h2>
              <p className="text-sm text-gray-500 m-2">
                Live member counts for your role.
              </p>
            </div>
            {loading && (
              <div className="text-sm text-gray-500 m-2">
                Loading membership stats...
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-3xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
              {error}
            </div>
          )}

          {stats && !loading && !error && (
            <div className="mt-4 grid gap-3 grid-cols-3">
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.24em] text-gray-500">
                  Total Members
                </p>
                <p className="mt-3 text-1xl m-3 font-semibold text-gray-900">
                  {stats.totalMembers}
                </p>
                <p className="text-sm m-3 text-gray-500 mt-2">
                  All registrations
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.24em] text-gray-500">
                  Active Members
                </p>
                <p className="mt-3 m-3 text-1xl font-semibold text-green-700">
                  {stats.activeMembers}
                </p>
                <p className="text-sm m-3 text-gray-500 mt-2">
                  Currently active
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.24em] text-gray-500">
                  Pending Members
                </p>
                <p className="mt-3 m-3 text-1xl font-semibold text-amber-700">
                  {stats.pendingMembers}
                </p>
                <p className="text-sm m-3 text-gray-500 mt-2">
                  Awaiting approval
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.24em] text-gray-500">
                  Inactive Members
                </p>
                <p className="mt-3 text-1xl m-3 font-semibold text-red-700">
                  {stats.inactiveMembers}
                </p>
                <p className="text-sm m-3 text-gray-500 mt-2">
                  Temporarily inactive
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.24em] text-gray-500">
                  Exited Members
                </p>
                <p className="mt-3 m-3 text-1xl font-semibold text-primary-700">
                  {stats.exitedMembers}
                </p>
                <p className="text-sm m-3 text-gray-500 mt-2">
                  Left the cooperative
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Balance Overview */}
      <div className="card-panel mb-6 bg-primary-50 border-primary-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full m-3 bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-800">
              Balance Overview
            </div>
            <button
              onClick={toggleBalances}
              className="text-primary-700 hover:text-primary-900 transition-colors text-xl"
              aria-label={showBalances ? "Hide balances" : "Show balances"}
            >
              {showBalances ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <p className="text-sm m-3 text-primary-700/80 mt-1">
            {isAdmin || isCommittee
              ? "Your savings balance plus a cooperative summary for all members."
              : "Your personal savings balance and contribution details."}
          </p>
          {balanceLoading && (
            <div className="text-sm m-3 text-primary-700/80">
              Loading balances...
            </div>
          )}
        </div>

        {balanceError ? (
          <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
            {balanceError}
          </div>
        ) : (
          <>
            {balances?.member === null && balances ? (
              <div className="mt-4 rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-700">
                ℹ️ No savings profile linked to this account. Personal balance
                will appear here once a member profile is created and linked by
                an administrator.
              </div>
            ) : null}

            <div className="grid gap-3 grid-cols-3 p-2">
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.2em] text-gray-500">
                  Your Total Savings
                </p>
                <p className="mt-3 m-3 text-1xl font-semibold text-gray-900">
                  {hasMemberBalance
                    ? maskIfNeeded(formatNaira(memberBalance!.total_savings))
                    : "N/A"}
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.2em] text-gray-500">
                  Your Available Balance
                </p>
                <p className="mt-3 m-3 text-1xl font-semibold text-gray-900">
                  {hasMemberBalance
                    ? maskIfNeeded(
                        formatNaira(memberBalance!.available_balance),
                      )
                    : "N/A"}
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.2em] text-gray-500">
                  Approved Contribution
                </p>
                <p className="mt-3 m-3 text-1xl font-semibold text-gray-900">
                  {myProfile?.approved_monthly_contribution !== undefined
                    ? maskIfNeeded(
                        formatNaira(myProfile.approved_monthly_contribution),
                      )
                    : "N/A"}
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs m-3 uppercase tracking-[0.2em] text-gray-500">
                  Committed Savings
                </p>
                <p className="mt-3 m-3 text-1xl font-semibold text-gray-900">
                  {hasMemberBalance
                    ? maskIfNeeded(
                        formatNaira(memberBalance!.suretyship_committed),
                      )
                    : "N/A"}
                </p>
              </div>

              {/* Special Fixed Savings Card (member's own) */}
              {hasMemberBalance &&
                Number(memberBalance!.special_savings || 0) > 0 && (
                  <div className="card-panel-light">
                    <p className="text-xs m-3 uppercase tracking-[0.2em] text-gray-500">
                      🔒 Special Fixed Savings
                    </p>
                    <p className="mt-3 m-3 text-1xl font-semibold text-purple-700">
                      {maskIfNeeded(
                        formatNaira(memberBalance!.special_savings || 0),
                      )}
                    </p>
                  </div>
                )}

              {/* Cooperative totals – ADMIN ONLY */}
              {isAdmin && coopSummary && (
                <>
                  <div className="card-panel-light">
                    <p className="text-xs m-3 uppercase tracking-[0.2em] text-gray-500">
                      Cooperative Total Savings
                    </p>
                    <p className="mt-3 m-3 text-1xl font-semibold text-gray-900">
                      {maskIfNeeded(formatNaira(coopSummary.total_savings))}
                    </p>
                  </div>
                  <div className="card-panel-light">
                    <p className="text-xs m-3 uppercase tracking-[0.2em] text-gray-500">
                      Total Available Across Members
                    </p>
                    <p className="mt-3 m-3 text-1xl font-semibold text-gray-900">
                      {maskIfNeeded(formatNaira(coopSummary.total_available))}
                    </p>
                  </div>
                  {(coopSummary as any).total_special_savings &&
                    Number((coopSummary as any).total_special_savings) > 0 && (
                      <div className="card-panel-light">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                          🔒 Total Special Savings (Locked)
                        </p>
                        <p className="mt-3 text-1xl font-semibold text-purple-700">
                          {formatNaira(
                            (coopSummary as any).total_special_savings,
                          )}
                        </p>
                      </div>
                    )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Financial Snapshot – Admin only */}
      {isAdmin && financialSnapshot && financialSnapshot.length > 0 && (
        <div className="card-panel mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              📊 Financial Snapshot
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Active members only
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-right">Total Savings</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-right">Special</th>
                </tr>
              </thead>
              <tbody>
                {snapshotLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-gray-500">
                      Loading snapshot…
                    </td>
                  </tr>
                ) : (
                  financialSnapshot.map((member: any) => (
                    <tr
                      key={member.file_number}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="px-3 py-2 font-mono text-primary-700 dark:text-primary-400">
                        {member.file_number}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {member.full_name}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                        {formatNaira(member.total_savings)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-700 dark:text-emerald-400">
                        {formatNaira(member.available_balance)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-danger-700 dark:text-danger-400">
                        {member.outstanding_loan !== "0.00"
                          ? formatNaira(member.outstanding_loan)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-purple-700 dark:text-purple-400">
                        {member.special_savings !== "0.00"
                          ? formatNaira(member.special_savings)
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isAdmin && !isCommittee && !isHOS && (
        <div className="card-panel mb-6 bg-primary-50 border-primary-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold m-3">
                Your personal dashboard
              </h2>
              <p className="text-sm text-gray-500 mt-2 m-3">
                This page highlights your account access and membership status.
                For full cooperative reports, contact an administrator.
              </p>
            </div>
            <span className="badge badge-gray">Staff view</span>
          </div>
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="card-panel-light">
              <p className="text-sm text-gray-500">Profile</p>
              <p className="mt-2 text-lg m-3 font-semibold">
                View and update your details anytime.
              </p>
            </div>
            <div className="card-panel-light">
              <p className="text-sm text-gray-500">Savings</p>
              <p className="mt-2 m-3 text-lg font-semibold">
                Track your contribution records in the savings section.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pilot Reset Section – Admin Only with Modal */}
      {isAdmin && (
        <div className="card-panel mb-6 bg-red-50 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg m-3 font-semibold text-red-800">
                Pilot Reset
              </h2>
              <p className="text-sm m-3 text-red-600 mt-1">
                Remove all test data and start fresh with only the admin
                account.
              </p>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="bg-red-600 m-3 text-white px-4 py-2 rounded hover:bg-red-700 text-sm font-medium"
            >
              🔄 Reset All Data (Pilot)
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              ⚠️ Reset All Data?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This will <strong>permanently delete</strong> all members, loans,
              savings, sureties, and notifications. Only your admin account
              (S45‑0001) will remain with zero balances. This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 btn-secondary py-2"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowResetModal(false);
                  try {
                    await api.post("/reset-data/");
                    queryClient.invalidateQueries();
                  } catch (e: any) {
                    alert(
                      "Failed to reset data. Please check permissions or try again later.",
                    );
                  }
                }}
                className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 font-medium"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 bg-primary-50 border border-primary-100">
        <p className="text-sm font-medium text-primary-800">
          🕌 SSC uses the Islamic (Hijri) calendar as its primary calendar.
        </p>
        <p className="text-xs text-primary-600 mt-1">
          All savings entries, loan records, and dues are recorded by Islamic
          month and year.
        </p>
      </div>
    </div>
  );
}
