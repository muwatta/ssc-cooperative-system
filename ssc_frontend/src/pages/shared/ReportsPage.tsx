import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
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

    members.forEach((member) => {
      statusCounts[member.membership_status] =
        (statusCounts[member.membership_status] ?? 0) + 1;
      branchCounts[member.school_branch] =
        (branchCounts[member.school_branch] ?? 0) + 1;
      if (member.is_loan_eligible) eligibleCount += 1;
    });

    return { statusCounts, branchCounts, eligibleCount };
  }, [members]);

  return (
    <div className="card p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-gray-500">
          Live summary reports based on member data and savings balances.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading report data...</div>
      ) : error ? (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-4">
          {error}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Active Members</p>
              <p className="text-3xl font-semibold mt-2">{activeMemberCount}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Loan-Eligible Members</p>
              <p className="text-3xl font-semibold mt-2">
                {summary.eligibleCount}
              </p>
            </div>
            {/* REAL savings pool — not average */}
            <div className="card p-4 border border-primary-100 bg-primary-50">
              <p className="text-sm text-gray-500">Total Savings Pool</p>
              <p className="text-3xl font-semibold mt-2 text-primary-700">
                {(loading || poolLoading) && fetchingMembers
                  ? "Refreshing..."
                  : poolLoading
                    ? "Loading..."
                    : totalSavingsPool !== null
                      ? formatNaira(totalSavingsPool)
                      : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Actual money saved across all members
              </p>
            </div>
          </div>

          {/* Distribution cards */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Membership Status
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex justify-between">
                  <span>Active</span>
                  <span className="font-medium text-success-700">
                    {summary.statusCounts.active}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Pending</span>
                  <span className="font-medium text-warning-700">
                    {summary.statusCounts.pending}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Inactive</span>
                  <span className="font-medium text-gray-400">
                    {summary.statusCounts.inactive}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Exited</span>
                  <span className="font-medium text-danger-700">
                    {summary.statusCounts.exited}
                  </span>
                </li>
              </ul>
            </div>
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Branch Distribution
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex justify-between">
                  <span>Primary</span>
                  <span className="font-medium">
                    {summary.branchCounts.primary}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>College</span>
                  <span className="font-medium">
                    {summary.branchCounts.college}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Other</span>
                  <span className="font-medium">
                    {summary.branchCounts.other}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Member table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-sm text-gray-500">
                  <th className="px-4 py-3">File No.</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Monthly Contribution</th>
                  <th className="px-4 py-3">Savings Months</th>
                  <th className="px-4 py-3">Loan Eligible</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-primary-700">
                      {member.file_number}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {member.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-700">
                      {member.membership_status}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-700">
                      {member.school_branch}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatNaira(member.approved_monthly_contribution)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          member.consecutive_savings_months >= 6
                            ? "text-success-700 font-medium"
                            : "text-warning-700 font-medium"
                        }
                      >
                        {member.consecutive_savings_months}/6
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          member.is_loan_eligible
                            ? "text-success-700 font-medium"
                            : "text-gray-400"
                        }
                      >
                        {member.is_loan_eligible ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
