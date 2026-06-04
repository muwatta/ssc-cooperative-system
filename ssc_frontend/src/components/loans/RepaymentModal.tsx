import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loansApi } from "@/api/services";
import { ErrorAlert, formatNaira } from "@/components/common";
import { HIJRI_MONTHS } from "@/types";

type Props = {
  loanId: number;
  outstanding: string;
  monthlyRepayment?: string; 
  defaultMonth?: number;
  defaultYear?: number;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function RepaymentModal({
  loanId,
  outstanding,
  monthlyRepayment,
  defaultMonth = 1,
  defaultYear = new Date().getFullYear(),
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const outstandingNum = parseFloat(outstanding);
  // Default to monthly repayment, but never exceed outstanding
  const defaultAmount = monthlyRepayment
    ? Math.min(parseFloat(monthlyRepayment), outstandingNum)
    : outstandingNum;

  const [amount, setAmount] = useState(defaultAmount.toString());
  const [hijriMonth, setHijriMonth] = useState(defaultMonth);
  const [hijriYear, setHijriYear] = useState(defaultYear);

  const isSettlement = parseFloat(amount) >= outstandingNum;

  const mutation = useMutation({
    mutationFn: () =>
      loansApi.postRepayment(loanId, {
        amount: parseFloat(amount),
        hijri_month: hijriMonth,
        hijri_year: hijriYear,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans-queue"] });
      qc.invalidateQueries({ queryKey: ["loan", String(loanId)] });
      qc.invalidateQueries({ queryKey: ["loan-repayments", String(loanId)] });
      onSuccess && onSuccess();
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.error || "Failed to post repayment."),
  });

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}

      <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Outstanding balance</span>
          <span className="font-bold text-red-600">
            {formatNaira(outstanding)}
          </span>
        </div>
        {monthlyRepayment && (
          <div className="flex justify-between">
            <span className="text-gray-500">Scheduled monthly repayment</span>
            <span className="font-medium">{formatNaira(monthlyRepayment)}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="repayment-amount" className="label">
            Repayment Amount (₦)
          </label>
          <input
            id="repayment-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={outstanding}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            required
          />
          {isSettlement && (
            <p className="mt-1 text-xs text-amber-600 font-medium">
              ⚠️ This payment will completely settle the loan. The loan will be
              marked as completed.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="repayment-month" className="label">
              Hijri Month
            </label>
            <select
              id="repayment-month"
              value={hijriMonth}
              onChange={(e) => setHijriMonth(Number(e.target.value))}
              className="input"
              title="Hijri month"
            >
              {HIJRI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="repayment-year" className="label">
              Hijri Year
            </label>
            <input
              id="repayment-year"
              type="number"
              value={hijriYear}
              onChange={(e) => setHijriYear(Number(e.target.value))}
              className="input"
              min={1400}
              required
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              parseFloat(amount) <= 0 ||
              parseFloat(amount) > outstandingNum
            }
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {mutation.isPending
              ? "Posting..."
              : isSettlement
                ? "Post Full Settlement"
                : "Post Repayment"}
          </button>
        </div>
      </div>
    </div>
  );
}
