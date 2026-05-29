import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loansApi } from "@/api/services";
import { ErrorAlert, formatNaira } from "@/components/common";
import { HIJRI_MONTHS } from "@/types";

type Props = {
  loanId: number;
  outstanding: string;
  defaultMonth?: number;
  defaultYear?: number;
  onClose: () => void;
  onSuccess?: () => void;
};

type FormValues = {
  amount: string;
  hijri_month: number;
  hijri_year: number;
};

export default function RepaymentModal({
  loanId,
  outstanding,
  defaultMonth = 1,
  defaultYear = new Date().getFullYear(),
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      amount: outstanding,
      hijri_month: defaultMonth,
      hijri_year: defaultYear,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      loansApi.postRepayment(loanId, {
        amount: data.amount,
        hijri_month: data.hijri_month,
        hijri_year: data.hijri_year,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans-queue"] });
      qc.invalidateQueries({ queryKey: ["loan", String(loanId)] });
      qc.invalidateQueries({ queryKey: ["loan-repayments", String(loanId)] });
      onSuccess && onSuccess();
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || "Failed to post repayment."),
  });

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Outstanding Balance</span>
          <span className="font-semibold text-warning-700">{formatNaira(outstanding)}</span>
        </div>
      </div>

      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4"
      >
        <div>
          <label className="label">Repayment Amount (₦)</label>
          <input
            {...register("amount", { required: true })}
            type="number"
            step="0.01"
            className="input"
            min="0.01"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Hijri Month</label>
            <select {...register("hijri_month", { valueAsNumber: true })} className="input">
              {HIJRI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Hijri Year</label>
            <input
              {...register("hijri_year", { valueAsNumber: true, required: true })}
              type="number"
              className="input"
              min={1400}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
            {isSubmitting ? "Posting..." : "Post Repayment"}
          </button>
        </div>
      </form>
    </div>
  );
}
