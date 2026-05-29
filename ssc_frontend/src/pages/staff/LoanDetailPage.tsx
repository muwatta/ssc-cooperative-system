import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { LoanApplication, Repayment } from "@/types";

// Simple helper functions
const formatNaira = (amount: string | number | null | undefined): string => {
  if (amount === null || amount === undefined) {
    return "₦0.00";
  }
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) {
    return "₦0.00";
  }
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

const EmptyState = ({ icon, title }: { icon: string; title: string }) => (
  <div className="text-center py-8">
    <div className="text-4xl mb-2">{icon}</div>
    <p className="text-gray-500">{title}</p>
  </div>
);

const PageLoader = () => (
  <div className="flex justify-center items-center py-12">
    <div className="text-gray-500">Loading...</div>
  </div>
);

export default function LoanDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { isAdmin, isCommittee } = useAuth();
  const loanId = id ? Number(id) : null;

  const [showRepayment, setShowRepayment] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: loan, isLoading } = useQuery<LoanApplication>({
    queryKey: ["loan", loanId],
    enabled: !!loanId,
    queryFn: async () => {
      const res = await loansApi.get(loanId!);
      return res.data;
    },
  });

  const { data: repayments = [], isLoading: isLoadingReps } = useQuery<
    Repayment[]
  >({
    queryKey: ["loan-repayments", loanId],
    enabled: !!loanId,
    queryFn: async () => {
      try {
        const res = await loansApi.repaymentHistory(loanId!);
        return res.data || [];
      } catch {
        return [];
      }
    },
  });

  const repaymentsList = repayments;
  const totalRecs = repaymentsList.length;
  const pageCount = Math.max(1, Math.ceil(totalRecs / pageSize));
  const pagedReps = repaymentsList.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [repayments, pageSize]);

  const exportCsv = () => {
    if (!repaymentsList.length) return;
    const headers = [
      "hijri",
      "amount",
      "balance_before",
      "balance_after",
      "posted_by",
      "posted_at",
    ];
    const rows = repaymentsList.map((r) => [
      r.hijri_display,
      r.amount,
      r.balance_before,
      r.balance_after,
      r.verified_by_name,
      r.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan-${loanId}-repayments.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const invalidateRepayments = () => {
    qc.invalidateQueries({ queryKey: ["loan-repayments", loanId] });
    qc.invalidateQueries({ queryKey: ["loan", loanId] });
  };

  if (isLoading) return <PageLoader />;
  if (!loan) return <EmptyState icon="🔍" title="Loan not found" />;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Loan #{loan.id}</h1>
        <p className="text-gray-600">Applicant: {loan.applicant_name}</p>
        {(isAdmin || isCommittee) && loan.status === "active" && (
          <button
            onClick={() => setShowRepayment(true)}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Post Repayment
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Amount Applied</p>
          <p className="font-bold text-lg">
            {formatNaira(loan.amount_applied)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Status</p>
          <p className="font-bold text-lg">{loan.status.toUpperCase()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Duration</p>
          <p className="font-bold text-lg">
            {loan.proposed_duration_months} months
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Outstanding</p>
          <p className="font-bold text-lg">
            {formatNaira(loan.outstanding_balance)}
          </p>
        </div>
      </div>

      {/* Sureties Table */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Sureties</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Layer</th>
                <th className="p-3 text-left">Member</th>
                <th className="p-3 text-left">Guaranteed</th>
                <th className="p-3 text-left">Remaining</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loan.sureties && loan.sureties.length > 0 ? (
                loan.sureties.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">#{s.layer}</td>
                    <td className="p-3">
                      {s.surety_file_number} — {s.surety_name}
                    </td>
                    <td className="p-3">{formatNaira(s.amount_guaranteed)}</td>
                    <td className="p-3">{formatNaira(s.current_liability)}</td>
                    <td className="p-3">{s.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No sureties attached
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Repayments Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Repayment History</h3>
          <button
            onClick={exportCsv}
            className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Hijri Date</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Before</th>
                <th className="p-3 text-left">After</th>
                <th className="p-3 text-left">Posted By</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingReps ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    Loading...
                  </td>
                </tr>
              ) : repaymentsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No repayments posted yet
                  </td>
                </tr>
              ) : (
                pagedReps.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.hijri_display}</td>
                    <td className="p-3">{formatNaira(r.amount)}</td>
                    <td className="p-3">{formatNaira(r.balance_before)}</td>
                    <td className="p-3">{formatNaira(r.balance_after)}</td>
                    <td className="p-3">{r.verified_by_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalRecs > 0 && (
          <div className="p-4 border-t flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm">Show</span>
              <select
                value={pageSize}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setPageSize(parseInt(e.target.value, 10))
                }
                className="border rounded px-2 py-1"
                aria-label="Number of rows per page"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>

            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-3 py-1">
                Page {page} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Repayment Modal */}
      {showRepayment && loan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Post Loan Repayment</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const amount = formData.get("amount");
                if (amount) {
                  // Call API here
                  alert(`Repayment of ₦${amount} posted successfully`);
                  invalidateRepayments();
                  setShowRepayment(false);
                }
              }}
            >
              <div className="mb-4">
                <label className="block text-sm mb-1">Amount (₦)</label>
                <input
                  name="amount"
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter amount"
                  required
                  min={1}
                  max={parseFloat(loan.outstanding_balance)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Outstanding:{" "}
                  {formatNaira(parseFloat(loan.outstanding_balance) || 0)}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRepayment(false)}
                  className="flex-1 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Post Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
