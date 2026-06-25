import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { membersApi, savingsApi, loansApi } from "@/api/services";
import type { MemberProfile, SavingsSummary } from "@/types";
import { Link } from "react-router-dom";
import {
  MembershipDonut,
  LoanStatusDonut,
  FinancialBarChart,
  CoopTotalsChart,
} from "@/components/dashboard/DashboardCharts";

// ─── Stat Cards ────────────────────────────────────────────

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
      className={`card p-3 sm:p-4 border ${colorMap[color]} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
        {label}
      </p>
      <p className="text-lg sm:text-xl font-bold mt-1 sm:mt-2">{value}</p>
      {sub && (
        <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 opacity-60">
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Compact Stat Card ────────────────────────────────────

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
      className={`card p-2 sm:p-3 border ${colorMap[color]} min-w-0 overflow-hidden transition-all`}
    >
      <p className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.2em] opacity-70 truncate">
        {label}
      </p>
      <p className="text-xs sm:text-sm font-bold mt-0.5 truncate">{value}</p>
      {sub && (
        <p className="text-[8px] sm:text-[9px] mt-0.5 opacity-60 truncate">
          {sub}
        </p>
      )}
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

  // Member stats
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

  const { data: myLoans } = useQuery({
    queryKey: ["dashboard", "my-loans"],
    queryFn: async () => {
      const res = await loansApi.mine();
      return res.data?.results || [];
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const stats = memberStatsQuery.data as DashboardStats | undefined;
  const balances = balanceQuery.data as SavingsSummary | undefined;
  const myProfile = meQuery.data;
  const loading = memberStatsQuery.isLoading;
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

  const displayName =
    myProfile?.full_name || user?.full_name || user?.staff_id || "Guest";

  const maskIfNeeded = (value: string) => {
    if (!showBalances) return "•••••";
    return value;
  };

  const totalSavings = memberBalance?.total_savings
    ? Number(memberBalance.total_savings)
    : 0;
  const availableBalance = memberBalance?.available_balance
    ? Number(memberBalance.available_balance)
    : 0;
  const maxBorrowable = Math.max(
    0,
    Math.min(totalSavings * 0.75, availableBalance),
  );

  const outstandingLoan =
    myLoans
      ?.filter((l: any) => l.status === "active")
      .reduce(
        (sum: number, l: any) => sum + parseFloat(l.outstanding_balance),
        0,
      ) || 0;

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
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="page-title text-xl sm:text-2xl">Dashboard</h1>
        <p className="page-subtitle text-sm sm:text-base">
          👋 Welcome back,{" "}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {displayName}
          </span>
        </p>
      </div>

      {/* At a Glance (leadership only) */}
      {isLeadership && dashSummary && (
        <div className="card-panel mb-4 sm:mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold text-center">
            At a Glance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              label="Pending Admin"
              value={pendingAdmin}
              color="warning"
            />
            <StatCard
              label="Active Loans"
              value={activeLoans}
              color="primary"
            />
            {isAdmin && (
              <>
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
                <StatCard
                  label="🔒 Special Savings"
                  value={totalSpecialSavings}
                  color="primary"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Repayments (leadership) - already responsive */}
      {isLeadership && dashSummary?.upcoming_repayments?.length > 0 && (
        <div className="card-panel mb-4 sm:mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-200">
              Upcoming Repayments
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Next {Math.min(dashSummary.upcoming_repayments.length, 5)} of{" "}
              {dashSummary.upcoming_repayments.length}
            </span>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            {dashSummary.upcoming_repayments.slice(0, 5).map((r: any) => (
              <div
                key={r.loan_id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 sm:py-2 px-2 sm:px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 transition hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="text-[10px] sm:text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                    Loan #{r.loan_id}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate max-w-[100px] sm:max-w-[200px]">
                    {r.applicant}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 mt-0.5 sm:mt-0">
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                    ₦{Number(r.amount).toLocaleString()}
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                    {r.due_date
                      ? new Date(r.due_date).toLocaleDateString()
                      : "Soon"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {dashSummary.upcoming_repayments.length > 5 && (
            <div className="mt-2 sm:mt-3 text-center">
              <button
                className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition"
                onClick={() => {
                  /* navigate to repayments page if exists */
                }}
              >
                View all {dashSummary.upcoming_repayments.length} repayments →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leadership profile – responsive 4‑column layout */}
      {isLeadership && (
        <div className="card-panel mb-4 sm:mb-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 p-3 sm:p-4">
          <div className="flex items-center justify-center">
            <span className="badge badge-primary m-1 sm:m-2">Leadership</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <CompactStatCard
              label="Your Role"
              value={user ? user.role.replace(/_/g, " ").toUpperCase() : "N/A"}
              sub="Access level"
            />
            <CompactStatCard
              label="Full Name"
              value={displayName}
              sub="Registered name"
              color="primary"
            />
            <CompactStatCard
              label="Staff ID"
              value={user?.staff_id ?? "—"}
              sub="Login identity"
              color="success"
            />
            <CompactStatCard
              label="Member File"
              value={user?.file_number ?? "Not assigned"}
              sub="SSC record"
              color="warning"
            />
          </div>
        </div>
      )}

      {/* Member view */}
      {!isLeadership && (
        <div className="card-panel mb-4 sm:mb-6 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="sr-only">Quick Info</h3>
            <span className="badge badge-gray">Member</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Your Role"
              value={user ? user.role.replace(/_/g, " ").toUpperCase() : "N/A"}
              sub="Staff access"
            />
            <StatCard
              label="Full Name"
              value={displayName}
              sub="Registered name"
              color="primary"
            />
            <StatCard
              label="Staff ID"
              value={user?.staff_id ?? "—"}
              sub="Login ID"
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

      {/* Membership Summary (leadership) */}
      {isLeadership && (
        <div className="card-panel p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold m-2 sm:m-3">
                Membership Summary
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 m-2 sm:m-3">
                Live member counts for your role.
              </p>
            </div>
            {loading && (
              <div className="text-xs sm:text-sm text-gray-500 m-2">
                Loading...
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          {stats && !loading && !error && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="card-panel-light p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
                  Total Members
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {stats.totalMembers}
                </p>
                <p className="text-[10px] text-gray-500">All registrations</p>
              </div>
              <div className="card-panel-light p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
                  Active
                </p>
                <p className="mt-1 text-lg font-semibold text-green-700">
                  {stats.activeMembers}
                </p>
                <p className="text-[10px] text-gray-500">Currently active</p>
              </div>
              <div className="card-panel-light p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
                  Pending
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-700">
                  {stats.pendingMembers}
                </p>
                <p className="text-[10px] text-gray-500">Awaiting approval</p>
              </div>
              <div className="card-panel-light p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
                  Inactive
                </p>
                <p className="mt-1 text-lg font-semibold text-red-700">
                  {stats.inactiveMembers}
                </p>
                <p className="text-[10px] text-gray-500">
                  Temporarily inactive
                </p>
              </div>
              <div className="card-panel-light p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
                  Exited
                </p>
                <p className="mt-1 text-lg font-semibold text-primary-700">
                  {stats.exitedMembers}
                </p>
                <p className="text-[10px] text-gray-500">Left cooperative</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Charts (Admin only) */}
      {isAdmin && stats && (
        <div className="space-y-4 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
            📊 Analytics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MembershipDonut
              data={{
                active: stats.activeMembers,
                pending: stats.pendingMembers,
                inactive: stats.inactiveMembers,
                exited: stats.exitedMembers,
              }}
            />
            <LoanStatusDonut
              data={{
                submitted: dashSummary?.submitted ?? 0,
                under_review: dashSummary?.under_review ?? 0,
                pending_admin: dashSummary?.pending_admin ?? 0,
                active: dashSummary?.active_loans ?? 0,
                completed: 0,
                rejected: 0,
                defaulted: 0,
              }}
            />
          </div>
          {dashSummary && (
            <CoopTotalsChart
              data={{
                total_savings: dashSummary.total_savings ?? "0",
                total_outstanding: dashSummary.total_outstanding ?? "0",
                total_special_savings: dashSummary.total_special_savings ?? "0",
              }}
            />
          )}
          {financialSnapshot && financialSnapshot.length > 0 && (
            <FinancialBarChart data={financialSnapshot} />
          )}
        </div>
      )}

      {/* Balance Overview */}
      <div className="card-panel mb-4 sm:mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
            💰 Your Balance
          </h2>
          <button
            onClick={toggleBalances}
            className="text-primary-600 hover:text-primary-800 transition-colors text-xs sm:text-sm mt-1 sm:mt-0"
          >
            {showBalances ? "Hide" : "Show"} amounts
          </button>
        </div>

        {balanceError ? (
          <div className="p-3 text-red-600 text-sm">{balanceError}</div>
        ) : (
          <div className="p-2 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Available Balance */}
            <div className="col-span-1 md:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your Available Balance
              </p>
              <p
                className={`text-2xl sm:text-3xl font-bold ${
                  availableBalance < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {hasMemberBalance
                  ? maskIfNeeded(formatNaira(availableBalance))
                  : "—"}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                {availableBalance < 0
                  ? "You currently owe more than you have"
                  : "What you can use right now"}
              </p>
            </div>

            {/* Locked as Surety */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Locked as Surety
              </p>
              <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                {hasMemberBalance
                  ? maskIfNeeded(
                      formatNaira(memberBalance!.suretyship_committed),
                    )
                  : "—"}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                (Guaranteed for others)
              </p>
            </div>

            {/* Outstanding Loan */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Outstanding Loan
              </p>
              <p className="text-base sm:text-xl font-bold text-red-600 dark:text-red-400">
                {hasMemberBalance
                  ? maskIfNeeded(formatNaira(outstandingLoan))
                  : "—"}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                (What you owe)
              </p>
            </div>

            {/* Max Borrowable */}
            <div className="col-span-1 md:col-span-2 bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg mt-1">
              <p className="text-xs sm:text-sm font-medium text-primary-800 dark:text-primary-200">
                Maximum New Loan You Can Apply For
              </p>
              <p
                className={`text-xl sm:text-2xl font-bold ${
                  maxBorrowable > 0
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {hasMemberBalance
                  ? maskIfNeeded(formatNaira(maxBorrowable))
                  : "—"}
              </p>
              <p className="text-[10px] text-primary-600 dark:text-primary-400">
                {maxBorrowable > 0
                  ? "Based on your available balance"
                  : "You cannot borrow more until you repay or reduce commitments"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Surety Details Link */}
      <div className="mt-3 text-sm border-t border-gray-200 dark:border-gray-700 pt-3">
        <Link
          to="/my-loans?tab=sureties"
          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center gap-1"
        >
          🤝 View Surety Details
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      {/* Financial Snapshot Table (Admin only) */}
      {isAdmin && financialSnapshot && financialSnapshot.length > 0 && (
        <div className="card-panel mb-4 sm:mb-6 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between m-2 sm:m-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
              📊 Financial Snapshot
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Active members only
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">
                    File
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">
                    Name
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">
                    Available
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">
                    Surety
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">
                    Outstanding
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">
                    Special
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshotLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-3 text-gray-500">
                      Loading snapshot…
                    </td>
                  </tr>
                ) : (
                  financialSnapshot.map((member: any) => (
                    <tr
                      key={member.file_number}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-primary-700 dark:text-primary-400">
                        {member.file_number}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-medium text-gray-900 dark:text-white">
                        {member.full_name}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right font-medium text-emerald-700 dark:text-emerald-400">
                        {formatNaira(member.available_balance)}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right font-medium text-amber-600 dark:text-amber-400">
                        {member.surety_committed !== "0.00"
                          ? formatNaira(member.surety_committed)
                          : "—"}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right font-medium text-danger-700 dark:text-danger-400">
                        {member.outstanding_loan !== "0.00"
                          ? formatNaira(member.outstanding_loan)
                          : "—"}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right font-medium text-purple-700 dark:text-purple-400">
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

      {/* Staff view message */}
      {!isAdmin && !isCommittee && !isHOS && (
        <div className="card-panel mb-4 sm:mb-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">
                Your personal dashboard
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                This page highlights your account access and membership status.
                For full cooperative reports, contact an administrator.
              </p>
            </div>
            <span className="badge badge-gray self-start sm:self-center">
              Staff view
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="card-panel-light p-3">
              <p className="text-xs sm:text-sm text-gray-500">Profile</p>
              <p className="mt-1 text-sm sm:text-base font-semibold">
                View and update your details anytime.
              </p>
            </div>
            <div className="card-panel-light p-3">
              <p className="text-xs sm:text-sm text-gray-500">Savings</p>
              <p className="mt-1 text-sm sm:text-base font-semibold">
                Track your contribution records in the savings section.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reset Section (Admin only) */}
      {isAdmin && (
        <div className="card-panel mb-4 sm:mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-red-800 dark:text-red-300">
                Pilot Reset
              </h2>
              <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 mt-1">
                Remove all test data and start fresh with only the admin
                account.
              </p>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition self-start sm:self-center"
            >
              🔄 Reset All Data
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
              ⚠️ Reset All Data?
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
              This will <strong>permanently delete</strong> all members, loans,
              savings, sureties, and notifications. Only your admin account
              (S45‑0001) will remain with zero balances. This action cannot be
              undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 btn-secondary py-2 text-sm"
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
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium text-sm"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hijri Calendar Notice */}
      <div className="card p-3 sm:p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
        <p className="text-xs sm:text-sm font-medium text-primary-800 dark:text-primary-200">
          🕌 SSC uses the Islamic (Hijri) calendar as its primary calendar.
        </p>
        <p className="text-[10px] sm:text-xs text-primary-600 dark:text-primary-400 mt-1">
          All savings entries, loan records, and dues are recorded by Islamic
          month and year.
        </p>
      </div>
    </div>
  );
}
