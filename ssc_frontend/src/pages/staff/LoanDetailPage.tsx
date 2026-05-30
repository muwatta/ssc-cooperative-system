import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
import { useAuth } from "@/context/AuthContext";
import type { LoanApplication, Repayment } from "@/types";

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
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentHijriMonth, setRepaymentHijriMonth] = useState(1);
  const [repaymentHijriYear, setRepaymentHijriYear] = useState(
    new Date().getFullYear(),
  );
  const [isPostingRepayment, setIsPostingRepayment] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);

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

  const [isExporting, setIsExporting] = useState(false);

  const exportRepayments = async (format: "csv" | "pdf") => {
    if (!loanId || repaymentsList.length === 0) return;
    setIsExporting(true);
    try {
      const res = await loansApi.exportRepayments(loanId, format);
      const blob = new Blob([res.data], {
        type: format === "pdf" ? "application/pdf" : "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loan-${loanId}-repayments.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const invalidateRepayments = () => {
    qc.invalidateQueries({ queryKey: ["loan-repayments", loanId] });
    qc.invalidateQueries({ queryKey: ["loan", loanId] });
  };

  const handlePostRepayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loanId) return;

    setIsPostingRepayment(true);
    setRepaymentError(null);

    try {
      await loansApi.postRepayment(loanId, {
        amount: repaymentAmount,
        hijri_month: repaymentHijriMonth,
        hijri_year: repaymentHijriYear,
      });
      invalidateRepayments();
      setShowRepayment(false);
      setRepaymentAmount("");
      setRepaymentHijriMonth(1);
      setRepaymentHijriYear(new Date().getFullYear());
    } catch (error) {
      setRepaymentError(
        "Unable to post repayment. Please check the values and try again.",
      );
    } finally {
      setIsPostingRepayment(false);
    }
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
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-semibold">Repayment History</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.print()}
              className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
            >
              Print
            </button>
            <button
              onClick={() => exportRepayments("csv")}
              disabled={isExporting || repaymentsList.length === 0}
              className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => exportRepayments("pdf")}
              disabled={isExporting || repaymentsList.length === 0}
              className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>
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
            <form onSubmit={handlePostRepayment}>
              {repaymentError && (
                <div className="mb-4 rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-danger-700">
                  {repaymentError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label
                    htmlFor="repayment-amount"
                    className="block text-sm mb-1"
                  >
                    Amount (₦)
                  </label>
                  <input
                    id="repayment-amount"
                    value={repaymentAmount}
                    onChange={(event) => setRepaymentAmount(event.target.value)}
                    type="number"
                    className="w-full border rounded px-3 py-2"
                    placeholder="Enter amount"
                    required
                    min={0.01}
                    step="0.01"
                    max={parseFloat(loan.outstanding_balance) || undefined}
                  />
                </div>
                <div>
                  <label
                    htmlFor="repayment-hijri-month"
                    className="block text-sm mb-1"
                  >
                    Hijri Month
                  </label>
                  <input
                    id="repayment-hijri-month"
                    value={repaymentHijriMonth}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setRepaymentHijriMonth(Number(event.target.value))
                    }
                    type="number"
                    className="w-full border rounded px-3 py-2"
                    min={1}
                    max={12}
                    placeholder="1-12"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label
                    htmlFor="repayment-hijri-year"
                    className="block text-sm mb-1"
                  >
                    Hijri Year
                  </label>
                  <input
                    id="repayment-hijri-year"
                    value={repaymentHijriYear}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setRepaymentHijriYear(Number(event.target.value))
                    }
                    type="number"
                    className="w-full border rounded px-3 py-2"
                    min={1}
                    placeholder="1445"
                    required
                  />
                </div>
                <div className="pt-6 text-sm text-gray-500">
                  Outstanding: {formatNaira(loan.outstanding_balance)}
                </div>
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
                  disabled={isPostingRepayment}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPostingRepayment ? "Posting..." : "Post Repayment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
