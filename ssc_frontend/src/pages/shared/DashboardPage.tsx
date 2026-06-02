import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import type { MemberProfile, SavingsSummary } from "@/types";

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
      <p className="text-2xl font-bold mt-2">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
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

  const [showBalances, setShowBalances] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("showBalances") !== "false";
  });

  const toggleBalances = () => {
    const nextValue = !showBalances;
    setShowBalances(nextValue);
    localStorage.setItem("showBalances", String(nextValue));
  };

  const memberStatsQuery = useQuery<DashboardStats>({
    queryKey: ["dashboard", "member-stats"],
    queryFn: async () => {
      const [all, active, pending, inactive, exited] = await Promise.all([
        membersApi.list(),
        membersApi.list({ membership_status: "active" }),
        membersApi.list({ membership_status: "pending" }),
        membersApi.list({ membership_status: "inactive" }),
        membersApi.list({ membership_status: "exited" }),
      ]);

      return {
        totalMembers: all.data.count,
        activeMembers: active.data.count,
        pendingMembers: pending.data.count,
        inactiveMembers: inactive.data.count,
        exitedMembers: exited.data.count,
      };
    },
    enabled: isLeadership,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const balanceQuery = useQuery<SavingsSummary>({
    queryKey: ["dashboard", "balances"],
    queryFn: async () => {
      const response = await savingsApi.summary();
      return response.data;
    },
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const meQuery = useQuery<MemberProfile | null>({
    queryKey: ["dashboard", "me"],
    queryFn: async () => {
      const response = await membersApi.me();
      return response.data;
    },
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome back,{" "}
          <span className="font-medium text-gray-700">{displayName}</span>
        </p>
      </div>

      {isLeadership && (
        <div className="card-panel mb-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <StatCard
              label="Your Role"
              value={user ? user.role.replace(/_/g, " ").toUpperCase() : "N/A"}
              sub="Access level assigned by Admin"
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
              sub="Your login identity"
              color="success"
            />
            <StatCard
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

      {isLeadership && (
        <div className="card-panel mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Membership Summary</h2>
              <p className="text-sm text-gray-500">
                Live member counts for your role.
              </p>
            </div>
            {loading && (
              <div className="text-sm text-gray-500">
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="card-panel-light">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                  Total Members
                </p>
                <p className="mt-3 text-2xl font-semibold text-gray-900">
                  {stats.totalMembers}
                </p>
                <p className="text-sm text-gray-500 mt-2">All registrations</p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                  Active Members
                </p>
                <p className="mt-3 text-2xl font-semibold text-green-700">
                  {stats.activeMembers}
                </p>
                <p className="text-sm text-gray-500 mt-2">Currently active</p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                  Pending Members
                </p>
                <p className="mt-3 text-2xl font-semibold text-amber-700">
                  {stats.pendingMembers}
                </p>
                <p className="text-sm text-gray-500 mt-2">Awaiting approval</p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                  Inactive Members
                </p>
                <p className="mt-3 text-2xl font-semibold text-red-700">
                  {stats.inactiveMembers}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Temporarily inactive
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                  Exited Members
                </p>
                <p className="mt-3 text-2xl font-semibold text-primary-700">
                  {stats.exitedMembers}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Left the cooperative
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card-panel mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Balance Overview</h2>
            <button
              onClick={toggleBalances}
              className="text-gray-500 hover:text-gray-700 transition-colors text-xl"
              aria-label={showBalances ? "Hide balances" : "Show balances"}
            >
              {showBalances ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin || isCommittee
              ? "Your savings balance plus a cooperative summary for all members."
              : "Your personal savings balance and contribution details."}
          </p>
          {balanceLoading && (
            <div className="text-sm text-gray-500">Loading balances...</div>
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
            <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Balance Overview
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {isAdmin || isCommittee
                        ? "Your savings balance plus a cooperative summary for all members."
                        : "Your personal savings balance and contribution details."}
                    </p>
                  </div>
                  <button
                    onClick={toggleBalances}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                    aria-label={
                      showBalances ? "Hide balances" : "Show balances"
                    }
                  >
                    {showBalances ? "👁️ Show" : "🙈 Hide"}
                  </button>
                </div>
              </div>

              {balanceError ? (
                <div className="border-t border-gray-100 bg-danger-50 p-4 text-sm text-danger-700">
                  {balanceError}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 px-4 py-2 sm:px-6">
                  <div className="grid gap-3 py-4 sm:grid-cols-2">
                    <div className="card-panel-light">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                        Your Total Savings
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-gray-900">
                        {hasMemberBalance
                          ? maskIfNeeded(
                              formatNaira(memberBalance!.total_savings),
                            )
                          : "N/A"}
                      </p>
                    </div>
                    <div className="card-panel-light">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                        Your Available Balance
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-gray-900">
                        {hasMemberBalance
                          ? maskIfNeeded(
                              formatNaira(memberBalance!.available_balance),
                            )
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 py-4 sm:grid-cols-2">
                    <div className="card-panel-light">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                        Approved Contribution
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-gray-900">
                        {myProfile?.approved_monthly_contribution !== undefined
                          ? maskIfNeeded(
                              formatNaira(
                                myProfile.approved_monthly_contribution,
                              ),
                            )
                          : "N/A"}
                      </p>
                    </div>
                    <div className="card-panel-light">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                        Committed Savings
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-gray-900">
                        {hasMemberBalance
                          ? maskIfNeeded(
                              formatNaira(memberBalance!.suretyship_committed),
                            )
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  {(isAdmin || isCommittee) && (
                    <div className="grid gap-3 py-4 sm:grid-cols-2">
                      <div className="card-panel-light">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                          Cooperative Total Savings
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-gray-900">
                          {coopSummary
                            ? maskIfNeeded(
                                formatNaira(coopSummary.total_savings),
                              )
                            : "₦0.00"}
                        </p>
                      </div>
                      <div className="card-panel-light">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                          Total Available Across Members
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-gray-900">
                          {coopSummary
                            ? maskIfNeeded(
                                formatNaira(coopSummary.total_available),
                              )
                            : "₦0.00"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!isAdmin && !isCommittee && !isHOS && (
        <div className="card-panel mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your personal dashboard</h2>
              <p className="text-sm text-gray-500 mt-2">
                This page highlights your account access and membership status.
                For full cooperative reports, contact an administrator.
              </p>
            </div>
            <span className="badge badge-gray">Staff view</span>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card-panel-light">
              <p className="text-sm text-gray-500">Profile</p>
              <p className="mt-2 text-lg font-semibold">
                View and update your details anytime.
              </p>
            </div>
            <div className="card-panel-light">
              <p className="text-sm text-gray-500">Savings</p>
              <p className="mt-2 text-lg font-semibold">
                Track your contribution records in the savings section.
              </p>
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
