import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
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
  <div className="text-center py-12">
    <div className="text-6xl mb-4">{icon}</div>
    <p className="text-gray-600 text-lg">{title}</p>
  </div>
);

const PageLoader = () => (
  <div className="flex justify-center items-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
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

  const printStyles = `
    @media print {
      .no-print { display: none !important; }
      .print-page {
        padding: 40px 30px;
        font-size: 14px;
        background: white;
        color: black;
        max-width: 100%;
        margin: 0 auto;
      }
      .print-header {
        text-align: center;
        border-bottom: 3px double #000;
        padding-bottom: 10px;
        margin-bottom: 20px;
      }
      .print-header h1 {
        font-size: 24px;
        margin: 0;
        letter-spacing: 2px;
      }
      .print-header p {
        margin: 4px 0;
        color: #333;
      }
      .print-section {
        margin-bottom: 20px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 15px;
      }
      .print-section:last-child {
        border-bottom: none;
      }
      .print-section h2 {
        font-size: 18px;
        margin-bottom: 10px;
        border-bottom: 1px solid #eee;
        padding-bottom: 4px;
        background: #f9fafb;
        padding: 6px 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 13px;
      }
      th, td {
        border: 1px solid #ccc;
        padding: 6px 10px;
        text-align: left;
      }
      th {
        background: #f3f4f6;
        font-weight: 600;
      }
      .signature-block {
        display: flex;
        justify-content: space-between;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px dashed #aaa;
      }
      .signature-item {
        text-align: center;
        min-width: 200px;
      }
      .signature-line {
        border-top: 2px solid #000;
        width: 180px;
        margin: 30px auto 6px;
      }
      .footer {
        margin-top: 20px;
        text-align: center;
        font-size: 12px;
        color: #666;
        border-top: 1px solid #ddd;
        padding-top: 10px;
      }
    }
  `;

  return (
    <>
      <style>{printStyles}</style>

      <div className="print-page max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
              Loan #{loan.id}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Applicant:{" "}
              <span className="font-medium">{loan.applicant_name}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.print()}
              className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-1"
            >
              🖨️ Print
            </button>
            {(isAdmin || isCommittee) && loan.status === "active" && (
              <button
                onClick={() => setShowRepayment(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
              >
                Post Repayment
              </button>
            )}
            <button
              onClick={() => exportRepayments("pdf")}
              disabled={isExporting}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 shadow-sm"
            >
              📄 Export Schedule
            </button>
            {isAdmin && loan.status === "pending_admin" && (
              <button
                onClick={() => setShowApprovalPreview(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
              >
                🔍 Review & Approve
              </button>
            )}
          </div>
        </div>

        {/* Print-only header */}
        <div className="print-only hidden print:block">
          <div className="print-header">
            <h1>SOLACE STAFF COOPERATIVE LTD</h1>
            <p>Loan Certificate – #{loan.id}</p>
            <p>Issued: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Amount Applied
            </p>
            <p className="text-xl font-bold text-gray-800 dark:text-white mt-1">
              {formatNaira(loan.amount_applied)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Status
            </p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {loan.status.toUpperCase()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Duration
            </p>
            <p className="text-xl font-bold text-gray-800 dark:text-white mt-1">
              {loan.proposed_duration_months} months
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Outstanding
            </p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
              {formatNaira(loan.outstanding_balance)}
            </p>
            {loan.status === "active" && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-primary-600 rounded-full transition-all"
                    style={{ width: `${outstandingPercent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {outstandingPercent}%
                </span>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Repayment End
            </p>
            <p className="text-xl font-bold text-gray-800 dark:text-white mt-1">
              {computeEndDate(loan)}
            </p>
            {loan.repayment_start_hijri_month && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                From {loan.repayment_start_hijri_month}/
                {loan.repayment_start_hijri_year}
              </p>
            )}
          </div>
        </div>

        {/* Two-column layout: Applicant + Sureties */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applicant Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-800 dark:text-white">
                Applicant Information
              </h2>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Name</span>
                <span className="font-medium">{loan.applicant_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  File No.
                </span>
                <span className="font-medium">
                  {loan.applicant_file_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Branch</span>
                <span className="font-medium">{loan.school_branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Designation
                </span>
                <span className="font-medium">{loan.designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Phone</span>
                <span className="font-medium">{loan.phone_numbers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Purpose
                </span>
                <span className="font-medium">{loan.purpose}</span>
              </div>
            </div>
          </div>

          {/* Sureties */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-800 dark:text-white">
                Sureties
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Layer</th>
                    <th className="px-3 py-2 text-left">Member</th>
                    <th className="px-3 py-2 text-right">Guaranteed</th>
                    <th className="px-3 py-2 text-right">Remaining</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.sureties && loan.sureties.length > 0 ? (
                    loan.sureties.map((s) => (
                      <tr
                        key={s.id}
                        className="border-t border-gray-100 dark:border-gray-700"
                      >
                        <td className="px-3 py-2 font-mono text-gray-500 dark:text-gray-400">
                          #{s.layer}
                        </td>
                        <td className="px-3 py-2">
                          {s.is_self_surety ? (
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Self‑surety (borrower)
                            </span>
                          ) : (
                            `${s.surety_file_number} — ${s.surety_name}`
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatNaira(s.amount_guaranteed)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-amber-600 dark:text-amber-400">
                          {formatNaira(s.current_liability)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              s.status === "active" || s.status === "confirmed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                : s.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-gray-500 dark:text-gray-400"
                      >
                        No sureties attached
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Note about self‑surety */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <p>
                🔒 <strong>Self‑surety</strong> is the borrower's locked
                savings. It is released when the loan is fully repaid.
              </p>
            </div>
          </div>
        </div>

        {/* Approval Details (if any) */}
        {(loan.committee_decision_note ||
          loan.admin_final_approval_note ||
          loan.status === "hos_approved") && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-800 dark:text-white">
                Approvals
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {loan.committee_decision_note && (
                <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-r">
                  <p className="text-sm">
                    <strong>Committee Approval:</strong>{" "}
                    {loan.committee_decision_note}
                  </p>
                </div>
              )}
              {loan.admin_final_approval_note && (
                <div className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-r">
                  <p className="text-sm">
                    <strong>Admin Approval:</strong>{" "}
                    {loan.admin_final_approval_note}
                  </p>
                </div>
              )}
              {loan.status === "hos_approved" && (
                <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-r">
                  <p className="text-sm">
                    <strong>HOS Approval:</strong> Final Head of School sign-off
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Repayment History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-800 dark:text-white">
              Repayment History
            </h2>
            <div className="flex gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition"
              >
                Print
              </button>
              <button
                onClick={() => exportRepayments("csv")}
                disabled={isExporting || repaymentsList.length === 0}
                className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition disabled:opacity-50"
              >
                CSV
              </button>
              <button
                onClick={() => exportRepayments("pdf")}
                disabled={isExporting || repaymentsList.length === 0}
                className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition disabled:opacity-50"
              >
                PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left">Hijri Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Before</th>
                  <th className="px-3 py-2 text-right">After</th>
                  <th className="px-3 py-2 text-left">Posted By</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingReps ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : repaymentsList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No repayments yet
                    </td>
                  </tr>
                ) : (
                  pagedReps.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                        {r.hijri_display}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-green-600 dark:text-green-400">
                        {formatNaira(r.amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                        {formatNaira(r.balance_before)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                        {formatNaira(r.balance_after)}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                        {r.verified_by_name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalRecs > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 no-print">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Show
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                  className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  aria-label="Rows per page"
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
                  className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Signatures (print only) */}
        <div className="signature-block print-section no-print hidden print:flex">
          <div className="signature-item">
            <div className="signature-line"></div>
            <p className="text-sm font-medium">Borrower's Signature</p>
            <p className="text-xs text-gray-500">Date: ________________</p>
          </div>
          <div className="signature-item">
            <div className="signature-line"></div>
            <p className="text-sm font-medium">Secretary / Admin</p>
            <p className="text-xs text-gray-500">Date: ________________</p>
          </div>
          <div className="signature-item">
            <div className="signature-line"></div>
            <p className="text-sm font-medium">Head of School</p>
            <p className="text-xs text-gray-500">Date: ________________</p>
          </div>
        </div>

        <div className="footer no-print hidden print:block">
          <p>
            Solace Staff Cooperative Ltd – This is a computer-generated
            certificate
          </p>
          <p>Printed on: {new Date().toLocaleString()}</p>
        </div>

        {/* Repayment Modal */}
        {showRepayment && loan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full relative shadow-2xl">
              <button
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
                onClick={() => setShowRepayment(false)}
              >
                ✕
              </button>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                Post Loan Repayment
              </h2>
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
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 no-print">
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
    </>
  );
}
