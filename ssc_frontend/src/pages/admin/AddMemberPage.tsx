import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { membersApi } from "@/api/services";
import { PageHeader } from "@/components/common";
import Skeleton from "@/components/common/Skeleton";
import type { Gender, MaritalStatus, SchoolBranch } from "@/types";

interface FormData {
  staff_id: string;
  role: "staff" | "committee" | "head_of_school" | "admin";
  full_name: string;
  phone_primary: string;
  phone_secondary: string;
  marital_status: MaritalStatus;
  gender: Gender;
  date_of_birth: string;
  place_of_birth: string;
  school_branch: SchoolBranch;
  designation: string;
  date_joined_school: string;
  monthly_income: string;
  proposed_monthly_contribution: string;
  residential_address: string;
  permanent_home_address: string;
  email_address: string;
  social_media_handle: string;
  state_of_origin: string;
  local_government_area: string;
  next_of_kin_name: string;
  next_of_kin_address: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
  next_of_kin_place_of_work: string;
  is_legacy: boolean;
  legacy_file_number: string;
}

const STEPS = [
  { label: "Personal", icon: "👤" },
  { label: "School", icon: "🏫" },
  { label: "Financial", icon: "₦" },
  { label: "Next of Kin", icon: "👨‍👩‍👧" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={[
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  done ? "bg-primary-600 text-white" : "",
                  active && !done
                    ? "bg-primary-600 text-white ring-4 ring-primary-100"
                    : "",
                  !done && !active ? "bg-gray-100 text-gray-400" : "",
                ].join(" ")}
              >
                {done ? "✓" : step.icon}
              </div>
              <span
                className={`text-xs mt-1 font-medium ${active ? "text-primary-700" : "text-gray-400"}`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-4 ${done ? "bg-primary-600" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

// Fields validated before advancing each step
const STEP_FIELDS: (keyof FormData)[][] = [
  [
    "staff_id",
    "full_name",
    "phone_primary",
    "gender",
    "marital_status",
    "date_of_birth",
    "place_of_birth",
    "state_of_origin",
    "local_government_area",
  ],
  ["school_branch", "designation", "date_joined_school"],
  [
    "monthly_income",
    "proposed_monthly_contribution",
    "residential_address",
    "permanent_home_address",
  ],
  [
    "next_of_kin_name",
    "next_of_kin_address",
    "next_of_kin_phone",
    "next_of_kin_relationship",
  ],
];

export default function AddMemberPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      role: "staff",
      marital_status: "single",
      gender: "male",
      school_branch: "primary",
      is_legacy: false,
      legacy_file_number: "",
      phone_secondary: "",
      email_address: "",
      social_media_handle: "",
      next_of_kin_place_of_work: "",
    },
  });

  const isLegacy = watch("is_legacy");

  const handleNext = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setServerError("");
    try {
      const start = Date.now();
      await membersApi.create({
        ...data,
        is_legacy: data.is_legacy,
        legacy_file_number: data.is_legacy ? data.legacy_file_number : "",
      });
      const elapsed = Date.now() - start;
      if (elapsed < 2000) {
        await new Promise((res) => setTimeout(res, 2000 - elapsed));
      }
      navigate("/members", {
        state: { success: `Member ${data.full_name} added successfully.` },
      });
    } catch (err: any) {
      const d = err?.response?.data;
      if (d?.staff_id) {
        setServerError(d.staff_id[0]);
        setStep(0);
      } else if (d?.detail) setServerError(d.detail);
      else
        setServerError(
          "Failed to create member. Check all fields and try again.",
        );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setPageLoading(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Add Member"
        subtitle="Complete all sections to register a new SSC member."
        back={{ to: "/members", label: "Back to Members" }}
      />

      {pageLoading ? (
        <div className="space-y-6 mt-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <Skeleton rows={3} />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <Skeleton rows={5} />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <Skeleton rows={3} />
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <StepIndicator current={step} />

            {serverError && (
              <div className="mb-6 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                ⚠️ {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* ── Step 1: Personal ── */}
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="mb-2 font-semibold text-gray-800">
                    Personal Information
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Staff ID *" error={errors.staff_id?.message}>
                      <input
                        {...register("staff_id", {
                          required: "Staff ID is required",
                          pattern: {
                            value: /^S\d{2}-\d{4}$/,
                            message: "Format: S{YY}-{NNNN} e.g. S43-0094",
                          },
                        })}
                        className={`input uppercase ${errors.staff_id ? "input-error" : ""}`}
                        placeholder="S43-0094"
                      />
                    </Field>
                    <Field label="Role *">
                      <select {...register("role")} className="input">
                        <option value="staff">Staff</option>
                        <option value="committee">Committee</option>
                        <option value="head_of_school">Head of School</option>
                        <option value="admin">Admin</option>
                      </select>
                    </Field>
                  </div>

                  <Field label="Full Name *" error={errors.full_name?.message}>
                    <input
                      {...register("full_name", {
                        required: "Full name is required",
                      })}
                      className={`input ${errors.full_name ? "input-error" : ""}`}
                      placeholder="As it appears on official documents"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Primary Phone *"
                      error={errors.phone_primary?.message}
                    >
                      <input
                        {...register("phone_primary", {
                          required: "Primary phone is required",
                        })}
                        className={`input ${errors.phone_primary ? "input-error" : ""}`}
                        placeholder="08012345678"
                      />
                    </Field>
                    <Field label="Secondary Phone">
                      <input
                        {...register("phone_secondary")}
                        className="input"
                        placeholder="Optional"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Gender *" error={errors.gender?.message}>
                      <select
                        {...register("gender", { required: "Required" })}
                        className={`input ${errors.gender ? "input-error" : ""}`}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </Field>
                    <Field
                      label="Marital Status *"
                      error={errors.marital_status?.message}
                    >
                      <select
                        {...register("marital_status", {
                          required: "Required",
                        })}
                        className={`input ${errors.marital_status ? "input-error" : ""}`}
                      >
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Date of Birth *"
                      error={errors.date_of_birth?.message}
                    >
                      <input
                        {...register("date_of_birth", { required: "Required" })}
                        type="date"
                        className={`input ${errors.date_of_birth ? "input-error" : ""}`}
                      />
                    </Field>
                    <Field
                      label="Place of Birth *"
                      error={errors.place_of_birth?.message}
                    >
                      <input
                        {...register("place_of_birth", {
                          required: "Required",
                        })}
                        className={`input ${errors.place_of_birth ? "input-error" : ""}`}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="State of Origin *"
                      error={errors.state_of_origin?.message}
                    >
                      <input
                        {...register("state_of_origin", {
                          required: "Required",
                        })}
                        className={`input ${errors.state_of_origin ? "input-error" : ""}`}
                      />
                    </Field>
                    <Field
                      label="Local Government Area *"
                      error={errors.local_government_area?.message}
                    >
                      <input
                        {...register("local_government_area", {
                          required: "Required",
                        })}
                        className={`input ${errors.local_government_area ? "input-error" : ""}`}
                      />
                    </Field>
                  </div>

                  {/* Legacy import */}
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        {...register("is_legacy")}
                        type="checkbox"
                        className="h-4 w-4 accent-primary-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Legacy member import
                        </p>
                        <p className="text-xs text-gray-400">
                          Member has an existing SSC file number from physical
                          records.
                        </p>
                      </div>
                    </label>
                    {isLegacy && (
                      <div className="mt-3">
                        <Field
                          label="Existing File Number *"
                          error={errors.legacy_file_number?.message}
                        >
                          <input
                            {...register("legacy_file_number", {
                              validate: (v) =>
                                !isLegacy ||
                                !!v ||
                                "File number required for legacy import",
                            })}
                            className={`input font-mono ${errors.legacy_file_number ? "input-error" : ""}`}
                            placeholder="A048"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 2: School ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="mb-2 font-semibold text-gray-800">
                    School Details
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="School Branch *"
                      error={errors.school_branch?.message}
                    >
                      <select
                        {...register("school_branch", { required: "Required" })}
                        className={`input ${errors.school_branch ? "input-error" : ""}`}
                      >
                        <option value="primary">Primary</option>
                        <option value="college">College</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                    <Field
                      label="Date Joined School *"
                      error={errors.date_joined_school?.message}
                    >
                      <input
                        {...register("date_joined_school", {
                          required: "Required",
                        })}
                        type="date"
                        className={`input ${errors.date_joined_school ? "input-error" : ""}`}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Designation / Job Title *"
                    error={errors.designation?.message}
                  >
                    <input
                      {...register("designation", {
                        required: "Designation is required",
                      })}
                      className={`input ${errors.designation ? "input-error" : ""}`}
                      placeholder="e.g. Senior Teacher, Accountant"
                    />
                  </Field>

                  <div className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">
                    <p className="mb-1 font-medium">🕌 Note on membership</p>
                    <p>
                      Member status will be <strong>Pending</strong> after
                      submission. Admin must approve with Chairman signature
                      before the member can save or borrow.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 3: Financial & Contact ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="mb-2 font-semibold text-gray-800">
                    Financial & Contact
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Monthly Income (₦) *"
                      error={errors.monthly_income?.message}
                    >
                      <input
                        {...register("monthly_income", {
                          required: "Required",
                          validate: (v) =>
                            parseFloat(v) > 0 || "Must be greater than 0",
                        })}
                        type="number"
                        step="0.01"
                        min="0"
                        className={`input ${errors.monthly_income ? "input-error" : ""}`}
                        placeholder="0.00"
                      />
                    </Field>
                    <Field
                      label="Proposed Monthly Contribution (₦) *"
                      error={errors.proposed_monthly_contribution?.message}
                    >
                      <input
                        {...register("proposed_monthly_contribution", {
                          required: "Required",
                          validate: (v) =>
                            parseFloat(v) >= 1000 ||
                            "Minimum ₦1,000 (SRS Rule S1)",
                        })}
                        type="number"
                        step="0.01"
                        min="1000"
                        className={`input ${errors.proposed_monthly_contribution ? "input-error" : ""}`}
                        placeholder="1000.00"
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Minimum ₦1,000. Requires a formal change form to modify
                        later.
                      </p>
                    </Field>
                  </div>

                  <Field
                    label="Residential Address *"
                    error={errors.residential_address?.message}
                  >
                    <textarea
                      {...register("residential_address", {
                        required: "Required",
                      })}
                      className={`input h-20 resize-none ${errors.residential_address ? "input-error" : ""}`}
                      placeholder="Current residential address"
                    />
                  </Field>

                  <Field
                    label="Permanent Home Address *"
                    error={errors.permanent_home_address?.message}
                  >
                    <textarea
                      {...register("permanent_home_address", {
                        required: "Required",
                      })}
                      className={`input h-20 resize-none ${errors.permanent_home_address ? "input-error" : ""}`}
                      placeholder="Permanent / hometown address"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Email Address">
                      <input
                        {...register("email_address")}
                        type="email"
                        className="input"
                        placeholder="optional@email.com"
                      />
                    </Field>
                    <Field label="Social Media Handle">
                      <input
                        {...register("social_media_handle")}
                        className="input"
                        placeholder="@username (optional)"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* ── Step 4: Next of Kin ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="mb-2 font-semibold text-gray-800">
                    Next of Kin
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Full Name *"
                      error={errors.next_of_kin_name?.message}
                    >
                      <input
                        {...register("next_of_kin_name", {
                          required: "Required",
                        })}
                        className={`input ${errors.next_of_kin_name ? "input-error" : ""}`}
                      />
                    </Field>
                    <Field
                      label="Relationship *"
                      error={errors.next_of_kin_relationship?.message}
                    >
                      <input
                        {...register("next_of_kin_relationship", {
                          required: "Required",
                        })}
                        className={`input ${errors.next_of_kin_relationship ? "input-error" : ""}`}
                        placeholder="e.g. Spouse, Parent, Sibling"
                      />
                    </Field>
                  </div>

                  <Field
                    label="Phone Number *"
                    error={errors.next_of_kin_phone?.message}
                  >
                    <input
                      {...register("next_of_kin_phone", {
                        required: "Required",
                      })}
                      className={`input ${errors.next_of_kin_phone ? "input-error" : ""}`}
                      placeholder="08012345678"
                    />
                  </Field>

                  <Field
                    label="Address *"
                    error={errors.next_of_kin_address?.message}
                  >
                    <textarea
                      {...register("next_of_kin_address", {
                        required: "Required",
                      })}
                      className={`input h-20 resize-none ${errors.next_of_kin_address ? "input-error" : ""}`}
                    />
                  </Field>

                  <Field label="Place of Work">
                    <input
                      {...register("next_of_kin_place_of_work")}
                      className="input"
                      placeholder="Optional"
                    />
                  </Field>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                    <p className="mb-1 font-medium text-gray-700">
                      Ready to submit
                    </p>
                    <p className="text-gray-500">
                      Member will be created with <strong>Pending</strong>{" "}
                      status. Admin must approve to activate the account.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Navigation ── */}
              <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={step === 0}
                  className="btn-secondary disabled:opacity-0"
                >
                  ← Back
                </button>
                <span className="text-xs text-gray-400">
                  Step {step + 1} of {STEPS.length}
                </span>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="btn-primary"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary min-w-32"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      "Create Member"
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
