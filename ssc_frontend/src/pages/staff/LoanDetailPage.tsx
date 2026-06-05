import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
import { AnimatedCard } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import AdminApprovalPreview from "@/components/admin/AdminApprovalPreview";
import RepaymentModal from "@/components/loans/RepaymentModal";
import { computeEndDate } from "@/utils/loanUtils";
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

  // Admin approval preview
  const [showApprovalPreview, setShowApprovalPreview] = useState(false);
  const [approvalProcessing, setApprovalProcessing] = useState(false);

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
        return res.data?.results ?? [];
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

  // Admin approval / rejection handlers
  const handleAdminApprove = async (note: string) => {
    if (!loanId) return;
    setApprovalProcessing(true);
    try {
      await loansApi.adminApprove(loanId, { note });
      setShowApprovalPreview(false);
      qc.invalidateQueries({ queryKey: ["loan", loanId] });
    } catch (error: any) {
      alert(error?.response?.data?.error || "Approval failed");
    } finally {
      setApprovalProcessing(false);
    }
  };

  const handleAdminReject = async (note: string) => {
    if (!loanId) return;
    setApprovalProcessing(true);
    try {
      await loansApi.committeeDecision(loanId, { decision: "reject", note });
      setShowApprovalPreview(false);
      qc.invalidateQueries({ queryKey: ["loan", loanId] });
    } catch (error: any) {
      alert(error?.response?.data?.error || "Rejection failed");
    } finally {
      setApprovalProcessing(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!loan) return <EmptyState icon="🔍" title="Loan not found" />;

  const outstandingPercent =
    loan.status === "active"
      ? Math.round(
          (parseFloat(loan.outstanding_balance) /
            parseFloat(loan.amount_approved || loan.amount_applied)) *
            100,
        )
      : 0;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Loan #{loan.id}</h1>
        <p className="text-gray-600">Applicant: {loan.applicant_name}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {(isAdmin || isCommittee) && loan.status === "active" && (
            <button
              onClick={() => setShowRepayment(true)}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Post Repayment
            </button>
          )}
          <button
            onClick={() => exportRepayments("pdf")}
            disabled={isExporting}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            title="Export loan repayment schedule as PDF"
          >
            📄 Export Schedule
          </button>

          {isAdmin && loan.status === "pending_admin" && (
            <button
              onClick={() => setShowApprovalPreview(true)}
              className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
            >
              🔍 Review & Approve
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards – now 5 cards on large screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <AnimatedCard className="bg-gradient-to-br from-primary-50 to-white p-4 shadow-lg">
          <p className="text-sm text-gray-600">Amount Applied</p>
          <p className="font-bold text-lg">
            {formatNaira(loan.amount_applied)}
          </p>
        </AnimatedCard>

        <AnimatedCard className="bg-gradient-to-br from-amber-50 via-amber-100 to-white p-4 shadow-lg">
          <p className="text-sm text-gray-600">Status</p>
          <p className="font-bold text-lg">{loan.status.toUpperCase()}</p>
        </AnimatedCard>

        <AnimatedCard className="bg-gradient-to-br from-sky-50 via-sky-100 to-white p-4 shadow-lg">
          <p className="text-sm text-gray-600">Duration</p>
          <p className="font-bold text-lg">
            {loan.proposed_duration_months} months
          </p>
        </AnimatedCard>

        <AnimatedCard className="bg-gradient-to-br from-red-50 via-red-100 to-white p-4 shadow-lg">
          <p className="text-sm text-gray-600">Outstanding</p>
          <p className="font-bold text-lg">
            {formatNaira(loan.outstanding_balance)}
          </p>
          {loan.status === "active" && (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all"
                  style={{ width: `${outstandingPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {outstandingPercent}% remaining
              </p>
            </div>
          )}
        </AnimatedCard>

        {/* NEW: Repayment End */}
        <AnimatedCard className="bg-gradient-to-br from-teal-50 to-white p-4 shadow-lg">
          <p className="text-sm text-gray-600">Repayment End</p>
          <p className="font-bold text-lg">{computeEndDate(loan)}</p>
          {loan.repayment_start_hijri_month && (
            <p className="text-xs text-gray-500 mt-1">
              From {loan.repayment_start_hijri_month}/
              {loan.repayment_start_hijri_year}
            </p>
          )}
        </AnimatedCard>
      </div>

      {/* Sureties Table */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Sureties</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
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

        <div className="table-container">
          <table className="table">
            <thead>
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

      {/* Repayment Modal – now using the reusable component */}
      {showRepayment && loan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-lg"
              onClick={() => setShowRepayment(false)}
            >
              ✕
            </button>
            <h2 className="text-xl font-semibold mb-4">Post Loan Repayment</h2>
            <RepaymentModal
              loanId={loanId!}
              outstanding={loan.outstanding_balance}
              monthlyRepayment={loan.proposed_monthly_repayment}
              defaultMonth={loan.repayment_start_hijri_month || 1}
              defaultYear={
                loan.repayment_start_hijri_year || new Date().getFullYear()
              }
              onClose={() => {
                setShowRepayment(false);
                invalidateRepayments();
              }}
            />
          </div>
        </div>
      )}

      {/* Admin Approval Preview Modal */}
      {showApprovalPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setShowApprovalPreview(false)}
          >
            ✕
          </button>
          <AdminApprovalPreview
            loanId={loanId!}
            onApprove={handleAdminApprove}
            onReject={handleAdminReject}
            isProcessing={approvalProcessing}
          />
        </div>
      )}
    </div>
  );
}
