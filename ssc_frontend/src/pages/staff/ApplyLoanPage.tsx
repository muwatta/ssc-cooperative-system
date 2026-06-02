import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { useState, useEffect } from "react";
import { loansApi, membersApi, savingsApi } from "@/api/services";
import {
  PageHeader,
  ErrorAlert,
  SuccessAlert,
  formatNaira,
  PageLoader,
} from "@/components/common";
import { HIJRI_MONTHS as HM, MemberSummary } from "@/types";

interface SuretyFormItem {
  member_id: number;
  member_label: string;
  amount: string;
}

interface ApplyLoanFormValues {
  amount_applied: string;
  purpose: string;
  monthly_salary: string;
  home_address: string;
  phone_numbers: string;
  proposed_monthly_repayment: string;
  proposed_duration_months: number;
  date_of_last_loan?: string;
  amount_outstanding_prev?: string;
  repayment_start_hijri_month: number;
  repayment_start_hijri_year: number;
  sureties?: SuretyFormItem[];
}

function SuretyRow({
  index,
  register,
  setValue,
  watch,
  remove,
  errors,
}: {
  index: number;
  register: any;
  setValue: any;
  watch: any;
  remove: (index: number) => void;
  errors: any;
}) {
  const searchTerm = watch(`sureties.${index}.member_label`) || "";
  const selectedId = watch(`sureties.${index}.member_id`) || 0;
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: results } = useQuery<MemberSummary[]>({
    queryKey: ["member-search", index, searchTerm],
    queryFn: () => membersApi.summary(searchTerm).then((r) => r.data.results),
    enabled: searchTerm.length > 2,
  });

  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-4 transition-all hover:shadow-sm">
      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Surety Member
          </label>
          <div className="relative">
            <input
              {...register(`sureties.${index}.member_label`, {
                required: "Search and select a member",
                onChange: () => {
                  setValue(`sureties.${index}.member_id`, 0);
                  setShowDropdown(true);
                },
                onFocus: () => setShowDropdown(true),
              })}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                errors?.sureties?.[index]?.member_label
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
              }`}
              placeholder="Search by file number or name..."
              autoComplete="off"
            />
            <input
              type="hidden"
              {...register(`sureties.${index}.member_id`, {
                valueAsNumber: true,
                validate: (value: any) =>
                  value > 0 || "Select a valid member from the list",
              })}
            />

            {results && results.length > 0 && showDropdown && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {results.slice(0, 6).map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-primary-50"
                    onClick={() => {
                      setValue(`sureties.${index}.member_id`, member.id);
                      setValue(
                        `sureties.${index}.member_label`,
                        `${member.file_number} – ${member.full_name}`,
                      );
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-medium text-gray-900">
                      {member.file_number}
                    </span>
                    <span className="ml-2 text-sm text-gray-600">
                      {member.full_name}
                    </span>
                    <span className="ml-2 text-xs text-gray-400 capitalize">
                      {member.school_branch}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {errors?.sureties?.[index]?.member_label && (
            <p className="mt-1 text-xs text-red-600">
              {String(errors.sureties[index].member_label.message)}
            </p>
          )}
          {errors?.sureties?.[index]?.member_id && selectedId <= 0 && (
            <p className="mt-1 text-xs text-red-600">
              {String(errors.sureties[index].member_id.message)}
            </p>
          )}
        </div>

        <div className="md:col-span-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Amount Guaranteed (₦)
          </label>
          <input
            {...register(`sureties.${index}.amount`, {
              required: "Enter a guarantee amount",
              valueAsNumber: true,
              min: 0.01,
            })}
            type="number"
            step="0.01"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              errors?.sureties?.[index]?.amount
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
            }`}
            placeholder="0.00"
          />
          {errors?.sureties?.[index]?.amount && (
            <p className="mt-1 text-xs text-red-600">
              {String(errors.sureties[index].amount.message)}
            </p>
          )}
        </div>

        <div className="md:col-span-2 flex items-center justify-end gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={() => remove(index)}
              className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <svg
                className="mr-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApplyLoanPage() {
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Get member profile and balance
  const { data: profile } = useQuery({
    queryKey: ["member-profile"],
    queryFn: () => membersApi.me().then((r) => r.data),
  });

  const { data: balanceData } = useQuery({
    queryKey: ["member-balance", profile?.id],
    queryFn: () => savingsApi.getBalance(profile!.id).then((r) => r.data),
    enabled: !!profile?.id,
  });

  const availableBalance = balanceData?.available_balance
    ? Number(balanceData.available_balance)
    : 0;

  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["loan-eligibility"],
    queryFn: () => loansApi.eligibility().then((r) => r.data),
  });

  // ---------- Dynamic limits from backend ----------
  const selfSuretyMax = eligibility?.self_surety_max
    ? Number(eligibility.self_surety_max)
    : 0;
  const maxBorrowable = eligibility?.max_borrowable
    ? Number(eligibility.max_borrowable)
    : 0;
  const ratioPercent = eligibility?.loan_amount_ratio
    ? Math.round(Number(eligibility.loan_amount_ratio) * 100)
    : 75;
  const maxSureties = eligibility?.max_sureties ?? 5;
  const canApply = eligibility?.eligible ?? false;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ApplyLoanFormValues>({
    defaultValues: {
      amount_applied: "",
      purpose: "",
      monthly_salary: "",
      home_address: "",
      phone_numbers: "",
      proposed_monthly_repayment: "",
      proposed_duration_months: 6,
      repayment_start_hijri_month: 1,
      repayment_start_hijri_year: new Date().getFullYear() + 1,
      sureties: [{ member_id: 0, member_label: "", amount: "" }], // placeholder row; removed on submit if not needed
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sureties",
  });

  const amountApplied = Number(watch("amount_applied")) || 0;
  const duration = watch("proposed_duration_months") || 6;
  const monthlyRepayment = duration > 0 ? amountApplied / duration : 0;

  // Determine if external sureties are needed (gap between self-surety and max borrowable)
  const needsExternalSureties =
    amountApplied > selfSuretyMax && amountApplied <= maxBorrowable;
  const exceedsMax = amountApplied > maxBorrowable;

  // Clear extra surety rows when not needed
  useEffect(() => {
    if (!needsExternalSureties && fields.length > 1) {
      while (fields.length > 1) remove(1);
    }
  }, [needsExternalSureties, fields, remove]);

  useEffect(() => {
    if (monthlyRepayment > 0) {
      setValue("proposed_monthly_repayment", monthlyRepayment.toFixed(2));
    } else {
      setValue("proposed_monthly_repayment", "");
    }
  }, [monthlyRepayment, setValue]);

  const applyMutation = useMutation({
    mutationFn: (data: any) => loansApi.apply(data),
    onSuccess: () => {
      setSuccess(
        "✓ Loan application submitted successfully! Awaiting committee review.",
      );
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e: any) => {
      const d = e?.response?.data;
      if (d?.eligibility) setError(d.eligibility.join(" | "));
      else if (d?.amount_applied) setError(d.amount_applied[0]);
      else if (d?.sureties)
        setError(
          Array.isArray(d.sureties)
            ? d.sureties.join(" | ")
            : String(d.sureties),
        );
      else setError("Failed to submit application. Please try again.");
      setSuccess("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const onSubmit = (data: ApplyLoanFormValues) => {
    const payload = { ...data };
    if (needsExternalSureties) {
      payload.sureties = (data.sureties ?? []).filter((s) => s.member_id > 0);
    } else {
      delete payload.sureties;
    }
    applyMutation.mutate(payload);
  };

  if (isLoading) return <PageLoader />;

  // Determine if submit is allowed
  const sufficientSureties =
    !needsExternalSureties ||
    (needsExternalSureties && fields.filter((f) => f.member_id > 0).length > 0);
  const isSubmitDisabled =
    isSubmitting || !canApply || exceedsMax || !sufficientSureties;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <PageHeader
        title="Apply for a Loan"
        subtitle="Submit a new loan application for committee review"
        back={{ to: "/my-loans", label: "Back to My Loans" }}
      />

      {/* Eligibility Card */}
      <div
        className={`mb-6 overflow-hidden rounded-xl border-2 shadow-md transition-all ${
          canApply
            ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50"
            : "border-red-200 bg-gradient-to-r from-red-50 to-rose-50"
        }`}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                  canApply
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {canApply ? "✓" : "✗"}
              </div>
            </div>
            <div className="flex-1">
              <h3
                className={`text-lg font-semibold ${
                  canApply ? "text-green-800" : "text-red-800"
                }`}
              >
                {canApply
                  ? "You are eligible to apply for a loan"
                  : "You are not eligible to apply at this time"}
              </h3>
              {!canApply && eligibility?.reasons && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-red-700">
                    Please address the following:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {eligibility.reasons.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-red-600"
                      >
                        <span className="text-red-400">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {canApply && (
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-white/50 p-4">
              <div>
                <p className="text-sm text-gray-600">Maximum Borrowable</p>
                <p className="text-xl font-bold text-primary-700">
                  {formatNaira(maxBorrowable)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Consecutive Savings</p>
                <p className="text-xl font-bold text-primary-700">
                  {eligibility?.consecutive_months ?? 0} /{" "}
                  {eligibility?.required_consecutive_months ?? 6}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {success && (
        <div className="mb-4">
          <SuccessAlert message={success} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {/* Form */}
      {canApply && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Loan Application Form
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Fill in the details below
            </p>
          </div>

          <div className="p-6">
            {/* Self-surety panel – dynamic ratio */}
            <div className="mb-6 rounded-lg bg-primary-50 p-4 text-sm">
              <p className="font-semibold text-primary-800">
                Your Self‑surety capacity ({ratioPercent}% of Available Balance)
              </p>
              <p className="text-primary-700">
                Available balance:{" "}
                <strong>{formatNaira(availableBalance)}</strong>
              </p>
              <p className="text-primary-700">
                You can self‑surety up to:{" "}
                <strong>{formatNaira(selfSuretyMax)}</strong>
              </p>
              {amountApplied > 0 && (
                <div className="mt-3">
                  {exceedsMax ? (
                    <p className="font-medium text-red-700">
                      ❌ Requested amount exceeds maximum borrowable (
                      {formatNaira(maxBorrowable)}).
                    </p>
                  ) : needsExternalSureties ? (
                    <p className="font-medium text-amber-700">
                      ⚠️ You need external sureties to cover ₦
                      {(amountApplied - selfSuretyMax).toLocaleString()} (the
                      gap above your self‑surety).
                    </p>
                  ) : (
                    <p className="font-medium text-green-700">
                      ✅ Your self‑surety fully covers this amount – no external
                      sureties required.
                    </p>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Loan Details */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-gray-700">
                  Loan Details
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Amount Requested (₦)
                    </label>
                    <input
                      {...register("amount_applied", {
                        required: "Amount requested is required",
                        min: {
                          value: 1,
                          message: "Amount must be at least ₦1",
                        },
                        max: {
                          value: maxBorrowable,
                          message: `Amount exceeds maximum borrowable (${formatNaira(maxBorrowable)})`,
                        },
                      })}
                      type="number"
                      step="0.01"
                      disabled={!canApply}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.amount_applied
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                      } ${!canApply ? "bg-gray-50 text-gray-500" : ""}`}
                      placeholder={`Max: ${formatNaira(maxBorrowable)}`}
                    />
                    {errors.amount_applied && (
                      <p className="mt-1 text-xs text-red-600">
                        {String(errors.amount_applied.message)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Monthly Salary (₦)
                    </label>
                    <input
                      {...register("monthly_salary", {
                        required: "Monthly salary is required",
                      })}
                      type="number"
                      step="0.01"
                      disabled={!canApply}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.monthly_salary
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                      } ${!canApply ? "bg-gray-50 text-gray-500" : ""}`}
                    />
                    {errors.monthly_salary && (
                      <p className="mt-1 text-xs text-red-600">
                        {String(errors.monthly_salary.message)}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Purpose of Loan
                  </label>
                  <textarea
                    {...register("purpose", {
                      required: "Purpose is required",
                    })}
                    rows={3}
                    disabled={!canApply}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      errors.purpose
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                    } ${!canApply ? "bg-gray-50 text-gray-500" : ""}`}
                    placeholder="Please describe the purpose of this loan..."
                  />
                  {errors.purpose && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.purpose.message)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Home Address
                  </label>
                  <textarea
                    {...register("home_address", {
                      required: "Home address is required",
                    })}
                    rows={2}
                    disabled={!canApply}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      errors.home_address
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                    } ${!canApply ? "bg-gray-50 text-gray-500" : ""}`}
                  />
                  {errors.home_address && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.home_address.message)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Phone Number(s)
                  </label>
                  <input
                    {...register("phone_numbers", {
                      required: "Phone number is required",
                    })}
                    disabled={!canApply}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      errors.phone_numbers
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                    } ${!canApply ? "bg-gray-50 text-gray-500" : ""}`}
                    placeholder="e.g., 08012345678, 08098765432"
                  />
                  {errors.phone_numbers && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.phone_numbers.message)}
                    </p>
                  )}
                </div>
              </div>

              {/* Repayment Plan */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-gray-700">
                  Repayment Plan
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Duration (months, 1–6)
                    </label>
                    <select
                      {...register("proposed_duration_months", {
                        required: true,
                        valueAsNumber: true,
                      })}
                      disabled={!canApply}
                      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        !canApply ? "bg-gray-50 text-gray-500" : ""
                      }`}
                    >
                      <option value="6">6 months</option>
                      <option value="5">5 months</option>
                      <option value="4">4 months</option>
                      <option value="3">3 months</option>
                      <option value="2">2 months</option>
                      <option value="1">1 month</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Monthly Repayment (₦)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        monthlyRepayment > 0 ? monthlyRepayment.toFixed(2) : ""
                      }
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600"
                      disabled
                      aria-label="Calculated monthly repayment amount"
                      title="Calculated monthly repayment"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Calculated automatically
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Repayment Start – Hijri Month
                    </label>
                    <select
                      {...register("repayment_start_hijri_month", {
                        required: true,
                        valueAsNumber: true,
                      })}
                      disabled={!canApply}
                      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        !canApply ? "bg-gray-50 text-gray-500" : ""
                      }`}
                    >
                      {HM.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Repayment Start – Hijri Year
                    </label>
                    <input
                      {...register("repayment_start_hijri_year", {
                        required: true,
                        valueAsNumber: true,
                      })}
                      type="number"
                      min="1440"
                      disabled={!canApply}
                      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        !canApply ? "bg-gray-50 text-gray-500" : ""
                      }`}
                      defaultValue={new Date().getFullYear() + 1}
                    />
                  </div>
                </div>
              </div>

              {/* Sureties Section — only shown when external sureties are required */}
              {needsExternalSureties && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-md font-semibold text-gray-800">
                        Sureties
                      </h3>
                      <p className="text-sm text-gray-500">
                        Add members who will guarantee this loan. They will
                        receive a confirmation request.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        append({ member_id: 0, member_label: "", amount: "" })
                      }
                      disabled={
                        !canApply ||
                        fields.filter((f) => f.member_id > 0).length >=
                          maxSureties
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add Surety
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <SuretyRow
                        key={field.id}
                        index={index}
                        register={register}
                        setValue={setValue}
                        watch={watch}
                        remove={remove}
                        errors={errors}
                      />
                    ))}
                  </div>

                  {fields.length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                      <p className="text-gray-500">No sureties added yet</p>
                      <p className="mt-1 text-sm text-gray-400">
                        Click "Add Surety" to include guarantors for your loan
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="w-full transform rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-primary-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : "Submit Loan Application"}
              </button>
              <p className="text-center text-xs text-gray-500">
                By submitting this application, you confirm that all information
                provided is accurate and complete.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
