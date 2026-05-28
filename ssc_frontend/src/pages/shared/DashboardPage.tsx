import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { membersApi, savingsApi } from "@/api/services";
import type { SavingsSummary } from "@/types";

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
    <div className={`card p-5 border ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="text-3xl font-bold mt-1">{value}</p>
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [balances, setBalances] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState("");
  const [balanceError, setBalanceError] = useState("");

  useEffect(() => {
    if (!isAdmin && !isCommittee && !isHOS) return;

    const loadStats = async () => {
      setLoading(true);
      setError("");

      try {
        const [all, active, pending, inactive, exited] = await Promise.all([
          membersApi.list(),
          membersApi.list({ membership_status: "active" }),
          membersApi.list({ membership_status: "pending" }),
          membersApi.list({ membership_status: "inactive" }),
          membersApi.list({ membership_status: "exited" }),
        ]);

        setStats({
          totalMembers: all.data.count,
          activeMembers: active.data.count,
          pendingMembers: pending.data.count,
          inactiveMembers: inactive.data.count,
          exitedMembers: exited.data.count,
        });
      } catch {
        setError(
          "Unable to load dashboard statistics. Please refresh the page.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [isAdmin, isCommittee, isHOS]);

  useEffect(() => {
    const loadBalances = async () => {
      setBalanceLoading(true);
      setBalanceError("");
      try {
        const response = await savingsApi.summary();
        setBalances(response.data);
      } catch {
        setBalanceError("Unable to load balance summary.");
      } finally {
        setBalanceLoading(false);
      }
    };

    loadBalances();
  }, []);

  const isLeadership = isAdmin || isCommittee || isHOS;

  const formatNaira = (value: string | number) => {
    const amount = Number(value);
    return Number.isNaN(amount)
      ? "₦0.00"
      : `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const memberBalance = balances?.member;
  const hasMemberBalance = !!memberBalance;
  const coopSummary = balances?.cooperative;

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome back,{" "}
          <span className="font-medium text-gray-700">
            {user?.full_name || user?.staff_id}
          </span>
        </p>
      </div>

      {isLeadership && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Your Role"
            value={user ? user.role.replace(/_/g, " ").toUpperCase() : "N/A"}
            sub="Access level assigned by Admin"
          />
          <StatCard
            label="Staff ID"
            value={user?.staff_id || "—"}
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
      )}

      {!isLeadership && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Your Role"
            value={user ? user.role.replace(/_/g, " ").toUpperCase() : "N/A"}
            sub="Staff access level"
          />
          <StatCard
            label="Staff ID"
            value={user?.staff_id || "—"}
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
      )}

      {isLeadership && (
        <div className="card p-6 mb-6">
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
            <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
              {error}
            </div>
          )}

          {stats && !loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-4">
              <StatCard
                label="Total Members"
                value={stats.totalMembers}
                sub="All registrations"
              />
              <StatCard
                label="Active"
                value={stats.activeMembers}
                sub="Currently active"
                color="success"
              />
              <StatCard
                label="Pending"
                value={stats.pendingMembers}
                sub="Awaiting approval"
                color="warning"
              />
              <StatCard
                label="Inactive"
                value={stats.inactiveMembers}
                sub="Temporarily inactive"
                color="danger"
              />
              <StatCard
                label="Exited"
                value={stats.exitedMembers}
                sub="Left the cooperative"
                color="primary"
              />
            </div>
          )}
        </div>
      )}

      <div className="card p-6 mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Balance Overview</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your savings balance plus a cooperative summary for all members.
            </p>
          </div>
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
                Member balance not available for this role.
              </div>
            ) : null}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-sm text-gray-500">Your Total Savings</p>
                <p className="text-3xl font-semibold mt-2">
                  {hasMemberBalance
                    ? formatNaira(memberBalance!.total_savings)
                    : "N/A"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Your Available Balance</p>
                <p className="text-3xl font-semibold mt-2">
                  {hasMemberBalance
                    ? formatNaira(memberBalance!.available_balance)
                    : "N/A"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">
                  Cooperative Total Savings
                </p>
                <p className="text-3xl font-semibold mt-2">
                  {coopSummary
                    ? formatNaira(coopSummary.total_savings)
                    : "₦0.00"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">
                  Total Available Across Members
                </p>
                <p className="text-3xl font-semibold mt-2">
                  {coopSummary
                    ? formatNaira(coopSummary.total_available)
                    : "₦0.00"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {!isAdmin && !isCommittee && !isHOS && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold">Your personal dashboard</h2>
          <p className="text-sm text-gray-500 mt-2">
            This page highlights your account access and membership status. For
            full cooperative reports, contact an administrator.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Profile</p>
              <p className="mt-2 text-lg font-semibold">
                View and update your details anytime.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
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
