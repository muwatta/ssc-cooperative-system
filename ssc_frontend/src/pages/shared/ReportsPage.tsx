import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import { AnimatedCard } from "@/components/common";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type {
  MemberProfile,
  PaginatedResponse,
  SavingsSummary,
  SchoolBranch,
  MembershipStatus,
} from "@/types";
import { HIJRI_MONTHS } from "@/types";

// Utilities
function formatNaira(value: string | number) {
  const amount = Number(value);
  return Number.isNaN(amount)
    ? "₦0.00"
    : `₦${amount.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

// Member Statement Component (inline)
function MemberStatementSection() {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: searchResults } = useQuery({
    queryKey: ["member-search-statement", search],
    queryFn: () => membersApi.summary(search).then((r) => r.data.results ?? []),
    enabled: search.length > 1,
    staleTime: 10000,
  });

  const loadPreview = async (member: any) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await api.get(`/savings/ledger/${member.id}/`, {
        params: { page_size: 20 },
      });
      setPreviewData(res.data.results ?? []);
    } catch {
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const selectMember = (member: any) => {
    setSelectedMember(member);
    setSearch(`${member.file_number} — ${member.full_name}`);
    setShowDropdown(false);
    loadPreview(member);
  };

  const downloadStatement = async (format: "csv" | "pdf") => {
    if (!selectedMember) return;
    setDownloading(true);
    try {
      const res = await api.get(
        `/reports/member-statement/${selectedMember.id}/`,
        {
          params: { format },
          responseType: "blob",
        },
      );
      const mime = format === "pdf" ? "application/pdf" : "text/csv";
      const blob = new Blob([res.data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement_${selectedMember.file_number}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download statement. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const entryTypeLabel = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const entryTypeColor = (type: string) => {
    switch (type) {
      case "ordinary_savings":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
      case "loan_repayment":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
      case "loan_disbursement":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
      case "special_savings":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300";
      case "profit_share":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    }
  };

  return (
    <div className="card-panel p-5">
      <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-1">
        Member Statement
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Search for a member, preview their savings history, then download as CSV
        or PDF.
      </p>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
            if (!e.target.value) {
              setSelectedMember(null);
              setPreviewData(null);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search member by name or file number…"
          className="input w-full"
          aria-label="Search member"
        />
        {showDropdown &&
          searchResults &&
          searchResults.length > 0 &&
          !selectedMember && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
              {searchResults.slice(0, 8).map((m: any) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMember(m)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-3"
                >
                  <span className="font-mono text-primary-600 dark:text-primary-400 text-xs">
                    {m.file_number}
                  </span>
                  <span className="text-gray-800 dark:text-white">
                    {m.full_name}
                  </span>
                  <span className="ml-auto text-xs text-gray-400 capitalize">
                    {m.school_branch}
                  </span>
                </button>
              ))}
            </div>
          )}
      </div>

      {/* Selected member + download */}
      {selectedMember && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
            <div>
              <p className="font-semibold text-primary-800 dark:text-primary-200">
                {selectedMember.full_name}
              </p>
              <p className="text-xs text-primary-600 dark:text-primary-400">
                {selectedMember.file_number} · {selectedMember.school_branch}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadStatement("csv")}
                disabled={downloading}
                className="btn-secondary text-sm px-4 py-2 flex items-center gap-1"
              >
                📥 CSV
              </button>
              <button
                onClick={() => downloadStatement("pdf")}
                disabled={downloading}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-1"
              >
                📄 PDF
              </button>
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setSearch("");
                  setPreviewData(null);
                }}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Preview table */}
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                Loading preview…
              </span>
            </div>
          ) : previewData && previewData.length > 0 ? (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Showing last {previewData.length} entries — download for full
                statement
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Details
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Debit
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Credit
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {entry.hijri_display}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${entryTypeColor(entry.entry_type)}`}
                          >
                            {entryTypeLabel(entry.entry_type)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 max-w-[180px] truncate">
                          {entry.details || "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-medium text-red-600 dark:text-red-400">
                          {entry.debit ? formatNaira(entry.debit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-medium text-green-600 dark:text-green-400">
                          {entry.credit ? formatNaira(entry.credit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-gray-800 dark:text-white">
                          {formatNaira(entry.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : previewData && previewData.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No savings entries found for this member.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// Main ReportsPage
export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [deductionMonth, setDeductionMonth] = useState(1);
  const [deductionYear, setDeductionYear] = useState(1446);
  const { isAdmin } = useAuth();

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

  // Download Monthly Deductions Report
  const downloadMonthlyReport = async () => {
    try {
      const response = await api.get(
        `/reports/monthly-deductions/?hijri_month=${deductionMonth}&hijri_year=${deductionYear}`,
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "text/csv" });
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
            Download the monthly deductions report for HR.
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

      {/* Monthly Deductions Report – Download */}
      <div className="card-panel p-4">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
          Monthly Deductions Report
        </h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="label text-xs">Hijri Month</label>
            <select
              value={deductionMonth}
              onChange={(e) => setDeductionMonth(Number(e.target.value))}
              className="input"
              aria-label="Select Hijri month"
            >
              {HIJRI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Hijri Year</label>
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
          </div>
          <button
            onClick={downloadMonthlyReport}
            className="btn-primary text-sm px-4 py-2 whitespace-nowrap"
          >
            Download CSV
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Export a CSV file with Name, Section, SSC Ordinary Savings, SSC Loan,
          and SSC Special Savings for the selected Hijri month.
        </p>
      </div>

      {/* Member Statement Section */}
      <MemberStatementSection />

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
          {/* Key metrics cards – 3 columns */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Active Members */}
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

            {/* Loan‑Eligible Members */}
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

            {/* Total Savings Pool – Admin only */}
            {isAdmin && (
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
            )}
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

            {/* Desktop Table */}
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

            {/* Mobile Card Layout */}
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
