import { useState } from "react";
import { useForm } from "react-hook-form";
import { savingsApi } from "@/api/services";

interface FormData {
  amount: number;
  hijri_month: number;
  hijri_year: number;
  description: string;
}

export default function PostDuesPage() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      hijri_month: 1,
      hijri_year: new Date().getFullYear(),
      description: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setServerMessage(null);
    setIsError(false);

    try {
      await savingsApi.postDues({
        amount: data.amount,
        hijri_month: data.hijri_month,
        hijri_year: data.hijri_year,
        description: data.description,
      });
      setServerMessage("Dues posted successfully.");
      reset({
        amount: 0,
        description: "",
        hijri_month: data.hijri_month,
        hijri_year: data.hijri_year,
      });
    } catch {
      setServerMessage("Failed to post dues. Please try again.");
      setIsError(true);
    }
  };

  return (
    <div className="card p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Post Termly Dues</h1>
        <p className="text-sm text-gray-500">
          Create a dues charge for all active members in the selected Hijri
          period.
        </p>
      </div>

      {serverMessage && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${isError ? "bg-danger-50 text-danger-700 border border-danger-200" : "bg-success-50 text-success-700 border border-success-200"}`}
        >
          {serverMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Amount</label>
            <input
              {...register("amount", {
                required: "Amount is required",
                valueAsNumber: true,
                min: { value: 0.01, message: "Amount must be positive" },
              })}
              type="number"
              step="0.01"
              inputMode="decimal"
              min={0.01}
              className="input"
            />
            {errors.amount && (
              <p className="field-error">{errors.amount.message}</p>
            )}
          </div>
          <div>
            <label className="label">Hijri Month</label>
            <input
              {...register("hijri_month", {
                required: "Hijri month is required",
                valueAsNumber: true,
              })}
              type="number"
              min={1}
              max={12}
              className="input"
            />
            {errors.hijri_month && (
              <p className="field-error">{errors.hijri_month.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Hijri Year</label>
            <input
              {...register("hijri_year", {
                required: "Hijri year is required",
                valueAsNumber: true,
              })}
              type="number"
              className="input"
            />
            {errors.hijri_year && (
              <p className="field-error">{errors.hijri_year.message}</p>
            )}
          </div>
          <div>
            <label className="label">Description</label>
            <input
              {...register("description")}
              className="input"
              placeholder="e.g. March 1448 term dues"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-2.5"
        >
          {isSubmitting ? "Posting dues..." : "Post Dues to Active Members"}
        </button>
      </form>
    </div>
  );
}
