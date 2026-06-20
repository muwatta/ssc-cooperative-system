import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { HIJRI_MONTHS } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberId: number;
}

interface PreviewData {
  member_id: number;
  file_number: string;
  full_name: string;
  contribution: string;
  loan_repayment: string;
  total: string;
  has_active_loan: boolean;
  active_loan_id: number | null;
  active_loan_outstanding: string | null;
  new_outstanding: string | null;
  existing_savings: boolean;
  warning: string | null;
}

function CombinedDeductionModal({ isOpen, onClose, memberId }: Props) {
  const [hijriMonth, setHijriMonth] = useState(1);
  const [hijriYear, setHijriYear] = useState(1448);
  const qc = useQueryClient();

  const {
    data: preview,
    isLoading,
    refetch,
  } = useQuery<PreviewData>({
    queryKey: ["combined-deduction-preview", memberId, hijriMonth, hijriYear],
    queryFn: async () => {
      const res = await api.post("/savings/batch-monthly/", {
        hijri_month: hijriMonth,
        hijri_year: hijriYear,
        member_id: memberId,
        preview: true,
      });
      const deduction = res.data?.deductions?.[0];
      if (!deduction) {
        throw new Error("No deduction data found for this member.");
      }
      return {
        member_id: deduction.member_id,
        file_number: deduction.file_number,
        full_name: deduction.name,
        contribution: deduction.contribution,
        loan_repayment: deduction.loan_repayment,
        total: deduction.total_debit,
        has_active_loan: Number(deduction.loan_repayment) > 0,
        active_loan_id: null,
        active_loan_outstanding: null,
        new_outstanding: null,
        existing_savings: deduction.existing_savings || false,
        warning: deduction.warning || null,
      };
    },
    enabled: isOpen && !!memberId,
    staleTime: 0,
  });

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/savings/batch-monthly/", {
        hijri_month: hijriMonth,
        hijri_year: hijriYear,
        member_id: memberId,
        preview: false,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings-ledger"] });
      qc.invalidateQueries({ queryKey: ["loan-repayments"] });
      qc.invalidateQueries({ queryKey: ["member-balance"] });
      alert("Combined deduction posted successfully.");
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to post combined deduction.");
    },
  });

  if (!isOpen) return null;

  const contribution = preview ? parseFloat(preview.contribution) : 0;
  const loanRepayment = preview ? parseFloat(preview.loan_repayment) : 0;
  const total = preview ? parseFloat(preview.total) : 0;
  const hasActiveLoan = preview?.has_active_loan || false;
  const hasWarning = preview?.warning || false;
  const isZeroTotal = total === 0;
  const isPending = mutation.isPending || isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Post Combined Monthly Deduction</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-500">
            Loading preview...
          </div>
        ) : !preview ? (
          <div className="py-8 text-center text-red-500">
            Failed to load preview. Please try again.
          </div>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Member:</strong> {preview.full_name} (
                {preview.file_number})
              </p>
              {hasActiveLoan && (
                <p>
                  <strong>Active Loan #:</strong> {preview.active_loan_id}
                </p>
              )}

              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between">
                  <span>Monthly Contribution</span>
                  <span>₦{contribution.toFixed(2)}</span>
                </div>
                {hasActiveLoan && (
                  <div className="flex justify-between">
                    <span>Loan Repayment</span>
                    <span>₦{loanRepayment.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2 mt-2">
                  <span>Total Deduction</span>
                  <span>₦{total.toFixed(2)}</span>
                </div>
              </div>

              {hasWarning && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-3 text-sm">
                  ⚠️ {preview.warning}
                </div>
              )}

              {isZeroTotal && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">
                  No deduction to post (contribution and loan repayment are both
                  zero).
                </div>
              )}

              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-700">
                  Hijri Month
                </label>
                <select
                  value={hijriMonth}
                  onChange={(e) => setHijriMonth(Number(e.target.value))}
                  className="input w-full"
                  aria-label="Select Hijri month"
                >
                  {HIJRI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Hijri Year
                </label>
                <input
                  type="number"
                  value={hijriYear}
                  onChange={(e) => setHijriYear(Number(e.target.value))}
                  className="input w-full"
                  min={1400}
                  max={1500}
                  aria-label="Enter Hijri year"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={isPending || isZeroTotal}
                className="btn-primary flex-1"
              >
                {isPending ? "Posting..." : "Confirm & Post"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CombinedDeductionModal;
