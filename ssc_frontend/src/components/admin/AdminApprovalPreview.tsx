import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { loansApi } from "@/api/services";
import { formatNaira, PageLoader } from "@/components/common";

interface ApprovalPreviewProps {
  loanId: number;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
  isProcessing: boolean;
}

export default function AdminApprovalPreview({
  loanId,
  onApprove,
  onReject,
  isProcessing,
}: ApprovalPreviewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-preview", loanId],
    queryFn: () => loansApi.getAdminPreview(loanId).then((r) => r.data),
    enabled: !!loanId,
  });

  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  if (isLoading) return <PageLoader />;
  if (error) return <p className="text-red-600">Failed to load preview.</p>;
  if (!data) return null;

  const { borrower, repayment_breakdown, sureties } = data;

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-xl max-w-2xl mx-auto">
      <h2 className="text-xl font-bold">Loan Approval Preview</h2>

      {/* Borrower Info */}
      <section>
        <h3 className="font-semibold text-lg mb-2">Borrower</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            Name: <span className="font-medium">{borrower.full_name}</span>
          </div>
          <div>
            File No: <span className="font-medium">{borrower.file_number}</span>
          </div>
          <div>
            School:{" "}
            <span className="font-medium">{borrower.school_branch}</span>
          </div>
          <div>
            Amount Requested:{" "}
            <span className="font-medium">
              {formatNaira(borrower.amount_applied)}
            </span>
          </div>
          <div>
            Available Balance:{" "}
            <span className="font-medium">
              {formatNaira(borrower.available_balance)}
            </span>
          </div>
          <div>
            Self-Surety Max:{" "}
            <span className="font-medium">
              {formatNaira(borrower.self_surety_max)}
            </span>
          </div>
          <div>
            Max Borrowable:{" "}
            <span className="font-medium">
              {formatNaira(borrower.max_borrowable)}
            </span>
          </div>
          <div>
            Duration:{" "}
            <span className="font-medium">
              {borrower.proposed_duration_months} months
            </span>
          </div>
        </div>
      </section>

      {/* Repayment Breakdown */}
      <section>
        <h3 className="font-semibold text-lg mb-2">
          First Month Payment Breakdown
        </h3>
        <div className="text-sm space-y-1">
          <div>
            Monthly Repayment:{" "}
            <span className="font-medium">
              {formatNaira(repayment_breakdown.monthly_repayment)}
            </span>
          </div>
          <div>
            Ordinary Savings:{" "}
            <span className="font-medium">
              {formatNaira(repayment_breakdown.monthly_contribution)}
            </span>
          </div>
          <div className="font-semibold text-base">
            Total First Debit:{" "}
            <span className="text-primary-700">
              {formatNaira(repayment_breakdown.first_month_debit)}
            </span>
          </div>
        </div>
      </section>

      {/* Sureties */}
      {sureties?.length > 0 && (
        <section>
          <h3 className="font-semibold text-lg mb-2">External Sureties</h3>
          <div className="space-y-3">
            {sureties.map((s: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded border bg-gray-50 text-sm"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{s.full_name}</span>
                  <span className="text-gray-500">{s.file_number}</span>
                </div>
                <div>Guarantee: {formatNaira(s.amount_guaranteed)}</div>
                <div
                  className={s.eligible ? "text-green-600" : "text-red-600"}
                >
                  {s.eligible ? "Eligible" : "Not eligible"}
                </div>
                {!s.eligible && s.reasons.length > 0 && (
                  <ul className="list-disc ml-4 text-xs text-red-600">
                    {s.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                <div>Status: {s.status}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="approve-note" className="block text-sm mb-1">
            Approve Note (optional)
          </label>
          <textarea
            id="approve-note"
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            className="w-full border rounded p-2 text-sm"
            rows={2}
            placeholder="Optional note for approval"
          />
          <button
            onClick={() => onApprove(approveNote)}
            disabled={isProcessing}
            className="mt-2 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Approve Loan
          </button>
        </div>
        <div className="flex-1">
          <label htmlFor="reject-note" className="block text-sm mb-1">
            Rejection Reason (required)
          </label>
          <textarea
            id="reject-note"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="w-full border rounded p-2 text-sm"
            rows={2}
            placeholder="Reason for rejection"
          />
          <button
            onClick={() => onReject(rejectNote)}
            disabled={isProcessing || !rejectNote.trim()}
            className="mt-2 w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            Reject Loan
          </button>
        </div>
      </div>
    </div>
  );
}