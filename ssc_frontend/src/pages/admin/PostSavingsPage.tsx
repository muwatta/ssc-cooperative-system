import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { membersApi, savingsApi } from "@/api/services";
import type { MemberSummary } from "@/types";

interface FormData {
  member: number;
  amount: number;
  hijri_month: number;
  hijri_year: number;
}

export default function PostSavingsPage() {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
    },
  });

  // Fixed useEffect with cleanup and proper state management
  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      try {
        setLoading(true);
        setIsError(false);
        setServerMessage(null);

        const response = await membersApi.summary();
        if (isMounted) {
          setMembers(response.data.results);
        }
      } catch {
        if (isMounted) {
          setServerMessage("Unable to load members for savings posting.");
          setIsError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = async (data: FormData) => {
    setServerMessage(null);
    setIsError(false);

    try {
      await savingsApi.postSavings(data);
      setServerMessage("Savings entry posted successfully.");
      reset({
        amount: 0,
        hijri_month: data.hijri_month,
        hijri_year: data.hijri_year,
      });
    } catch {
      setServerMessage("Failed to post savings. Please try again.");
      setIsError(true);
    }
  };

  return (
    <div className="card p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Post Savings</h1>
        <p className="text-sm text-gray-500">
          Record an ordinary savings payment for a member.
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Member</label>
          <select
            {...register("member", { required: "Please select a member" })}
            className="input"
            disabled={loading}
          >
            <option value="">Select a member</option>
            {loading ? (
              <option disabled>Loading members...</option>
            ) : (
              members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.file_number} — {member.full_name}
                </option>
              ))
            )}
          </select>
          {errors.member && (
            <p className="field-error">{errors.member.message}</p>
          )}
          {!loading && members.length === 0 && (
            <p className="field-error">No members found</p>
          )}
        </div>

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
              disabled={loading}
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
                min: { value: 1, message: "Month must be between 1 and 12" },
                max: { value: 12, message: "Month must be between 1 and 12" },
              })}
              type="number"
              min={1}
              max={12}
              className="input"
              disabled={loading}
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
                min: { value: 1, message: "Please enter a valid year" },
              })}
              type="number"
              className="input"
              disabled={loading}
            />
            {errors.hijri_year && (
              <p className="field-error">{errors.hijri_year.message}</p>
            )}
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="btn-primary w-full py-2.5"
            >
              {isSubmitting ? "Posting..." : "Post Savings"}
            </button>
          </div>
        </div>
      </form>

      {loading && (
        <div className="text-gray-600 mt-6 text-center">Loading members...</div>
      )}
    </div>
  );
}
