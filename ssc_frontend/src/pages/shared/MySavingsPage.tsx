import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import { AnimatedCard } from "@/components/common";
import type { MemberBalance, MemberProfile } from "@/types";
import { HIJRI_MONTHS } from "@/types";

function formatCurrency(value: string | number) {
  const amount = Number(value);
  return Number.isNaN(amount)
    ? "₦0.00"
    : `₦${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

export default function MySavingsPage() {
  // Filters & pagination state
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    hijri_month: "",
    hijri_year: "",
    date_from: "",
    date_to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    hijri_month: "",
    hijri_year: "",
    date_from: "",
    date_to: "",
  });

  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestError, setRequestError] = useState("");

  // Profile
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery<MemberProfile | null>({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const res = await membersApi.me();
      return res.data;
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const profileMissing = profile === null && !profileLoading && !profileError;

  // Balance
  const { data: balance } = useQuery<
    MemberBalance & { reserved_for_investment?: string }
  >({
    queryKey: ["my-balance", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const res = await savingsApi.getBalance(profile!.id);
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  // Ledger
  const ledgerParams: Record<string, string | number> = { page };
  if (appliedFilters.hijri_month)
    ledgerParams.hijri_month = Number(appliedFilters.hijri_month);
  if (appliedFilters.hijri_year)
    ledgerParams.hijri_year = Number(appliedFilters.hijri_year);
  if (appliedFilters.date_from)
    ledgerParams.date_from = appliedFilters.date_from;
  if (appliedFilters.date_to) ledgerParams.date_to = appliedFilters.date_to;

  const { data: ledgerResponse, isFetching: ledgerFetching } = useQuery({
    queryKey: ["my-ledger", profile?.id, ledgerParams],
    enabled: !!profile?.id,
    queryFn: async () => {
      const res = await savingsApi.getLedger(profile!.id, ledgerParams);
      return res.data;
    },
    staleTime: 1000 * 60 * 1,
    placeholderData: (prev) => prev,
  });

  const ledger = ledgerResponse?.results ?? [];
  const totalLedgerCount = ledgerResponse?.count ?? 0;
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(totalLedgerCount / pageSize));

  const sortedLedger = useMemo(() => {
    return [...ledger].sort((a, b) => {
      if (a.hijri_year !== b.hijri_year) return a.hijri_year - b.hijri_year;
      if (a.hijri_month !== b.hijri_month) return a.hijri_month - b.hijri_month;
      return (a.gregorian_date ?? "").localeCompare(b.gregorian_date ?? "");
    });
  }, [ledger]);

  // Summary derived state
  const summary = useMemo(() => {
    return {
      savingsBalance: balance ? formatCurrency(balance.total_savings) : "₦0.00",
      availableBalance: balance
        ? formatCurrency(balance.available_balance)
        : "₦0.00",
      contribution: profile?.approved_monthly_contribution
        ? formatCurrency(profile.approved_monthly_contribution)
        : "₦0.00",
      status: profile?.membership_status ?? "unknown",
      months: profile?.consecutive_savings_months ?? 0,
      loanEligibility: profile?.is_loan_eligible ? "Yes" : "No",
      suretyCommitted: balance
        ? formatCurrency(balance.suretyship_committed)
        : "₦0.00",
      specialSavings: balance?.special_savings
        ? formatCurrency(balance.special_savings)
        : "₦0.00",
      reservedForInvestment: balance?.reserved_for_investment
        ? formatCurrency(balance.reserved_for_investment)
        : "₦0.00",
    };
  }, [balance, profile]);

  // Savings change request mutation
  const createRequestMutation = useMutation({
    mutationFn: (amount: string) =>
      savingsApi.changeRequests.create({ requested_amount: amount }),
    onSuccess: () => {
      setShowRequestModal(false);
      setRequestAmount("");
      setRequestError("");
      alert("Your request has been submitted. Admin will review it.");
    },
    onError: (e: any) => {
      setRequestError(
        e?.response?.data?.requested_amount?.[0] || "Failed to submit request.",
      );
    },
  });

  // Filter helpers
  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    const empty = {
      hijri_month: "",
      hijri_year: "",
      date_from: "",
      date_to: "",
    };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  };

  // Download handler
  const [downloading, setDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "pdf">("csv");

  const handleDownload = async (format: "csv" | "pdf") => {
    if (!profile?.id) return;
    setDownloading(true);
    setDownloadFormat(format);
    try {
      const params = {
        hijri_month: appliedFilters.hijri_month
          ? Number(appliedFilters.hijri_month)
          : undefined,
        hijri_year: appliedFilters.hijri_year
          ? Number(appliedFilters.hijri_year)
          : undefined,
        date_from: appliedFilters.date_from || undefined,
        date_to: appliedFilters.date_to || undefined,
      };
      const response = await savingsApi.exportLedger(
        profile.id,
        params,
        format,
      );
      const blob = new Blob([response.data], {
        type: format === "pdf" ? "application/pdf" : "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `savings_ledger_${profile.file_number}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  if (profileLoading) {
    return (
      <AnimatedCard className="p-6">
        <div className="text-gray-600 dark:text-gray-300">
          Loading your savings profile…
        </div>
      </AnimatedCard>
    );
  }

  if (profileError) {
    return (
      <AnimatedCard className="p-6">
        <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-4">
          Unable to load your profile. Please try again.
        </div>
      </AnimatedCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="page-title">My Savings</h1>
        <p className="page-subtitle">
          View your savings balance, contributions and ledger history.
        </p>
      </div>

      {profileMissing && (
        <div className="card-panel-light border-warning-500 bg-warning-50 text-warning-700 p-4 rounded-lg">
          <p className="font-semibold">⚠️ No member savings profile found.</p>
          <p className="text-sm">
            Please create your profile on the My Profile page or contact your
            administrator.
          </p>
        </div>
      )}

      {/* Personal summary cards – first row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-panel bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/30 dark:to-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
            Total Savings
          </p>
          <p className="text-2xl font-semibold m-3 dark:text-white">
            {summary.savingsBalance}
          </p>
        </div>

        <div className="card-panel bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/30 dark:to-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
            Available Balance
          </p>
          <p className="text-2xl font-semibold m-3 dark:text-white">
            {summary.availableBalance}
          </p>
        </div>

        <div className="card-panel bg-gradient-to-br from-sky-50 to-white dark:from-sky-900/30 dark:to-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
            Monthly Contribution
          </p>
          <p className="text-2xl font-semibold m-3 dark:text-white">
            {summary.contribution}
          </p>
        </div>

        <div className="card-panel bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/30 dark:to-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
            Loan Eligible
          </p>
          <p className="text-2xl font-semibold m-3 dark:text-white">
            {summary.loanEligibility}
          </p>
        </div>
      </div>

      {/* Second row – commitments and extra info */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card-panel bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/30 dark:to-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
            Suretyship Commitment
          </p>
          <p className="text-2xl font-semibold m-3 dark:text-white">
            {summary.suretyCommitted}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 m-3 mt-1">
            Amount you've guaranteed for others
          </p>
        </div>

        <div className="card-panel bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/30 dark:to-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
            Reserved for Investment
          </p>
          <p className="text-2xl font-semibold m-3 dark:text-white">
            {summary.reservedForInvestment}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 m-3 mt-1">
            25% of (total savings − special savings) – not available
          </p>
        </div>

        {Number(balance?.special_savings || 0) > 0 && (
          <div className="card-panel bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/30 dark:to-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
              🔒 Special Fixed Savings
            </p>
            <p className="text-2xl font-semibold text-indigo-700 dark:text-indigo-400 m-3">
              {summary.specialSavings}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 m-3 mt-1">
              Locked savings – not available
            </p>
          </div>
        )}

        {/* Request Change Button */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-1 flex items-end justify-end">
          <button
            onClick={() => setShowRequestModal(true)}
            className="btn-secondary w-full sm:w-auto px-6 py-2 text-sm"
          >
            📝 Request Contribution Change
          </button>
        </div>
      </div>

      {/* Member details – compact */}
      {!profileMissing && profile && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card-panel-light">
            <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
              Membership Status
            </p>
            <p className="text-lg font-semibold capitalize dark:text-white m-3">
              {summary.status}
            </p>
          </div>
          <div className="card-panel-light">
            <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
              Consecutive Savings Months
            </p>
            <p className="text-lg font-semibold dark:text-white m-3">
              {summary.months}
            </p>
          </div>
          <div className="card-panel-light">
            <p className="text-sm text-gray-500 dark:text-gray-400 m-3">
              SSC File Number
            </p>
            <p className="text-lg font-semibold dark:text-white m-3">
              {profile.file_number}
            </p>
          </div>
        </div>
      )}

      {/* Ledger section */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold dark:text-white">
            Savings Ledger
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Filter your ledger by Hijri month/year or date range, then export.
          </p>
        </div>

        {/* Filter bar */}
        <div className="card-panel-light mb-6 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Hijri Month</label>
              <select
                value={filters.hijri_month}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, hijri_month: e.target.value }))
                }
                className="input"
                aria-label="Hijri month filter"
              >
                <option value="">All months</option>
                {HIJRI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Hijri Year</label>
              <input
                type="number"
                min={1}
                value={filters.hijri_year}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, hijri_year: e.target.value }))
                }
                className="input"
                placeholder="YYYY"
              />
            </div>
            <div>
              <label className="label">From</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, date_from: e.target.value }))
                }
                className="input"
                aria-label="Start date filter"
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, date_to: e.target.value }))
                }
                className="input"
                aria-label="End date filter"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={handleApplyFilters}>
              Apply Filters
            </button>
            <button className="btn-secondary" onClick={handleClearFilters}>
              Clear Filters
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              Print
            </button>
            <button
              className="btn-secondary"
              onClick={() => handleDownload("csv")}
              disabled={downloading}
            >
              {downloading && downloadFormat === "csv"
                ? "Preparing..."
                : "Download CSV"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => handleDownload("pdf")}
              disabled={downloading}
            >
              {downloading && downloadFormat === "pdf"
                ? "Preparing..."
                : "Download PDF"}
            </button>
          </div>
        </div>

        {/* Table */}
        {ledgerFetching && !ledger.length ? (
          <div className="text-gray-500 dark:text-gray-400">
            Loading ledger entries…
          </div>
        ) : sortedLedger.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">
            No ledger entries found.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hijri</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {sortedLedger.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.gregorian_date}</td>
                    <td>{entry.hijri_display}</td>
                    <td className="capitalize">
                      {entry.entry_type.replace(/_/g, " ")}
                    </td>
                    <td>{entry.details || "—"}</td>
                    <td>{entry.debit ? formatCurrency(entry.debit) : "—"}</td>
                    <td>{entry.credit ? formatCurrency(entry.credit) : "—"}</td>
                    <td>{formatCurrency(entry.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              className="btn-ghost btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {pageCount}
            </span>
            <button
              className="btn-ghost btn-sm"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Request Change Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 m-4 flex items-center justify-center bg-black/40 p-4">
          <div className="card-panel w-full max-w-md">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h2 className="font-semibold m-3 text-gray-900 dark:text-white">
                Request Savings Change
              </h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 m-3 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 m-3">
              {requestError && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm">
                  {requestError}
                </div>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300 m-3">
                Your current monthly contribution:{" "}
                <strong>
                  {formatCurrency(
                    profile?.approved_monthly_contribution ?? "0",
                  )}
                </strong>
              </p>
              <div>
                <label className="label m-3">
                  New monthly contribution (₦)
                </label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  className="input"
                  placeholder="Enter new amount"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 m-3">
                  Minimum ₦1,000
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (Number(requestAmount) < 1000) {
                      setRequestError("Amount must be at least ₦1,000");
                      return;
                    }
                    createRequestMutation.mutate(requestAmount);
                  }}
                  disabled={createRequestMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createRequestMutation.isPending
                    ? "Submitting..."
                    : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
