import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
import { AnimatedCard } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import AdminApprovalPreview from "@/components/admin/AdminApprovalPreview";
import RepaymentModal from "@/components/loans/RepaymentModal";
import { computeEndDate } from "@/utils/loanUtils";
import type { LoanApplication, Repayment } from "@/types";
import "@/styles/print.css";

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

  const [isExporting, setIsExporting] = useState(false);

  const exportRepayments = async (format: "csv" | "pdf") => {
    if (!loanId || repayments.length === 0) return;
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

  // ── Print styles ──────────────────────────────────────────────
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
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
      }
      .detail-label {
        font-weight: 600;
        color: #374151;
      }
      .detail-value {
        text-align: right;
      }
      .stamp {
        border: 2px solid #1a56db;
        padding: 8px 12px;
        border-radius: 6px;
        background: #f0f7ff;
        display: inline-block;
        margin: 4px 0;
      }
      .stamp-green {
        border-color: #0b7e3d;
        background: #f0fdf4;
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
      .print-table-wrapper {
        overflow-x: auto;
      }
    }
  `;

  return (
    <>
      <style>{printStyles}</style>

      <div className="print-page max-w-3xl mx-auto p-4">
        {/* Print Header */}
        <div className="print-header no-print hidden">
          <h1>SOLACE STAFF COOPERATIVE LTD</h1>
          <p>Loan Certificate</p>
        </div>

        {/* ─── Header ─── */}
        <div className="flex justify-between items-start mb-6 no-print">
          <div>
            <h1 className="text-2xl font-bold">Loan #{loan.id}</h1>
            <p className="text-gray-600">Applicant: {loan.applicant_name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.print()}
              className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
            >
              🖨️ Print Certificate
            </button>
            {(isAdmin || isCommittee) && loan.status === "active" && (
              <button
                onClick={() => setShowRepayment(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Post Repayment
              </button>
            )}
            <button
              onClick={() => exportRepayments("pdf")}
              disabled={isExporting}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
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

        {/* ─── Print-only header ─────────────────────────────── */}
        <div className="print-only hidden print:block">
          <div className="print-header">
            <h1>SOLACE STAFF COOPERATIVE LTD</h1>
            <p>Loan Certificate – #{loan.id}</p>
            <p>Issued: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* ─── Summary Cards ────────────────────────────────── */}
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

        {/* ─── Applicant Details (Printable) ────────────────── */}
        <div className="print-section">
          <h2 className="text-lg font-semibold mb-2">Applicant Information</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">Name:</span> {loan.applicant_name}
            </div>
            <div>
              <span className="font-medium">File No.:</span>{" "}
              {loan.applicant_file_number}
            </div>
            <div>
              <span className="font-medium">Branch:</span> {loan.school_branch}
            </div>
            <div>
              <span className="font-medium">Designation:</span>{" "}
              {loan.designation}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Phone:</span> {loan.phone_numbers}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Purpose:</span> {loan.purpose}
            </div>
          </div>
        </div>

        {/* ─── Sureties Table ────────────────────────────────── */}
        <div className="print-section">
          <h2 className="text-lg font-semibold mb-2">Sureties</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Member</th>
                  <th>Guaranteed</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loan.sureties && loan.sureties.length > 0 ? (
                  loan.sureties.map((s) => (
                    <tr key={s.id}>
                      <td>#{s.layer}</td>
                      <td>
                        {s.surety_file_number} — {s.surety_name}
                      </td>
                      <td>{formatNaira(s.amount_guaranteed)}</td>
                      <td>{formatNaira(s.current_liability)}</td>
                      <td>{s.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500">
                      No sureties attached
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Approvals ────────────────────────────────────── */}
        {(loan.committee_decision_note ||
          loan.admin_final_approval_note ||
          loan.status === "hos_approved") && (
          <div className="print-section">
            <h2 className="text-lg font-semibold mb-2">Approval Details</h2>
            <div className="space-y-3">
              {loan.committee_decision_note && (
                <div className="stamp">
                  <p>
                    <strong>Committee Approval:</strong>{" "}
                    {loan.committee_decision_note}
                  </p>
                  <p className="text-sm text-gray-600">Approved by Committee</p>
                </div>
              )}
              {loan.admin_final_approval_note && (
                <div className="stamp">
                  <p>
                    <strong>Admin Approval:</strong>{" "}
                    {loan.admin_final_approval_note}
                  </p>
                  <p className="text-sm text-gray-600">Final Admin Sign-off</p>
                </div>
              )}
              {loan.status === "hos_approved" && (
                <div className="stamp stamp-green">
                  <p>
                    <strong>HOS Approval:</strong> Final Head of School sign-off
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Repayment History ────────────────────────────── */}
        <div className="print-section">
          <h2 className="text-lg font-semibold mb-2">Repayment History</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Hijri Date</th>
                  <th>Amount</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Posted By</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingReps ? (
                  <tr>
                    <td colSpan={5} className="text-center">
                      Loading...
                    </td>
                  </tr>
                ) : repayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500">
                      No repayments yet
                    </td>
                  </tr>
                ) : (
                  repayments.map((r) => (
                    <tr key={r.id}>
                      <td>{r.hijri_display}</td>
                      <td>{formatNaira(r.amount)}</td>
                      <td>{formatNaira(r.balance_before)}</td>
                      <td>{formatNaira(r.balance_after)}</td>
                      <td>{r.verified_by_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Signatures ────────────────────────────────────── */}
        <div className="signature-block print-section">
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

        <div className="footer">
          <p>
            Solace Staff Cooperative Ltd – This is a computer-generated
            certificate
          </p>
          <p>Printed on: {new Date().toLocaleString()}</p>
        </div>

        {/* ─── Modals & Overlays ────────────────────────────── */}
        {showRepayment && loan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
            <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
              <button
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-lg"
                onClick={() => setShowRepayment(false)}
              >
                ✕
              </button>
              <h2 className="text-xl font-semibold mb-4">
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
