import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import { AnimatedCard } from "@/components/common";
import api from "@/api/client";

import type {
  MemberProfile,
  PaginatedResponse,
  SavingsSummary,
  SchoolBranch,
  MembershipStatus,
} from "@/types";
import { HIJRI_MONTHS } from "@/types";

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
  const [selectedMemberId, setSelectedMemberId] = useState("");

  // Monthly deduction report state
  const [deductionMonth, setDeductionMonth] = useState(1);
  const [deductionYear, setDeductionYear] = useState(1446); // default to some year

  // Fetch current Hijri date to pre‑fill the deduction month/year
  const { data: currentDate } = useQuery({
    queryKey: ["current-date"],
    queryFn: () => api.get("/date/").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (currentDate?.hijri) {
      setDeductionMonth(currentDate.hijri.month);
      setDeductionYear(currentDate.hijri.year);
    }
  }, [currentDate]);

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

  // Filter members by search term for the table only
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

  // Export Handlers
  const exportMemberStatement = (format: "csv" | "pdf") => {
    const id = selectedMemberId;
    if (!id) return alert("Please select a member from the list.");
    window.open(
      `/api/v1/reports/member-statement/${id}/?format=${format}`,
      "_blank",
    );
  };

  const exportLoanBook = (format: "csv" | "pdf") => {
    window.open(`/api/v1/reports/loan-book/?format=${format}`, "_blank");
  };

  const exportSuretyExposure = () => {
    window.open(`/api/v1/reports/surety-exposure/?format=csv`, "_blank");
  };

  const downloadMonthlyReport = async () => {
    const token = localStorage.getItem("ssc_access");
    if (!token) {
      alert("You are not logged in. Please log in again.");
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/reports/monthly-deductions/?hijri_month=${deductionMonth}&hijri_year=${deductionYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          alert("Session expired. Please log in again.");
          return;
        }
        throw new Error("Failed to download report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monthly_report_${deductionMonth}_${deductionYear}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download the report. Please try again.");
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Live summary reports based on member data and savings balances.
          </p>
        </div>
        {isRefreshing && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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

      {/* Export Buttons Section */}
      <div className="card-panel p-2">
        <h2 className="text-base m-2 font-semibold text-gray-800 dark:text-white mb-3">
          Export Reports
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Member Statement */}
          <div className="flex-1 min-w-[220px]">
            <label className="label text-xs">Member Statement</label>
            <div className="flex gap-2">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="input flex-1"
                title="Select member"
              >
                <option value="">-- Select a member --</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.file_number} – {member.full_name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => exportMemberStatement("csv")}
                className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
              >
                CSV
              </button>
              <button
                onClick={() => exportMemberStatement("pdf")}
                className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
              >
                PDF
              </button>
            </div>
          </div>

          {/* Loan Book Report */}
          <div className="flex-1 min-w-[150px]">
            <label className="label text-xs">Loan Book Report</label>
            <div className="flex gap-2">
              <button
                onClick={() => exportLoanBook("csv")}
                className="btn-secondary text-xs px-3 py-1.5 flex-1"
              >
                CSV
              </button>
              <button
                onClick={() => exportLoanBook("pdf")}
                className="btn-secondary text-xs px-3 py-1.5 flex-1"
              >
                PDF
              </button>
            </div>
          </div>

          {/* Surety Exposure Report */}
          <div className="flex-1 min-w-[150px]">
            <label className="label text-xs">Surety Exposure Report</label>
            <div className="flex gap-2">
              <button
                onClick={exportSuretyExposure}
                className="btn-secondary text-xs px-3 py-1.5 flex-1"
              >
                CSV
              </button>
            </div>
          </div>

          {/* Monthly Deductions Report */}
          <div className="flex-1 min-w-[220px]">
            <label className="label text-xs">Monthly Deductions Report</label>
            <div className="flex flex-wrap gap-2">
              <select
                value={deductionMonth}
                onChange={(e) => setDeductionMonth(Number(e.target.value))}
                className="input flex-1 min-w-[100px]"
                aria-label="Select Hijri month"
              >
                {HIJRI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={deductionYear}
                onChange={(e) => setDeductionYear(Number(e.target.value))}
                className="input w-24"
                min={1400}
                max={1500}
                step={1}
                aria-label="Enter Hijri year"
              />
              <button
                onClick={downloadMonthlyReport}
                className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-white dark:bg-gray-800 shadow">
          <div className="text-gray-500 dark:text-gray-400">
            Loading report data...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
          {error}
        </div>
      ) : (
        <>
          {/* Key metrics cards – 3 columns on desktop, 1 on mobile */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatedCard className="group relative overflow-hidden bg-white dark:bg-gray-800 p-6 shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-2 translate-x-2 rounded-full bg-primary-50 dark:bg-primary-900/30 opacity-20 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Active Members
              </p>
              <p className="mt-2 text-4xl font-bold text-gray-900 dark:text-white">
                {activeMemberCount}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Total active members
              </p>
            </AnimatedCard>

            <AnimatedCard className="group relative overflow-hidden bg-white dark:bg-gray-800 p-6 shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-2 translate-x-2 rounded-full bg-success-50 dark:bg-success-900/30 opacity-20 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Loan‑Eligible Members
              </p>
              <p className="mt-2 text-4xl font-bold text-gray-900 dark:text-white">
                {summary.eligibleCount}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Have 6+ consecutive savings months
              </p>
            </AnimatedCard>

            <AnimatedCard className="group relative overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/40 dark:to-gray-800 p-6 shadow-md">
              <div className="absolute right-0 top-0 h-24 w-24 -translate-y-2 translate-x-2 rounded-full bg-primary-200 dark:bg-primary-800/50 opacity-30 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
                Total Savings Pool
              </p>
              <p className="mt-2 text-4xl font-bold text-primary-900 dark:text-white">
                {poolLoading
                  ? "Loading..."
                  : totalSavingsPool !== null
                    ? formatNaira(totalSavingsPool)
                    : "₦0.00"}
              </p>
              <p className="mt-1 text-xs text-primary-700 dark:text-primary-300">
                Actual money saved across all members
              </p>
            </AnimatedCard>
          </div>

          {/* Distribution Cards – 2 columns */}
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatedCard className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md">
              <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                Membership Status
              </h2>
              <div className="mt-4 space-y-3">
                {Object.entries(summary.statusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <span className="capitalize text-gray-600 dark:text-gray-300">
                      {status}
                    </span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </AnimatedCard>
            <AnimatedCard className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md">
              <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                Branch Distribution
              </h2>
              <div className="mt-4 space-y-3">
                {Object.entries(summary.branchCounts).map(([branch, count]) => (
                  <div
                    key={branch}
                    className="flex items-center justify-between"
                  >
                    <span className="capitalize text-gray-600 dark:text-gray-300">
                      {branch}
                    </span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </AnimatedCard>
          </div>

          {/* Member Table with Search */}
          <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-md">
            <div className="border-b border-gray-100 dark:border-gray-700 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                  Active Members List
                </h2>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
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
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">File No.</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Branch</th>
                    <th className="px-5 py-3">Monthly Contribution</th>
                    <th className="px-5 py-3">Savings Months</th>
                    <th className="px-5 py-3">Loan Eligible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-gray-400 dark:text-gray-500"
                      >
                        No members found
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr
                        key={member.id}
                        className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-5 py-3 font-mono text-sm font-medium text-primary-700 dark:text-primary-400">
                          {member.file_number}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {member.full_name}
                        </td>
                        <td className="px-5 py-3 text-sm capitalize text-gray-700 dark:text-gray-300">
                          {member.membership_status}
                        </td>
                        <td className="px-5 py-3 text-sm capitalize text-gray-700 dark:text-gray-300">
                          {member.school_branch}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {formatNaira(member.approved_monthly_contribution)}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.consecutive_savings_months >= 6
                                ? "bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-300"
                                : "bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-300"
                            }`}
                          >
                            {member.consecutive_savings_months}/6
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.is_loan_eligible
                                ? "bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
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
                <div className="py-12 text-center text-gray-400 dark:text-gray-500">
                  No members found
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-sm font-semibold text-primary-700 dark:text-primary-400">
                          {member.file_number}
                        </p>
                        <p className="mt-1 font-medium text-gray-900 dark:text-white">
                          {member.full_name}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          member.membership_status === "active"
                            ? "bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {member.membership_status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Branch:
                        </span>
                        <p className="capitalize text-gray-700 dark:text-gray-300">
                          {member.school_branch}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Contribution:
                        </span>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatNaira(member.approved_monthly_contribution)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Savings Months:
                        </span>
                        <p
                          className={
                            member.consecutive_savings_months >= 6
                              ? "text-success-700 dark:text-success-400 font-medium"
                              : "text-warning-700 dark:text-warning-400"
                          }
                        >
                          {member.consecutive_savings_months}/6
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Loan Eligible:
                        </span>
                        <p
                          className={
                            member.is_loan_eligible
                              ? "text-primary-700 dark:text-primary-400 font-medium"
                              : "text-gray-400 dark:text-gray-500"
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
