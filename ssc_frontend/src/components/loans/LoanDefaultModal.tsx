import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loansApi } from "@/api/services";
import { formatNaira } from "@/components/common";
import type { LoanApplication } from "@/types";

interface Props {
  loan: LoanApplication;
  onClose: () => void;
}

export default function LoanDefaultModal({ loan, onClose }: Props) {
  const qc = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const outstanding = parseFloat(loan.outstanding_balance || "0");

  const mutation = useMutation({
    mutationFn: () => loansApi.markDefault(loan.id),
    onSuccess: (res) => {
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ["loans-queue"] });
      qc.invalidateQueries({ queryKey: ["loan", loan.id] });
    },
    onError: (e: any) => {
      setError(e?.response?.data?.error || "Failed to process default.");
    },
  });

  // Success state
  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">
              Loan #{loan.id} has been marked as defaulted
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">
              Outstanding balance transferred to sureties
            </p>
          </div>
        </div>

        {result.detail?.transferred?.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Transfer breakdown:
            </p>
            <div className="space-y-2">
              {result.detail.transferred.map((t: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm"
                >
                  <span className="font-medium text-gray-800 dark:text-white">
                    {t.file_number}
                  </span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    -{formatNaira(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.detail?.errors?.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              Some transfers failed:
            </p>
            {result.detail.errors.map((e: any, i: number) => (
              <p
                key={i}
                className="text-xs text-yellow-700 dark:text-yellow-400"
              >
                {e.file_number}: {e.error}
              </p>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <span className="text-2xl shrink-0">🚨</span>
        <div>
          <p className="font-semibold text-red-800 dark:text-red-300">
            This action is irreversible
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Marking this loan as defaulted will permanently transfer the
            outstanding balance to the sureties' savings accounts.
          </p>
        </div>
      </div>

      {/* Loan summary */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Borrower</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {loan.applicant_name} ({loan.applicant_file_number})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Amount Approved
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatNaira(loan.amount_approved || loan.amount_applied)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Outstanding Balance
          </span>
          <span className="font-bold text-red-600 dark:text-red-400 text-base">
            {formatNaira(outstanding)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Repayments Made
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {loan.repayments_count ?? 0}
          </span>
        </div>
      </div>

      {/* Surety breakdown */}
      {loan.sureties && loan.sureties.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Sureties who will be charged:
          </p>
          <div className="space-y-2">
            {loan.sureties
              .filter((s) => s.status === "confirmed")
              .map((s) => {
                const proportion =
                  parseFloat(String(s.amount_guaranteed)) /
                  loan.sureties
                    .filter((x) => x.status === "confirmed")
                    .reduce(
                      (sum, x) => sum + parseFloat(String(x.amount_guaranteed)),
                      0,
                    );
                const charge = outstanding * proportion;
                return (
                  <div
                    key={s.id}
                    className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-lg text-sm"
                  >
                    <span className="text-gray-800 dark:text-white">
                      {s.is_self_surety
                        ? `Self-surety (${loan.applicant_name})`
                        : `${s.surety_file_number} — ${s.surety_name}`}
                    </span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      -{formatNaira(charge.toFixed(2))}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Confirmation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-red-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          I understand this is irreversible and confirm that this loan should be
          marked as defaulted.
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!confirmed || mutation.isPending}
          className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {mutation.isPending ? "Processing…" : "Mark as Defaulted"}
        </button>
      </div>
    </div>
  );
}
