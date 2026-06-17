import { useState } from "react";
import { useForm } from "react-hook-form";
import { savingsApi } from "@/api/services";
import { HIJRI_MONTHS } from "@/types";

interface FormData {
  name: string;
  amount: number;
  hijri_month: number;
  hijri_year: number;
  description: string;
}

export default function PostDuesPage() {
  const [step, setStep] = useState<"form" | "confirm" | "executing">("form");
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      amount: 0,
      hijri_month: 1,
      hijri_year: new Date().getFullYear(),
      description: "",
    },
  });

  const formData = watch();

  // Step 1: Create the dues cycle (record only)
  const handleCreate = async (data: FormData) => {
    setServerMessage(null);
    setIsError(false);

    try {
      const response = await savingsApi.createDuesCycle({
        name: data.name || `Dues ${data.hijri_month}/${data.hijri_year}`,
        amount: data.amount,
        description: data.description,
        hijri_month: data.hijri_month,
        hijri_year: data.hijri_year,
        // If you need to target specific members, add: member_ids: [...]
      });
      setCycleId(response.data.id);
      setStep("confirm");
    } catch {
      setServerMessage("Failed to create dues cycle. Please try again.");
      setIsError(true);
    }
  };

  // Step 2: Execute – actually debit the members
  const handleConfirm = async () => {
    if (!cycleId) return;
    setServerMessage(null);
    setIsError(false);

    try {
      await savingsApi.postDuesCycle(cycleId);
      setStep("executing");
      setServerMessage("Dues posted successfully to all active members.");
      reset({
        name: "",
        amount: 0,
        description: "",
        hijri_month: formData.hijri_month,
        hijri_year: formData.hijri_year,
      });
      // Return to form after 3 seconds
      setTimeout(() => setStep("form"), 3000);
    } catch {
      setServerMessage("Failed to post dues. Please try again.");
      setIsError(true);
      setStep("form");
    }
  };

  const handleCancel = () => {
    setStep("form");
    setCycleId(null);
    setServerMessage(null);
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
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            isError
              ? "bg-danger-50 text-danger-700 border border-danger-200"
              : "bg-success-50 text-success-700 border border-success-200"
          }`}
        >
          {serverMessage}
        </div>
      )}

      {step === "form" && (
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Dues Name</label>
              <input
                {...register("name", {
                  required: "Name is required",
                })}
                type="text"
                className="input"
                placeholder="e.g. Termly Dues – Fall 2026"
              />
              {errors.name && (
                <p className="field-error">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="label">Amount (₦)</label>
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Hijri Month</label>
              <select
                {...register("hijri_month", {
                  required: "Hijri month is required",
                  valueAsNumber: true,
                })}
                className="input"
              >
                {HIJRI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {errors.hijri_month && (
                <p className="field-error">{errors.hijri_month.message}</p>
              )}
            </div>
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
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <input
              {...register("description")}
              className="input"
              placeholder="e.g. March 1448 term dues"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-2.5"
          >
            {isSubmitting ? "Creating cycle..." : "Create Dues Cycle"}
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-amber-800">
              Confirm Posting
            </h2>
            <p className="text-sm text-amber-700 mt-1">
              This will debit <strong>all active members</strong> with the
              amount <strong>₦{formData.amount?.toLocaleString()}</strong> for
              the month of{" "}
              {HIJRI_MONTHS.find((m) => m.value === formData.hijri_month)
                ?.label ?? formData.hijri_month}{" "}
              {formData.hijri_year}.
            </p>
            <p className="text-sm text-amber-700 mt-2">
              This action cannot be undone. Are you sure?
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Yes, Post Dues
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "executing" && (
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Posting dues to members…</p>
        </div>
      )}
    </div>
  );
}
