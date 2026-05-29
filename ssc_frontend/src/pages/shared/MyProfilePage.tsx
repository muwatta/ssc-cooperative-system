import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

// Simple helper functions
const formatNaira = (amount: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount || 0);
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

type Surety = {
  id: number;
  layer: number;
  surety_file_number: string;
  surety_name: string;
  amount_guaranteed: number;
  current_liability: number;
  status: string;
};

type Loan = {
  id: number;
  applicant_name: string;
  amount_applied: number;
  status: string;
  proposed_duration_months: number;
  outstanding_balance: number;
  repayment_start_hijri_month?: number;
  repayment_start_hijri_year?: number;
  sureties?: Surety[];
};

type Repayment = {
  id: number;
  hijri_display: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  verified_by_name: string;
  created_at: string;
};

export default function LoanDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { isAdmin, isCommittee } = useAuth();
  const loanId = id ? Number(id) : null;

  const [showRepayment, setShowRepayment] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loan", loanId],
    enabled: !!loanId,
    queryFn: async () => {
      const res = await loansApi.get(loanId!);
      return res.data as Loan;
    },
  });

  const { data: repayments = [], isLoading: isLoadingReps } = useQuery({
    queryKey: ["loan-repayments", loanId],
    enabled: !!loanId,
    queryFn: async () => {
      try {
        const res = await loansApi.repaymentHistory(loanId!);
        return (res.data || []) as Repayment[];
      } catch {
        return [] as Repayment[];
      }
    },
  });

  const repaymentsList = repayments as Repayment[];
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
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
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
            {formatNaira(loan.outstanding_balance || 0)}
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
            className="bg-gray-200 px-3 py-1 rounded text-sm"
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
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border rounded px-2 py-1"
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
    </div>
  );
}
