import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { loansApi, membersApi, savingsApi, suretiesApi } from "@/api/services";
import {
  PageHeader,
  ErrorAlert,
  Spinner,
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
  repayment_start_hijri_month?: number;
  repayment_start_hijri_year?: number;
  sureties?: SuretyFormItem[];
}

interface SuretyEligibilityResponse {
  eligible: boolean;
  reasons: string[];
}

function SuretyRow({
  index,
  register,
  setValue,
  watch,
  remove,
  errors,
  needsExternalSureties,
  eligibility,
  isCheckingEligibility,
  eligibilityError,
}: {
  index: number;
  register: any;
  setValue: any;
  watch: any;
  remove: (index: number) => void;
  errors: any;
  needsExternalSureties: boolean;
  eligibility?: SuretyEligibilityResponse;
  isCheckingEligibility?: boolean;
  eligibilityError?: unknown;
}) {
  const searchTerm = watch(`sureties.${index}.member_label`) || "";
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const selectedId = watch(`sureties.${index}.member_id`) || 0;
  const amountValue = Number(watch(`sureties.${index}.amount`)) || 0;
  const [showDropdown, setShowDropdown] = useState(false);
  const { data: results } = useQuery<MemberSummary[]>({
    queryKey: ["member-search", index, debouncedSearch],
    queryFn: () =>
      membersApi.summary(debouncedSearch).then((r) => r.data.results),
    enabled: debouncedSearch.length > 2,
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
          {selectedId > 0 && amountValue > 0 && needsExternalSureties && (
            <div className="mt-2 text-sm">
              {eligibility ? (
                eligibility.eligible ? (
                  <p className="text-green-600">
                    This member is eligible to act as a surety for this amount.
                  </p>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    {eligibility.reasons.map((reason, i) => (
                      <p key={i} className="text-xs">
                        {reason}
                      </p>
                    ))}
                  </div>
                )
              ) : isCheckingEligibility ? (
                <p className="text-blue-600">Checking surety eligibility…</p>
              ) : eligibilityError ? (
                <p className="text-red-600">
                  Failed to validate surety eligibility.
                </p>
              ) : (
                <p className="text-gray-500">
                  Enter an amount to validate eligibility.
                </p>
              )}
            </div>
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
  const [error, setError] = useState("");
  const navigate = useNavigate();

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

  // Dynamic limits from backend
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

  // Compute next Hijri month for repayment start
  const currentHijriMonth = eligibility?.current_hijri_month ?? 1;
  const currentHijriYear = eligibility?.current_hijri_year ?? 1446;

  let startMonth = currentHijriMonth + 1;
  let startYear = currentHijriYear;
  if (startMonth > 12) {
    startMonth = 1;
    startYear++;
  }
  const startMonthLabel =
    HM.find((m) => m.value === startMonth)?.label ?? startMonth;
  const repaymentStartLabel = `${startMonthLabel} ${startYear}`;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ApplyLoanFormValues>({
    defaultValues: {
      amount_applied: "",
      purpose: "",
      monthly_salary: "",
      home_address: "",
      phone_numbers: "",
      proposed_monthly_repayment: "",
      proposed_duration_months: 6,
      sureties: [{ member_id: 0, member_label: "", amount: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sureties",
  });

  const amountApplied = Number(watch("amount_applied")) || 0;
  const duration = watch("proposed_duration_months") || 6;
  const monthlyRepayment = duration > 0 ? amountApplied / duration : 0;
  const sureties = watch("sureties") ?? [];

  const needsExternalSureties =
    amountApplied > selfSuretyMax && amountApplied <= maxBorrowable;
  const exceedsMax = amountApplied > maxBorrowable;

  const suretyRows = fields.map((field, index) => ({
    id: field.id,
    member_id: Number(sureties[index]?.member_id) || 0,
    amount: Number(sureties[index]?.amount) || 0,
  }));

  const externalSureties = suretyRows.filter((row) => row.member_id > 0);
  const completeSureties = externalSureties.filter((row) => row.amount > 0);
  const batchEligibilityPayload = completeSureties.map((row) => ({
    row_id: row.id,
    member_id: row.member_id,
    amount: row.amount,
  }));

  const {
    data: batchEligibility,
    isFetching: isCheckingEligibility,
    error: batchEligibilityError,
  } = useQuery({
    queryKey: ["surety-eligibility-batch", batchEligibilityPayload],
    queryFn: () =>
      suretiesApi
        .checkEligibilityBatch(batchEligibilityPayload)
        .then((r) => r.data),
    enabled: needsExternalSureties && batchEligibilityPayload.length > 0,
    staleTime: 1000 * 60,
  });

  const eligibilityByRowId = useMemo(() => {
    const map: Record<string, SuretyEligibilityResponse> = {};
    if (!batchEligibility?.results) return map;

    for (const item of batchEligibility.results) {
      if (typeof item.row_id === "string") {
        map[item.row_id] = {
          eligible: item.eligible,
          reasons: item.reasons,
        };
      }
    }
    return map;
  }, [batchEligibility]);

  const externalTotal = externalSureties.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const suretyGap = Math.max(0, amountApplied - selfSuretyMax);
  const sufficientSuretyGap = externalTotal >= suretyGap;
  const allExternalSuretiesValidated = useMemo(
    () =>
      externalSureties.length === 0 ||
      externalSureties.every(
        (row) =>
          row.amount > 0 && eligibilityByRowId[row.id]?.eligible === true,
      ),
    [externalSureties, eligibilityByRowId],
  );

  const hasInvalidSurety = useMemo(
    () =>
      externalSureties.some(
        (row) =>
          row.amount > 0 && eligibilityByRowId[row.id]?.eligible === false,
      ),
    [externalSureties, eligibilityByRowId],
  );

  const blockReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!canApply)
      reasons.push("You are currently ineligible to apply for a loan.");
    if (exceedsMax)
      reasons.push(
        `Requested amount exceeds maximum borrowable (${formatNaira(maxBorrowable)}).`,
      );
    if (needsExternalSureties && externalSureties.length === 0)
      reasons.push("External sureties are required for this amount.");
    if (needsExternalSureties && !sufficientSuretyGap)
      reasons.push(
        `External sureties total ₦${externalTotal.toLocaleString()} does not cover the gap of ₦${suretyGap.toLocaleString()}.`,
      );
    if (hasInvalidSurety)
      reasons.push(
        "One or more selected sureties do not meet eligibility requirements.",
      );
    if (
      needsExternalSureties &&
      externalSureties.length > 0 &&
      !allExternalSuretiesValidated
    ) {
      reasons.push(
        "Complete and validate all surety selections before submitting.",
      );
    }
    if (batchEligibilityError)
      reasons.push("Unable to validate surety eligibility. Please try again.");
    return reasons;
  }, [
    canApply,
    exceedsMax,
    needsExternalSureties,
    externalSureties.length,
    sufficientSuretyGap,
    externalTotal,
    suretyGap,
    hasInvalidSurety,
    allExternalSuretiesValidated,
    batchEligibilityError,
  ]);

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

  // ---------- DRAFT LOGIC ----------

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch existing draft on mount
  const { data: draftData } = useQuery({
    queryKey: ["loan-draft"],
    queryFn: () => loansApi.getDraft(),
    staleTime: 0,
  });

  // 2. Populate form with draft data (only once after load)
  useEffect(() => {
    if (
      draftData?.data &&
      Object.keys(draftData.data).length > 0 &&
      !draftLoaded
    ) {
      reset(draftData.data as unknown as ApplyLoanFormValues);
    }
    setDraftLoaded(true);
  }, [draftData, reset, draftLoaded]);

  // 3. Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => loansApi.saveDraft(data),
    onSuccess: () => setLastDraftSavedAt(new Date().toLocaleTimeString()),
  });

  const draftStatus = saveDraftMutation.isPending
    ? "Saving draft…"
    : saveDraftMutation.isError
      ? "Draft save failed"
      : lastDraftSavedAt
        ? `Draft saved at ${lastDraftSavedAt}`
        : "";

  // 4. Auto-save on form changes (debounced 2 seconds)
  const formValues = watch();

  useEffect(() => {
    if (!draftLoaded) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const payload: Record<string, unknown> = { ...formValues };
      if (payload.sureties) {
        payload.sureties = (payload.sureties as SuretyFormItem[]).filter(
          (s) => s.member_id > 0,
        );
      }
      saveDraftMutation.mutate(payload);
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [formValues, draftLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- SUBMIT ----------

  const { mutateAsync: applyMutateAsync, isPending: isApplying } = useMutation({
    mutationFn: (data: any) => loansApi.apply(data),
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const onSubmit = async (data: ApplyLoanFormValues) => {
    setError("");
    const payload: Record<string, unknown> = { ...data };
    if (needsExternalSureties) {
      payload.sureties = (data.sureties ?? []).filter((s) => s.member_id > 0);
    } else {
      delete payload.sureties;
    }

    try {
      const response = await applyMutateAsync(payload);
      saveDraftMutation.mutate({ data: {} });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      navigate("/loans/success", {
        replace: true,
        state: {
          amount: data.amount_applied,
          loanId: response.data?.id,
        },
      });
    } catch {
      // error handled by mutation onError
    }
  };

  if (isLoading) return <PageLoader />;

  const sufficientSureties =
    !needsExternalSureties ||
    (needsExternalSureties &&
      externalSureties.length > 0 &&
      sufficientSuretyGap);
  const isSubmitDisabled =
    isApplying ||
    !canApply ||
    exceedsMax ||
    !sufficientSureties ||
    (needsExternalSureties && !allExternalSuretiesValidated);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <PageHeader
        title="Apply for a Loan"
        subtitle="Submit a new loan application for committee review"
        back={{ to: "/my-loans", label: "Back to My Loans" }}
      />

      {draftStatus && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 shadow-sm">
          {draftStatus}
        </div>
      )}

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

      {isApplying && (
        <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4 text-primary-800">
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span>Processing your loan application, please wait…</span>
          </div>
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

                {/* Repayment start – auto‑calculated */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Repayment Start
                  </label>
                  <div className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                    {repaymentStartLabel}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Repayment begins the month after approval (auto‑calculated).
                  </p>
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
                        needsExternalSureties={needsExternalSureties}
                        eligibility={eligibilityByRowId[field.id]}
                        isCheckingEligibility={isCheckingEligibility}
                        eligibilityError={batchEligibilityError}
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

              {blockReasons.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">Submission blocked</p>
                  <ul className="mt-2 list-inside list-disc">
                    {blockReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="w-full transform rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-primary-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Loan Application"
                )}
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
