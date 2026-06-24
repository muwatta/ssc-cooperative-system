import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { loansApi } from "@/api/services";
import { formatNaira, PageLoader } from "@/components/common";

interface ApprovalPreviewProps {
  loanId: number;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
  onClose: () => void;
  isProcessing: boolean;
}

export default function AdminApprovalPreview({
  loanId,
  onApprove,
  onReject,
  onClose,
  isProcessing,
}: ApprovalPreviewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-preview", loanId],
    queryFn: () => loansApi.getAdminPreview(loanId).then((r) => r.data),
    enabled: !!loanId,
  });

  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  if (isLoading)
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-auto p-8">
        <PageLoader />
      </div>
    );

  if (error)
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-auto p-8">
        <p className="text-red-600 dark:text-red-400 text-center">
          Failed to load loan preview.
        </p>
      </div>
    );

  if (!data) return null;

  const { borrower, repayment_breakdown, sureties } = data;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Admin Approval Preview
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loan #{loanId}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
        {/* Borrower Info */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Borrower
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Name</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {borrower.full_name}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">File Number</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {borrower.file_number}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">School Branch</p>
              <p className="font-semibold text-gray-900 dark:text-white capitalize">
                {borrower.school_branch}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Duration</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {borrower.proposed_duration_months} months
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">
                Amount Requested
              </p>
              <p className="font-bold text-primary-700 dark:text-primary-400 text-base">
                {formatNaira(borrower.amount_applied)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">
                Available Balance
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatNaira(borrower.available_balance)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">
                Self-Surety Max
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatNaira(borrower.self_surety_max)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Max Borrowable</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatNaira(borrower.max_borrowable)}
              </p>
            </div>
          </div>
        </section>

        {/* Repayment Breakdown */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            First Month Payment Breakdown
          </h3>
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                Monthly Repayment
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatNaira(repayment_breakdown.monthly_repayment)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                Ordinary Savings
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatNaira(repayment_breakdown.monthly_contribution)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-primary-200 dark:border-primary-700">
              <span className="font-bold text-primary-800 dark:text-primary-200">
                Total First Debit
              </span>
              <span className="font-bold text-primary-700 dark:text-primary-300 text-base">
                {formatNaira(repayment_breakdown.first_month_debit)}
              </span>
            </div>
          </div>
        </section>

        {/* Sureties */}
        {sureties?.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Sureties
            </h3>
            <div className="space-y-2">
              {sureties.map((s: any, idx: number) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 text-sm ${
                    s.eligible
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {s.full_name}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.eligible
                          ? "bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300"
                          : "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {s.eligible ? "Eligible" : "Not Eligible"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-gray-600 dark:text-gray-300">
                    <span>{s.file_number}</span>
                    <span>Guarantees: {formatNaira(s.amount_guaranteed)}</span>
                    <span>Status: {s.status}</span>
                  </div>
                  {!s.eligible && s.reasons?.length > 0 && (
                    <ul className="mt-1 text-xs text-red-600 dark:text-red-400 list-disc ml-4">
                      {s.reasons.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action section */}
        {action === null && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setAction("reject")}
              className="flex-1 py-3 rounded-xl border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              Reject Loan
            </button>
            <button
              onClick={() => setAction("approve")}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition"
            >
              Approve Loan
            </button>
          </div>
        )}

        {action === "approve" && (
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="font-semibold text-green-700 dark:text-green-400">
              Confirm Approval
            </p>
            <textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={2}
              placeholder="Optional approval note..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => setAction(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Back
              </button>
              <button
                onClick={() => onApprove(approveNote)}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-50 transition"
              >
                {isProcessing ? "Processing…" : "Confirm Approval"}
              </button>
            </div>
          </div>
        )}

        {action === "reject" && (
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="font-semibold text-red-700 dark:text-red-400">
              Confirm Rejection
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full border border-red-300 dark:border-red-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={2}
              placeholder="Reason for rejection (required)..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => setAction(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Back
              </button>
              <button
                onClick={() => onReject(rejectNote)}
                disabled={isProcessing || !rejectNote.trim()}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50 transition"
              >
                {isProcessing ? "Processing…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
