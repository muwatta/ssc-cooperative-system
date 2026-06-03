import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import { AnimatedCard } from "@/components/common";
import type {
  MemberProfile,
  PaginatedResponse,
  SavingsSummary,
  SchoolBranch,
  MembershipStatus,
} from "@/types";

function formatNaira(value: string | number) {
  const amount = Number(value);
  return Number.isNaN(amount)
    ? "₦0.00"
    : `₦${amount.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: membersPage,
    isLoading: loading,
    isFetching: fetchingMembers,
    error: membersError,
  } = useQuery<PaginatedResponse<MemberProfile>>({
    queryKey: ["reports", "members", { membership_status: "active" }],
    queryFn: async () => {
      const response = await membersApi.list({ membership_status: "active" });
      return response.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const {
    data: savingsSummary,
    isLoading: poolLoading,
    error: poolError,
  } = useQuery<SavingsSummary>({
    queryKey: ["reports", "savings-summary"],
    queryFn: async () => {
      const response = await savingsApi.summary();
      return response.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  const members = membersPage?.results ?? [];
  const activeMemberCount = membersPage?.count ?? 0;
  const error = membersError || poolError ? "Unable to load report data." : "";
  const totalSavingsPool = savingsSummary?.cooperative?.total_savings ?? null;

  // Filter members by search term
  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members;
    const lower = searchTerm.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(lower) ||
        m.file_number.toLowerCase().includes(lower) ||
        m.staff_id.toLowerCase().includes(lower),
    );
  }, [members, searchTerm]);

  const summary = useMemo(() => {
    const statusCounts = {
      active: 0,
      pending: 0,
      inactive: 0,
      exited: 0,
    } as Record<MembershipStatus, number>;
    const branchCounts = {
      primary: 0,
      college: 0,
      other: 0,
    } as Record<SchoolBranch, number>;
    let eligibleCount = 0;
    let totalMonthlyContributions = 0;

    members.forEach((member) => {
      statusCounts[member.membership_status] =
        (statusCounts[member.membership_status] ?? 0) + 1;
      branchCounts[member.school_branch] =
        (branchCounts[member.school_branch] ?? 0) + 1;
      if (member.is_loan_eligible) eligibleCount += 1;
      totalMonthlyContributions += Number(member.approved_monthly_contribution);
    });

    return {
      statusCounts,
      branchCounts,
      eligibleCount,
      totalMonthlyContributions,
    };
  }, [members]);

  const isLoading = loading && !members.length;
  const isRefreshing = fetchingMembers && members.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Reports
          </h1>
          <p className="text-sm text-gray-500">
            Live summary reports based on member data and savings balances.
          </p>
        </div>
        {isRefreshing && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Refreshing...</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-white shadow">
          <div className="text-gray-500">Loading report data...</div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          {error}
        </div>
      ) : (
        <>
          {/* Key metrics cards – 3 columns on desktop, 1 on mobile */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Active Members Card */}
            <AnimatedCard className="group relative overflow-hidden bg-white p-6 shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-2 translate-x-2 rounded-full bg-primary-50 opacity-20 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium text-gray-500">
                Active Members
              </p>
              <p className="mt-2 text-4xl font-bold text-gray-900">
                {activeMemberCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">Total active members</p>
            </AnimatedCard>

            {/* Loan-Eligible Members Card */}
            <AnimatedCard className="group relative overflow-hidden bg-white p-6 shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-2 translate-x-2 rounded-full bg-success-50 opacity-20 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium text-gray-500">
                Loan‑Eligible Members
              </p>
              <p className="mt-2 text-4xl font-bold text-gray-900">
                {summary.eligibleCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Have 6+ consecutive savings months
              </p>
            </AnimatedCard>

            {/* Total Savings Pool Card */}
            <AnimatedCard className="group relative overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100 p-6 shadow-md">
              <div className="absolute right-0 top-0 h-24 w-24 -translate-y-2 translate-x-2 rounded-full bg-primary-200 opacity-30 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium text-primary-800">
                Total Savings Pool
              </p>
              <p className="mt-2 text-4xl font-bold text-primary-900">
                {poolLoading
                  ? "Loading..."
                  : totalSavingsPool !== null
                    ? formatNaira(totalSavingsPool)
                    : "₦0.00"}
              </p>
              <p className="mt-1 text-xs text-primary-700">
                Actual money saved across all members
              </p>
            </AnimatedCard>
          </div>

          {/* Distribution Cards – 2 columns */}
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatedCard className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="text-base font-semibold text-gray-800">
                Membership Status
              </h2>
              <div className="mt-4 space-y-3">
                {Object.entries(summary.statusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <span className="capitalize text-gray-600">{status}</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </AnimatedCard>
            <AnimatedCard className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="text-base font-semibold text-gray-800">
                Branch Distribution
              </h2>
              <div className="mt-4 space-y-3">
                {Object.entries(summary.branchCounts).map(([branch, count]) => (
                  <div
                    key={branch}
                    className="flex items-center justify-between"
                  >
                    <span className="capitalize text-gray-600">{branch}</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </AnimatedCard>
          </div>

          {/* Member Table with Search */}
          <div className="rounded-2xl bg-white shadow-md">
            <div className="border-b border-gray-100 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-gray-800">
                  Active Members List
                </h2>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, file # or staff ID..."
                    className="input pl-9 w-full sm:w-64"
                    aria-label="Search members"
                  />
                </div>
              </div>
            </div>

            {/* Desktop Table (hidden on mobile) */}
            <div className="hidden table-container sm:block">
              <table className="table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3">File No.</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Branch</th>
                    <th className="px-5 py-3">Monthly Contribution</th>
                    <th className="px-5 py-3">Savings Months</th>
                    <th className="px-5 py-3">Loan Eligible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-gray-400"
                      >
                        No members found
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr
                        key={member.id}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="px-5 py-3 font-mono text-sm font-medium text-primary-700">
                          {member.file_number}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">
                          {member.full_name}
                        </td>
                        <td className="px-5 py-3 text-sm capitalize text-gray-700">
                          {member.membership_status}
                        </td>
                        <td className="px-5 py-3 text-sm capitalize text-gray-700">
                          {member.school_branch}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {formatNaira(member.approved_monthly_contribution)}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.consecutive_savings_months >= 6
                                ? "bg-success-100 text-success-800"
                                : "bg-warning-100 text-warning-800"
                            }`}
                          >
                            {member.consecutive_savings_months}/6
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.is_loan_eligible
                                ? "bg-primary-100 text-primary-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {member.is_loan_eligible ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (visible only on small screens) */}
            <div className="space-y-3 p-4 sm:hidden">
              {filteredMembers.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  No members found
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-sm font-semibold text-primary-700">
                          {member.file_number}
                        </p>
                        <p className="mt-1 font-medium text-gray-900">
                          {member.full_name}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          member.membership_status === "active"
                            ? "bg-success-100 text-success-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {member.membership_status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Branch:</span>
                        <p className="capitalize text-gray-700">
                          {member.school_branch}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Contribution:</span>
                        <p className="font-medium">
                          {formatNaira(member.approved_monthly_contribution)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Savings Months:</span>
                        <p
                          className={
                            member.consecutive_savings_months >= 6
                              ? "text-success-700 font-medium"
                              : "text-warning-700"
                          }
                        >
                          {member.consecutive_savings_months}/6
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Loan Eligible:</span>
                        <p
                          className={
                            member.is_loan_eligible
                              ? "text-primary-700 font-medium"
                              : "text-gray-400"
                          }
                        >
                          {member.is_loan_eligible ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
