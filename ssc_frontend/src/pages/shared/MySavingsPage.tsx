import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { membersApi, savingsApi } from "@/api/services";
import { AnimatedCard } from "@/components/common";
import type { MemberBalance, MemberProfile } from "@/types";

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
  const [page, setPage] = useState(1);

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

  // Ledger – no filters, just pagination
  const { data: ledgerResponse, isFetching: ledgerFetching } = useQuery({
    queryKey: ["my-ledger", profile?.id, page],
    enabled: !!profile?.id,
    queryFn: async () => {
      const res = await savingsApi.getLedger(profile!.id, { page });
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

      {/* Ledger section – responsive */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold dark:text-white">
            Savings Ledger
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Chronological view of all your savings transactions.
          </p>
        </div>

        {ledgerFetching && !ledger.length ? (
          <div className="text-gray-500 dark:text-gray-400">
            Loading ledger entries…
          </div>
        ) : sortedLedger.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">
            No ledger entries found.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[640px] sm:min-w-full table-auto border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="px-2 py-2 text-left font-medium">Date</th>
                  <th className="px-2 py-2 text-left font-medium">Hijri</th>
                  <th className="px-2 py-2 text-left font-medium">Type</th>
                  <th className="px-2 py-2 text-left font-medium">Details</th>
                  <th className="px-2 py-2 text-right font-medium">Debit</th>
                  <th className="px-2 py-2 text-right font-medium">Credit</th>
                  <th className="px-2 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {sortedLedger.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-100 dark:border-gray-700"
                  >
                    <td className="px-2 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {entry.gregorian_date}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {entry.hijri_display}
                    </td>
                    <td className="px-2 py-2 capitalize text-gray-700 dark:text-gray-300">
                      {entry.entry_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-2 py-2 max-w-[120px] truncate text-gray-600 dark:text-gray-400">
                      {entry.details || "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                      {entry.debit ? formatCurrency(entry.debit) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {entry.credit ? formatCurrency(entry.credit) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-medium text-gray-900 dark:text-white">
                      {formatCurrency(entry.balance)}
                    </td>
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
              className="btn-ghost btn-sm text-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {pageCount}
            </span>
            <button
              className="btn-ghost btn-sm text-sm"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Request Change Modal – responsive */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-panel w-full max-w-md mx-2 sm:mx-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Request Savings Change
              </h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {requestError && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 px-3 py-2 rounded-lg text-sm">
                  {requestError}
                </div>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Your current monthly contribution:{" "}
                <strong>
                  {formatCurrency(
                    profile?.approved_monthly_contribution ?? "0",
                  )}
                </strong>
              </p>
              <div>
                <label className="label text-sm">
                  New monthly contribution (₦)
                </label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  className="input w-full"
                  placeholder="Enter new amount"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Minimum ₦1,000
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="btn-secondary w-full sm:flex-1 py-2"
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
                  className="btn-primary w-full sm:flex-1 py-2"
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
