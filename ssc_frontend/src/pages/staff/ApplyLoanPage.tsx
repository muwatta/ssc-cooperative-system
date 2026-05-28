import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { loansApi, membersApi } from "@/api/services";
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
  sureties: SuretyFormItem[];
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

  const { data: results } = useQuery<MemberSummary[]>({
    queryKey: ["member-search", index, searchTerm],
    queryFn: () => membersApi.summary(searchTerm).then((r) => r.data.results),
    enabled: searchTerm.length > 2,
  });

  return (
    <div className="grid gap-3 md:grid-cols-12 items-end">
      <div className="md:col-span-6">
        <label className="label">Surety Member</label>
        <input
          {...register(`sureties.${index}.member_label`, {
            required: "Search and select a member",
            onChange: () => setValue(`sureties.${index}.member_id`, 0),
          })}
          className={`input ${errors?.sureties?.[index]?.member_label ? "input-error" : ""}`}
          placeholder="Search by file number or name"
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
        {errors?.sureties?.[index]?.member_label && (
          <p className="field-error">
            {String(errors.sureties[index].member_label.message)}
          </p>
        )}
        {errors?.sureties?.[index]?.member_id && selectedId <= 0 && (
          <p className="field-error">
            {String(errors.sureties[index].member_id.message)}
          </p>
        )}
        {results?.length ? (
          <div className="mt-2 rounded border bg-white shadow-sm">
            {results.slice(0, 6).map((member) => (
              <button
                key={member.id}
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-slate-100"
                onClick={() => {
                  setValue(`sureties.${index}.member_id`, member.id);
                  setValue(
                    `sureties.${index}.member_label`,
                    `${member.file_number} – ${member.full_name}`,
                  );
                }}
              >
                <span className="font-medium">{member.file_number}</span>
                <span className="ml-2 text-sm text-gray-600">
                  {member.full_name}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="md:col-span-4">
        <label className="label">Amount Guaranteed (₦)</label>
        <input
          {...register(`sureties.${index}.amount`, {
            required: "Enter a guarantee amount",
            valueAsNumber: true,
            min: 0.01,
          })}
          type="number"
          step="0.01"
          className={`input ${errors?.sureties?.[index]?.amount ? "input-error" : ""}`}
        />
        {errors?.sureties?.[index]?.amount && (
          <p className="field-error">
            {String(errors.sureties[index].amount.message)}
          </p>
        )}
      </div>

      <div className="md:col-span-2 flex items-center gap-2">
        {index > 0 && (
          <button
            type="button"
            onClick={() => remove(index)}
            className="btn-secondary w-full"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default function ApplyLoanPage() {
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["loan-eligibility"],
    queryFn: () => loansApi.eligibility().then((r) => r.data),
  });

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
      repayment_start_hijri_year: 1446,
      sureties: [{ member_id: 0, member_label: "", amount: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sureties",
  });

  const applyMutation = useMutation({
    mutationFn: (data: any) => loansApi.apply(data),
    onSuccess: () => {
      setSuccess(
        "Loan application submitted successfully. Awaiting committee review.",
      );
      setError("");
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
      else setError("Failed to submit application.");
      setSuccess("");
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Apply for a Loan"
        subtitle="Submit a new loan application"
        back={{ to: "/my-loans", label: "Back to My Loans" }}
      />

      {/* Eligibility status */}
      <div
        className={`card p-5 mb-6 border ${eligibility?.eligible ? "border-green-200 bg-success-50" : "border-red-200 bg-danger-50"}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {eligibility?.eligible ? "✅" : "❌"}
          </span>
          <div>
            <p className="font-semibold text-sm">
              {eligibility?.eligible
                ? "You are eligible to apply"
                : "Not eligible to apply"}
            </p>
            {!eligibility?.eligible && (
              <ul className="text-xs text-danger-700 mt-1 space-y-0.5">
                {eligibility?.reasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {eligibility?.eligible && (
          <div className="mt-3 pt-3 border-t border-green-200 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Max Borrowable: </span>
              <span className="font-bold text-primary-700">
                {formatNaira(eligibility.max_borrowable)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Consecutive Months: </span>
              <span className="font-bold">
                {eligibility.consecutive_months}
              </span>
            </div>
          </div>
        )}
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

      {eligibility?.eligible && !success && (
        <div className="card">
          <div className="card-body">
            <form
              onSubmit={handleSubmit((data) => applyMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount Requested (₦)</label>
                  <input
                    {...register("amount_applied", { required: "Required" })}
                    type="number"
                    step="0.01"
                    className={`input ${errors.amount_applied ? "input-error" : ""}`}
                    placeholder={`Max: ${formatNaira(eligibility.max_borrowable)}`}
                  />
                  {errors.amount_applied && (
                    <p className="field-error">
                      {String(errors.amount_applied.message)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Monthly Salary (₦)</label>
                  <input
                    {...register("monthly_salary", { required: "Required" })}
                    type="number"
                    step="0.01"
                    className={`input ${errors.monthly_salary ? "input-error" : ""}`}
                  />
                  {errors.monthly_salary && (
                    <p className="field-error">
                      {String(errors.monthly_salary.message)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Purpose</label>
                <textarea
                  {...register("purpose", { required: "Required" })}
                  className={`input h-20 ${errors.purpose ? "input-error" : ""}`}
                  placeholder="State the purpose of this loan"
                />
                {errors.purpose && (
                  <p className="field-error">
                    {String(errors.purpose.message)}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Home Address</label>
                <textarea
                  {...register("home_address", { required: "Required" })}
                  className={`input h-16 ${errors.home_address ? "input-error" : ""}`}
                />
                {errors.home_address && (
                  <p className="field-error">
                    {String(errors.home_address.message)}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Phone Number(s)</label>
                <input
                  {...register("phone_numbers", { required: "Required" })}
                  className={`input ${errors.phone_numbers ? "input-error" : ""}`}
                />
                {errors.phone_numbers && (
                  <p className="field-error">
                    {String(errors.phone_numbers.message)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Proposed Monthly Repayment (₦)
                  </label>
                  <input
                    {...register("proposed_monthly_repayment", {
                      required: "Required",
                    })}
                    type="number"
                    step="0.01"
                    className={`input ${errors.proposed_monthly_repayment ? "input-error" : ""}`}
                  />
                  {errors.proposed_monthly_repayment && (
                    <p className="field-error">
                      {String(errors.proposed_monthly_repayment.message)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Duration (months, max 6)</label>
                  <input
                    {...register("proposed_duration_months", {
                      required: "Required",
                      min: 1,
                      max: 6,
                      valueAsNumber: true,
                    })}
                    type="number"
                    min="1"
                    max="6"
                    className={`input ${errors.proposed_duration_months ? "input-error" : ""}`}
                  />
                  {errors.proposed_duration_months && (
                    <p className="field-error">
                      {String(errors.proposed_duration_months.message)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Repayment Start — Islamic Month
                  </label>
                  <select
                    {...register("repayment_start_hijri_month", {
                      required: true,
                      valueAsNumber: true,
                    })}
                    className="input"
                  >
                    {HM.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Repayment Start — Hijri Year</label>
                  <input
                    {...register("repayment_start_hijri_year", {
                      required: true,
                      valueAsNumber: true,
                    })}
                    type="number"
                    min="1440"
                    className="input"
                    defaultValue={1446}
                  />
                </div>
              </div>

              <div className="card border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Surety Selection</p>
                    <p className="text-sm text-gray-600">
                      Add one or more sureties to your application. Each
                      selected member will receive a dashboard request to
                      confirm or decline.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      append({ member_id: 0, member_label: "", amount: "" })
                    }
                  >
                    Add Surety
                  </button>
                </div>
                <div className="space-y-4">
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
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full"
              >
                {isSubmitting ? "Submitting..." : "Submit Loan Application"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
