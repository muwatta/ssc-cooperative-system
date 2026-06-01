import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import { useAuth } from "@/context/AuthContext";
import type { MemberBalance, MemberProfile, SavingsLedgerEntry } from "@/types";
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
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [balance, setBalance] = useState<MemberBalance | null>(null);
  const [ledger, setLedger] = useState<SavingsLedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "pdf">("csv");
  const [error, setError] = useState("");
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

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestError, setRequestError] = useState("");

  const canSeeCoopBalances = isAdmin || isCommittee;

  const {
    data: cooperativeSummary,
    isLoading: summaryLoading,
    error: summaryLoadError,
  } = useQuery({
    queryKey: ["my-savings", "summary"],
    queryFn: async () => {
      const response = await savingsApi.summary();
      return response.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await membersApi.me();
        if (!response.data) {
          setProfile(null);
          setProfileMissing(true);
          setError("");
          setLoading(false);
          return;
        }
        setProfile(response.data);
        setProfileMissing(false);
      } catch (error) {
        const axiosError = error as any;
        if (axiosError?.response?.status === 404) {
          setProfile(null);
          setProfileMissing(true);
          setError("");
        } else {
          setError(
            "Unable to load your profile. Please try again or contact your administrator.",
          );
          setLoading(false);
        }
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (!profile) {
      if (profileMissing) setLoading(false);
      return;
    }

    const loadSavings = async () => {
      setLoading(true);
      setError("");
      try {
        const params: Record<string, string | number> = { page };
        if (appliedFilters.hijri_month)
          params.hijri_month = Number(appliedFilters.hijri_month);
        if (appliedFilters.hijri_year)
          params.hijri_year = Number(appliedFilters.hijri_year);
        if (appliedFilters.date_from)
          params.date_from = appliedFilters.date_from;
        if (appliedFilters.date_to) params.date_to = appliedFilters.date_to;

        const [balanceResponse, ledgerResponse] = await Promise.all([
          savingsApi.getBalance(profile.id),
          savingsApi.getLedger(profile.id, params),
        ]);

        setBalance(balanceResponse.data);
        setLedger(ledgerResponse.data.results);
        setPageCount(Math.max(1, Math.ceil(ledgerResponse.data.count / 10)));
      } catch {
        setError("Unable to load savings history. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    loadSavings();
  }, [profile, page, appliedFilters, profileMissing]);

  const summary = useMemo(() => {
    return {
      savingsBalance: balance ? formatCurrency(balance.total_savings) : "₦0.00",
      availableBalance: balance
        ? formatCurrency(balance.available_balance)
        : "₦0.00",
      contribution: profile
        ? formatCurrency(profile.approved_monthly_contribution)
        : "₦0.00",
      status: profile?.membership_status ?? "unknown",
      months: profile?.consecutive_savings_months ?? 0,
      loanEligibility: profile?.is_loan_eligible ? "Yes" : "No",
    };
  }, [balance, profile]);

  const buildFilters = () => ({
    hijri_month: appliedFilters.hijri_month
      ? Number(appliedFilters.hijri_month)
      : undefined,
    hijri_year: appliedFilters.hijri_year
      ? Number(appliedFilters.hijri_year)
      : undefined,
    date_from: appliedFilters.date_from || undefined,
    date_to: appliedFilters.date_to || undefined,
  });

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

  const handleDownload = async (format: "csv" | "pdf") => {
    if (!profile) return;
    setDownloading(true);
    setDownloadFormat(format);
    setError("");
    try {
      const params = buildFilters();
      const response = await savingsApi.exportLedger(
        profile.id,
        params,
        format,
      );
      const blob = new Blob([response.data], {
        type: format === "pdf" ? "application/pdf" : "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `savings_ledger_${profile.file_number}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Unable to download the ledger export. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">My Savings</h1>
          <p className="text-sm text-gray-500">
            View your savings balance, contributions and ledger history.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading your savings information...</div>
      ) : error ? (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-4">
          {error}
        </div>
      ) : (
        <>
          {profileMissing && (
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
              <p className="font-semibold">No member savings profile found.</p>
              <p className="text-sm">
                Please create your profile on the My Profile page or contact
                your administrator.
              </p>
            </div>
          )}

          {/* Personal summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Savings</p>
              <p className="text-2xl sm:text-3xl font-semibold mt-2">
                {summary.savingsBalance}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Available Balance</p>
              <p className="text-2xl sm:text-3xl font-semibold mt-2">
                {summary.availableBalance}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">
                Approved Monthly Contribution
              </p>
              <p className="text-2xl sm:text-3xl font-semibold mt-2">
                {summary.contribution}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Loan Eligible</p>
              <p className="text-2xl sm:text-3xl font-semibold mt-2">
                {summary.loanEligibility}
              </p>
            </div>
            <div className="card p-4">
              <button
                onClick={() => setShowRequestModal(true)}
                className="mt-2 btn-secondary w-full text-sm py-2"
              >
                📝 Increase / Decrease
              </button>
            </div>
          </div>

          {/* Cooperative Balances (admin/committee only) */}
          {canSeeCoopBalances && (
            <div className="card p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Cooperative Balances
                  </h2>
                  <p className="text-sm text-gray-500">
                    General totals for all members.
                  </p>
                </div>
                {summaryLoadError && (
                  <div className="text-sm text-danger-700">
                    Unable to load cooperative balance summary.
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Total Savings</p>
                  <p className="text-2xl font-semibold mt-2">
                    {summaryLoading
                      ? "Loading..."
                      : cooperativeSummary
                        ? formatCurrency(
                            cooperativeSummary.cooperative.total_savings,
                          )
                        : "₦0.00"}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Total Commitments</p>
                  <p className="text-2xl font-semibold mt-2">
                    {summaryLoading
                      ? "Loading..."
                      : cooperativeSummary
                        ? formatCurrency(
                            cooperativeSummary.cooperative.total_committed,
                          )
                        : "₦0.00"}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Total Available</p>
                  <p className="text-2xl font-semibold mt-2">
                    {summaryLoading
                      ? "Loading..."
                      : cooperativeSummary
                        ? formatCurrency(
                            cooperativeSummary.cooperative.total_available,
                          )
                        : "₦0.00"}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Members Count</p>
                  <p className="text-2xl font-semibold mt-2">
                    {summaryLoading
                      ? "..."
                      : (cooperativeSummary?.cooperative.member_count ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!profileMissing && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Membership Status</p>
                  <p className="text-xl font-semibold mt-2 capitalize">
                    {summary.status}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">
                    Consecutive Savings Months
                  </p>
                  <p className="text-xl font-semibold mt-2">{summary.months}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">SSC File Number</p>
                  <p className="text-xl font-semibold mt-2">
                    {profile?.file_number ?? "N/A"}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Savings Ledger</h2>
                <p className="text-sm text-gray-500">
                  Filter by Hijri month/year or date range, then export.
                </p>
              </div>
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Hijri Month */}
                  <div>
                    <label htmlFor="filter-hijri-month" className="label">
                      Hijri Month
                    </label>
                    <select
                      id="filter-hijri-month"
                      value={filters.hijri_month}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          hijri_month: event.target.value,
                        }))
                      }
                      className="input"
                      aria-label="Hijri month filter"
                      title="Hijri month"
                    >
                      <option value="">All months</option>
                      {HIJRI_MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hijri Year */}
                  <div>
                    <label htmlFor="filter-hijri-year" className="label">
                      Hijri Year
                    </label>
                    <input
                      id="filter-hijri-year"
                      type="number"
                      value={filters.hijri_year}
                      onChange={(e) =>
                        setFilters((p) => ({
                          ...p,
                          hijri_year: e.target.value,
                        }))
                      }
                      className="input"
                      placeholder="YYYY"
                      aria-label="Hijri year filter"
                      title="Hijri year"
                    />
                  </div>

                  {/* From Date */}
                  <div>
                    <label htmlFor="filter-date-from" className="label">
                      From
                    </label>
                    <input
                      id="filter-date-from"
                      type="date"
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((p) => ({
                          ...p,
                          date_from: e.target.value,
                        }))
                      }
                      className="input"
                      aria-label="Start date filter"
                      title="Start date"
                    />
                  </div>

                  {/* To Date */}
                  <div>
                    <label htmlFor="filter-date-to" className="label">
                      To
                    </label>
                    <input
                      id="filter-date-to"
                      type="date"
                      value={filters.date_to}
                      onChange={(e) =>
                        setFilters((p) => ({
                          ...p,
                          date_to: e.target.value,
                        }))
                      }
                      className="input"
                      aria-label="End date filter"
                      title="End date"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleApplyFilters}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => handleDownload("csv")}
                    disabled={downloading}
                    className="btn-outline px-4 py-2 text-sm"
                  >
                    {downloading && downloadFormat === "csv"
                      ? "Preparing..."
                      : "Download CSV"}
                  </button>
                  <button
                    onClick={() => handleDownload("pdf")}
                    disabled={downloading}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    {downloading && downloadFormat === "pdf"
                      ? "Preparing..."
                      : "Download PDF"}
                  </button>
                </div>
              </div>

              {/* Ledger – cards on mobile, table on desktop */}
              {ledger.length === 0 ? (
                <div className="text-gray-600">
                  No ledger entries found yet.
                </div>
              ) : (
                <div>
                  {/* Mobile card view */}
                  <div className="block md:hidden space-y-3">
                    {ledger.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white rounded-xl shadow-sm border p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-mono text-xs text-gray-500">
                              {entry.gregorian_date}
                            </p>
                            <p className="font-semibold">
                              {entry.hijri_display}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                            {entry.entry_type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Credit</span>
                            <br />
                            {entry.credit ? formatCurrency(entry.credit) : "—"}
                          </div>
                          <div>
                            <span className="text-gray-500">Debit</span>
                            <br />
                            {entry.debit ? formatCurrency(entry.debit) : "—"}
                          </div>
                          <div>
                            <span className="text-gray-500">Balance</span>
                            <br />
                            <span className="font-semibold">
                              {formatCurrency(entry.balance)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Verified By</span>
                            <br />
                            <span className="text-gray-600 text-xs">
                              {entry.verified_by_name}
                            </span>
                          </div>
                        </div>
                        {entry.details && (
                          <p className="mt-2 text-xs text-gray-400 truncate">
                            {entry.details}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-sm text-gray-500">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Hijri</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Details</th>
                          <th className="px-4 py-3">Debit</th>
                          <th className="px-4 py-3">Credit</th>
                          <th className="px-4 py-3">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-t hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-sm">
                              {entry.gregorian_date}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {entry.hijri_display}
                            </td>
                            <td className="px-4 py-3 text-sm capitalize">
                              {entry.entry_type.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {entry.details || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {entry.debit ? formatCurrency(entry.debit) : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {entry.credit
                                ? formatCurrency(entry.credit)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {formatCurrency(entry.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {pageCount > 1 && (
                <div className="mt-4 flex justify-center sm:justify-end gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-ghost px-3 py-2 border rounded text-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {pageCount}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={page >= pageCount}
                    className="btn-ghost px-3 py-2 border rounded text-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Request Change Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Request Savings Change</h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400"
              >
                ✕
              </button>
            </div>
            {requestError && (
              <div className="mb-4 bg-danger-50 text-danger-700 p-3 rounded text-sm">
                {requestError}
              </div>
            )}
            <p className="text-sm text-gray-600 mb-3">
              Your current monthly contribution:{" "}
              <strong>
                {formatCurrency(profile?.approved_monthly_contribution ?? "0")}
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
                className="input w-full"
                placeholder="Enter new amount"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum ₦1,000</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowRequestModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (Number(requestAmount) < 1000)
                    setRequestError("Amount must be at least ₦1,000");
                  else createRequestMutation.mutate(requestAmount);
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
      )}
    </div>
  );
}
