import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import { useAuth } from "@/context/AuthContext";
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
  const { isAdmin, isCommittee } = useAuth();

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

  // Profile (React Query, 10 min cache)
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

  // Balance (React Query, 2 min cache)
  const { data: balance } = useQuery<MemberBalance>({
    queryKey: ["my-balance", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const res = await savingsApi.getBalance(profile!.id);
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  // Ledger (React Query, 1 min cache)
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
  const pageSize = 50; // default page size from API (should match backend)
  const pageCount = Math.max(1, Math.ceil(totalLedgerCount / pageSize));

  // Sort ledger chronologically (oldest first)
  const sortedLedger = useMemo(() => {
    return [...ledger].sort((a, b) => {
      if (a.hijri_year !== b.hijri_year) return a.hijri_year - b.hijri_year;
      if (a.hijri_month !== b.hijri_month) return a.hijri_month - b.hijri_month;
      return (a.gregorian_date ?? "").localeCompare(b.gregorian_date ?? "");
    });
  }, [ledger]);

  // Cooperative summary (admin/committee only, 10 min cache)
  const canSeeCoopBalances = isAdmin || isCommittee;
  const {
    data: cooperativeSummary,
    isLoading: summaryLoading,
    error: summaryLoadError,
  } = useQuery({
    queryKey: ["my-savings-summary"],
    queryFn: async () => {
      const response = await savingsApi.summary();
      return response.data;
    },
    staleTime: 1000 * 60 * 10,
    enabled: canSeeCoopBalances,
  });

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
        <div className="text-gray-600">Loading your savings profile…</div>
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

      {/* Personal summary cards – responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="card-panel bg-gradient-to-br from-primary-50 to-white">
          <p className="text-sm text-gray-500">Total Savings</p>
          <p className="text-2xl font-semibold mt-1">
            {summary.savingsBalance}
          </p>
        </div>
        <div className="card-panel bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-sm text-gray-500">Available Balance</p>
          <p className="text-2xl font-semibold mt-1">
            {summary.availableBalance}
          </p>
        </div>
        <div className="card-panel bg-gradient-to-br from-sky-50 to-white">
          <p className="text-sm text-gray-500">Approved Monthly Contribution</p>
          <p className="text-2xl font-semibold mt-1">{summary.contribution}</p>
        </div>
        <div className="card-panel bg-gradient-to-br from-amber-50 to-white">
          <p className="text-sm text-gray-500">Loan Eligible</p>
          <p className="text-2xl font-semibold mt-1">
            {summary.loanEligibility}
          </p>
        </div>
        <div className="card-panel flex flex-col items-start">
          <p className="text-sm text-gray-500">Request Change</p>
          <button
            onClick={() => setShowRequestModal(true)}
            className="btn-secondary btn-sm mt-2 w-full"
          >
            📝 Increase / Decrease
          </button>
        </div>
      </div>

      {/* Suretyship Commitment and Special Savings (if any) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-panel bg-gradient-to-br from-purple-50 to-white">
          <p className="text-sm text-gray-500">Suretyship Commitment</p>
          <p className="text-2xl font-semibold mt-1">
            {summary.suretyCommitted}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Total amount you have guaranteed for others
          </p>
        </div>
        {Number(balance?.special_savings || 0) > 0 && (
          <div className="card-panel bg-gradient-to-br from-indigo-50 to-white">
            <p className="text-sm text-gray-500">🔒 Special Fixed Savings</p>
            <p className="text-2xl font-semibold mt-1 text-indigo-700">
              {summary.specialSavings}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Locked savings – not available for loans
            </p>
          </div>
        )}
      </div>

      {/* Cooperative Balances (admin/committee only) */}
      {canSeeCoopBalances && (
        <div className="card-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Cooperative Balances</h2>
              <p className="text-sm text-gray-500">
                General totals for all members.
              </p>
            </div>
            {summaryLoadError && (
              <p className="text-sm text-danger-700">
                Unable to load cooperative summary.
              </p>
            )}
          </div>
          {summaryLoading ? (
            <div className="mt-4 text-gray-500">Loading...</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-panel-light">
                <p className="text-xs text-gray-500">Total Savings</p>
                <p className="text-xl font-semibold">
                  {cooperativeSummary
                    ? formatCurrency(
                        cooperativeSummary.cooperative.total_savings,
                      )
                    : "₦0.00"}
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs text-gray-500">Total Commitments</p>
                <p className="text-xl font-semibold">
                  {cooperativeSummary
                    ? formatCurrency(
                        cooperativeSummary.cooperative.total_committed,
                      )
                    : "₦0.00"}
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs text-gray-500">Total Available</p>
                <p className="text-xl font-semibold">
                  {cooperativeSummary
                    ? formatCurrency(
                        cooperativeSummary.cooperative.total_available,
                      )
                    : "₦0.00"}
                </p>
              </div>
              <div className="card-panel-light">
                <p className="text-xs text-gray-500">Members Count</p>
                <p className="text-xl font-semibold">
                  {cooperativeSummary?.cooperative.member_count ?? 0}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Member details */}
      {!profileMissing && profile && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-panel-light">
              <p className="text-sm text-gray-500">Membership Status</p>
              <p className="text-lg font-semibold capitalize">
                {summary.status}
              </p>
            </div>
            <div className="card-panel-light">
              <p className="text-sm text-gray-500">
                Consecutive Savings Months
              </p>
              <p className="text-lg font-semibold">{summary.months}</p>
            </div>
            <div className="card-panel-light">
              <p className="text-sm text-gray-500">SSC File Number</p>
              <p className="text-lg font-semibold">{profile.file_number}</p>
            </div>
          </div>

          {/* Ledger section */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Savings Ledger</h2>
              <p className="text-sm text-gray-500">
                Filter your ledger by Hijri month/year or by date range, then
                export.
              </p>
            </div>

            {/* Filter bar */}
            <div className="card-panel-light mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <button
                  className="btn-secondary"
                  onClick={() => window.print()}
                >
                  Print
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleDownload("csv")}
                  disabled={downloading}
                >
                  {downloading && downloadFormat === "csv"
                    ? "Preparing..."
                    : "Download CSV / Excel"}
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
              <div className="text-gray-500">Loading ledger entries…</div>
            ) : sortedLedger.length === 0 ? (
              <div className="text-gray-500">No ledger entries found.</div>
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
                        <td>
                          {entry.debit ? formatCurrency(entry.debit) : "—"}
                        </td>
                        <td>
                          {entry.credit ? formatCurrency(entry.credit) : "—"}
                        </td>
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
                <span className="text-sm text-gray-600">
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
        </>
      )}

      {/* Request Change Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-panel w-full max-w-md">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h2 className="font-semibold text-gray-900">
                Request Savings Change
              </h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {requestError && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm">
                  {requestError}
                </div>
              )}
              <p className="text-sm text-gray-600">
                Your current monthly contribution:{" "}
                <strong>
                  {formatCurrency(
                    profile?.approved_monthly_contribution ?? "0",
                  )}
                </strong>
              </p>
              <div>
                <label className="label">New monthly contribution (₦)</label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  className="input"
                  placeholder="Enter new amount"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum ₦1,000</p>
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
