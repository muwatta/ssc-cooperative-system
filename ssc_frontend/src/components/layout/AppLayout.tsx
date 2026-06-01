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
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: results } = useQuery<MemberSummary[]>({
    queryKey: ["member-search", index, searchTerm],
    queryFn: () => membersApi.summary(searchTerm).then((r) => r.data.results),
    enabled: searchTerm.length > 2,
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
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
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors?.sureties?.[index]?.member_label ? "border-red-300" : "border-gray-300"}`}
            placeholder="Search by file number or name..."
            autoComplete="off"
          />
          <input
            type="hidden"
            {...register(`sureties.${index}.member_id`, {
              valueAsNumber: true,
              validate: (v: any) => v > 0 || "Select a valid member",
            })}
          />
          {results && results.length > 0 && showDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-lg border bg-white shadow-lg">
              {results.slice(0, 6).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-primary-50"
                  onClick={() => {
                    setValue(`sureties.${index}.member_id`, member.id);
                    setValue(
                      `sureties.${index}.member_label`,
                      `${member.file_number} – ${member.full_name}`,
                    );
                    setShowDropdown(false);
                  }}
                >
                  <span className="font-medium">{member.file_number}</span>{" "}
                  <span className="text-sm text-gray-600">
                    {member.full_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {errors?.sureties?.[index]?.member_label && (
          <p className="text-xs text-red-600">
            {errors.sureties[index].member_label.message}
          </p>
        )}
        {errors?.sureties?.[index]?.member_id && selectedId <= 0 && (
          <p className="text-xs text-red-600">
            {errors.sureties[index].member_id.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Amount Guaranteed (₦)
        </label>
        <input
          {...register(`sureties.${index}.amount`, {
            required: "Enter amount",
            valueAsNumber: true,
            min: 0.01,
          })}
          type="number"
          step="0.01"
          className={`w-full rounded-lg border px-3 py-2 text-sm ${errors?.sureties?.[index]?.amount ? "border-red-300" : "border-gray-300"}`}
          placeholder="0.00"
        />
        {errors?.sureties?.[index]?.amount && (
          <p className="text-xs text-red-600">
            {errors.sureties[index].amount.message}
          </p>
        )}
      </div>

      {index > 0 && (
        <button
          type="button"
          onClick={() => remove(index)}
          className="text-red-600 text-sm font-medium"
        >
          Remove
        </button>
      )}
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
      repayment_start_hijri_year: new Date().getFullYear() + 1,
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <PageHeader
        title="Apply for a Loan"
        subtitle="Submit a new loan application"
        back={{ to: "/my-loans", label: "Back to My Loans" }}
      />

      {/* Eligibility Card */}
      <div
        className={`mb-6 rounded-xl border-2 p-5 ${eligibility?.eligible ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${eligibility?.eligible ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}
          >
            {eligibility?.eligible ? "✓" : "✗"}
          </div>
          <div className="flex-1">
            <h3
              className={`font-semibold ${eligibility?.eligible ? "text-green-800" : "text-red-800"}`}
            >
              {eligibility?.eligible
                ? "You are eligible to apply"
                : "Not eligible to apply"}
            </h3>
            {!eligibility?.eligible && eligibility?.reasons && (
              <ul className="mt-2 space-y-1 text-sm text-red-600">
                {eligibility.reasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {eligibility?.eligible && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-white/60 p-3">
            <div>
              <p className="text-sm text-gray-600">Maximum Borrowable</p>
              <p className="text-xl font-bold text-primary-700">
                {formatNaira(eligibility.max_borrowable)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Consecutive Savings</p>
              <p className="text-xl font-bold text-primary-700">
                {eligibility.consecutive_months} /{" "}
                {eligibility.required_consecutive_months}
              </p>
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
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 bg-gradient-to-r from-primary-50 to-white">
            <h2 className="text-xl font-semibold">Loan Application Form</h2>
            <p className="text-sm text-gray-500">Fill in the details below</p>
          </div>
          <div className="p-5">
            <form
              onSubmit={handleSubmit((data) => applyMutation.mutate(data))}
              className="space-y-5"
            >
              {/* Loan Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Loan Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Amount Requested (₦)</label>
                    <input
                      {...register("amount_applied", { required: true })}
                      type="number"
                      className={`input w-full ${errors.amount_applied ? "input-error" : ""}`}
                      placeholder={`Max: ${formatNaira(eligibility.max_borrowable)}`}
                    />
                    {errors.amount_applied && (
                      <p className="field-error">Required</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Monthly Salary (₦)</label>
                    <input
                      {...register("monthly_salary", { required: true })}
                      type="number"
                      className={`input w-full ${errors.monthly_salary ? "input-error" : ""}`}
                    />
                    {errors.monthly_salary && (
                      <p className="field-error">Required</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">Purpose of Loan</label>
                  <textarea
                    {...register("purpose", { required: true })}
                    rows={3}
                    className={`input w-full ${errors.purpose ? "input-error" : ""}`}
                    placeholder="Describe the purpose..."
                  />
                  {errors.purpose && <p className="field-error">Required</p>}
                </div>
                <div>
                  <label className="label">Home Address</label>
                  <textarea
                    {...register("home_address", { required: true })}
                    rows={2}
                    className={`input w-full ${errors.home_address ? "input-error" : ""}`}
                  />
                  {errors.home_address && (
                    <p className="field-error">Required</p>
                  )}
                </div>
                <div>
                  <label className="label">Phone Number(s)</label>
                  <input
                    {...register("phone_numbers", { required: true })}
                    className={`input w-full ${errors.phone_numbers ? "input-error" : ""}`}
                    placeholder="08012345678, 08098765432"
                  />
                  {errors.phone_numbers && (
                    <p className="field-error">Required</p>
                  )}
                </div>
              </div>

              {/* Repayment Plan */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Repayment Plan</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Monthly Repayment (₦)</label>
                    <input
                      {...register("proposed_monthly_repayment", {
                        required: true,
                      })}
                      type="number"
                      className={`input w-full ${errors.proposed_monthly_repayment ? "input-error" : ""}`}
                    />
                    {errors.proposed_monthly_repayment && (
                      <p className="field-error">Required</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Duration (months, max 12)</label>
                    <input
                      {...register("proposed_duration_months", {
                        required: true,
                        min: 1,
                        max: 12,
                        valueAsNumber: true,
                      })}
                      type="number"
                      className={`input w-full ${errors.proposed_duration_months ? "input-error" : ""}`}
                    />
                    {errors.proposed_duration_months && (
                      <p className="field-error">Required</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      Repayment Start – Hijri Month
                    </label>
                    <select
                      {...register("repayment_start_hijri_month", {
                        required: true,
                        valueAsNumber: true,
                      })}
                      className="input w-full"
                    >
                      {HM.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      Repayment Start – Hijri Year
                    </label>
                    <input
                      {...register("repayment_start_hijri_year", {
                        required: true,
                        valueAsNumber: true,
                      })}
                      type="number"
                      min="1440"
                      className="input w-full"
                      defaultValue={new Date().getFullYear() + 1}
                    />
                  </div>
                </div>
              </div>

              {/* Sureties */}
              <div className="space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">Sureties</h3>
                    <p className="text-sm text-gray-500">
                      Members who will guarantee this loan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      append({ member_id: 0, member_label: "", amount: "" })
                    }
                    className="btn-primary text-sm px-3 py-2"
                  >
                    + Add Surety
                  </button>
                </div>
                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <SuretyRow
                      key={field.id}
                      index={idx}
                      register={register}
                      setValue={setValue}
                      watch={watch}
                      remove={remove}
                      errors={errors}
                    />
                  ))}
                </div>
                {fields.length === 0 && (
                  <div className="border-dashed border-2 p-6 text-center text-gray-500 rounded-lg">
                    No sureties added yet
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-3 text-base font-semibold"
              >
                {isSubmitting ? "Submitting..." : "Submit Loan Application"}
              </button>
              <p className="text-center text-xs text-gray-500">
                By submitting, you confirm all information is accurate.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
