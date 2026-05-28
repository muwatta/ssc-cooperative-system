import { useEffect, useMemo, useState } from "react";
import { membersApi, savingsApi } from "@/api/services";
import type {
  MemberBalance,
  MemberProfile,
  SavingsLedgerEntry,
  SavingsSummary,
} from "@/types";
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
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [balance, setBalance] = useState<MemberBalance | null>(null);
  const [cooperativeSummary, setCooperativeSummary] =
    useState<SavingsSummary | null>(null);
  const [ledger, setLedger] = useState<SavingsLedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
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
      if (profileMissing) {
        setLoading(false);
      }
      return;
    }

    const loadSavings = async () => {
      setLoading(true);
      setError("");

      try {
        const params: Record<string, string | number> = { page };

        if (appliedFilters.hijri_month) {
          params.hijri_month = Number(appliedFilters.hijri_month);
        }
        if (appliedFilters.hijri_year) {
          params.hijri_year = Number(appliedFilters.hijri_year);
        }
        if (appliedFilters.date_from) {
          params.date_from = appliedFilters.date_from;
        }
        if (appliedFilters.date_to) {
          params.date_to = appliedFilters.date_to;
        }

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

  useEffect(() => {
    const loadSummary = async () => {
      setSummaryError("");
      try {
        const response = await savingsApi.summary();
        setCooperativeSummary(response.data);
      } catch {
        setSummaryError("Unable to load cooperative balance summary.");
      }
    };

    loadSummary();
  }, []);

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

  const buildFilters = () => {
    return {
      hijri_month: appliedFilters.hijri_month
        ? Number(appliedFilters.hijri_month)
        : undefined,
      hijri_year: appliedFilters.hijri_year
        ? Number(appliedFilters.hijri_year)
        : undefined,
      date_from: appliedFilters.date_from || undefined,
      date_to: appliedFilters.date_to || undefined,
    };
  };

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      hijri_month: "",
      hijri_year: "",
      date_from: "",
      date_to: "",
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const handleDownloadCsv = async () => {
    if (!profile) return;
    setDownloading(true);
    setError("");

    try {
      const params = buildFilters();
      const response = await savingsApi.exportLedger(profile.id, params);
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `savings_ledger_${profile.file_number}.csv`;
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
    <div className="card p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Savings</h1>
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
          {profileMissing ? (
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
              <p className="font-semibold">No member savings profile found.</p>
              <p className="text-sm">
                We could not find a savings profile associated with your
                account. If you are a new member, please create your profile on
                the My Profile page or contact your administrator for
                assistance.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Savings</p>
              <p className="text-3xl font-semibold mt-2">
                {summary.savingsBalance}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Available Balance</p>
              <p className="text-3xl font-semibold mt-2">
                {summary.availableBalance}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">
                Approved Monthly Contribution
              </p>
              <p className="text-3xl font-semibold mt-2">
                {summary.contribution}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Loan Eligible</p>
              <p className="text-3xl font-semibold mt-2">
                {summary.loanEligibility}
              </p>
            </div>
          </div>

          <div className="card p-6 mb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Cooperative Balances</h2>
                <p className="text-sm text-gray-500 mt-1">
                  General totals for all members, visible to everyone.
                </p>
              </div>
              {summaryError ? (
                <div className="text-sm text-danger-700">{summaryError}</div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-4">
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Savings</p>
                <p className="text-3xl font-semibold mt-2">
                  {cooperativeSummary
                    ? formatCurrency(
                        cooperativeSummary.cooperative.total_savings,
                      )
                    : "₦0.00"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Commitments</p>
                <p className="text-3xl font-semibold mt-2">
                  {cooperativeSummary
                    ? formatCurrency(
                        cooperativeSummary.cooperative.total_committed,
                      )
                    : "₦0.00"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Available</p>
                <p className="text-3xl font-semibold mt-2">
                  {cooperativeSummary
                    ? formatCurrency(
                        cooperativeSummary.cooperative.total_available,
                      )
                    : "₦0.00"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Members Count</p>
                <p className="text-3xl font-semibold mt-2">
                  {cooperativeSummary?.cooperative.member_count ?? 0}
                </p>
              </div>
            </div>
          </div>

          {!profileMissing ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3 mb-8">
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

              <div className="mb-4">
                <h2 className="text-lg font-semibold">Savings Ledger</h2>
                <p className="text-sm text-gray-500">
                  Filter your ledger by Hijri month/year or by date range, then
                  export a CSV for Excel.
                </p>
              </div>

              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-4 lg:grid-cols-4">
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
                    >
                      <option value="">All months</option>
                      {HIJRI_MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filter-hijri-year" className="label">
                      Hijri Year
                    </label>
                    <input
                      id="filter-hijri-year"
                      value={filters.hijri_year}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          hijri_year: event.target.value,
                        }))
                      }
                      type="number"
                      min={1}
                      className="input"
                      placeholder="YYYY"
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-date-from" className="label">
                      From
                    </label>
                    <input
                      id="filter-date-from"
                      value={filters.date_from}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          date_from: event.target.value,
                        }))
                      }
                      type="date"
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-date-to" className="label">
                      To
                    </label>
                    <input
                      id="filter-date-to"
                      value={filters.date_to}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          date_to: event.target.value,
                        }))
                      }
                      type="date"
                      className="input"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-primary rounded-md px-4 py-2"
                    onClick={handleApplyFilters}
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    className="btn-secondary rounded-md px-4 py-2"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </button>
                  <button
                    type="button"
                    className="btn-outline rounded-md px-4 py-2"
                    onClick={handleDownloadCsv}
                    disabled={downloading}
                  >
                    {downloading
                      ? "Preparing download..."
                      : "Download CSV / Excel"}
                  </button>
                </div>
              </div>

              {ledger.length === 0 ? (
                <div className="text-gray-600">
                  No ledger entries found yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {entry.gregorian_date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {entry.hijri_display}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                            {entry.entry_type.replace("_", " ")}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {entry.details || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {entry.debit ? formatCurrency(entry.debit) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {entry.credit ? formatCurrency(entry.credit) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formatCurrency(entry.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pageCount > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="btn-ghost rounded-md border px-3 py-2 text-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() =>
                      setPage((prev) => Math.min(pageCount, prev + 1))
                    }
                    className="btn-ghost rounded-md border px-3 py-2 text-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
