import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { membersApi } from "@/api/services";
import type {
  MemberProfile,
  MaritalStatus,
  Gender,
  SchoolBranch,
} from "@/types";

interface ProfileForm {
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
  approved_monthly_contribution: string;
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
}

const SECTIONS = [
  { id: "personal", label: "Personal", icon: "👤" },
  { id: "school", label: "School", icon: "🏫" },
  { id: "financial", label: "Financial", icon: "💰" },
  { id: "addresses", label: "Addresses", icon: "📍" },
  { id: "nextofkin", label: "Next of Kin", icon: "🆘" },
];

function SectionTab({
  section,
  active,
  onClick,
}: {
  section: (typeof SECTIONS)[0];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-primary-600 text-white shadow-sm"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span className="text-base leading-none">{section.icon}</span>
      <span className="hidden sm:inline">{section.label}</span>
    </button>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  required,
  error,
  children,
  full,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function MyProfilePage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("personal");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>();

  const emptyDefaults: ProfileForm = {
    full_name: "",
    phone_primary: "",
    phone_secondary: "",
    marital_status: "single",
    gender: "male",
    date_of_birth: "",
    place_of_birth: "",
    school_branch: "primary",
    designation: "",
    date_joined_school: "",
    monthly_income: "",
    approved_monthly_contribution: "5000",
    residential_address: "",
    permanent_home_address: "",
    email_address: "",
    social_media_handle: "",
    state_of_origin: "",
    local_government_area: "",
    next_of_kin_name: "",
    next_of_kin_address: "",
    next_of_kin_phone: "",
    next_of_kin_relationship: "",
    next_of_kin_place_of_work: "",
  };

  const loadProfile = async () => {
    try {
      const response = await membersApi.me();
      const data = response.data;

      if (!data || !data.id) {
        setProfile(null);
        setProfileMissing(true);
        reset(emptyDefaults);
        return;
      }

      setProfile(data);
      setProfileMissing(false);
      reset({
        full_name: data.full_name,
        phone_primary: data.phone_primary,
        phone_secondary: data.phone_secondary ?? "",
        marital_status: data.marital_status,
        gender: data.gender,
        date_of_birth: data.date_of_birth,
        place_of_birth: data.place_of_birth,
        school_branch: data.school_branch,
        designation: data.designation,
        date_joined_school: data.date_joined_school,
        monthly_income: data.monthly_income,
        approved_monthly_contribution: data.approved_monthly_contribution,
        residential_address: data.residential_address,
        permanent_home_address: data.permanent_home_address,
        email_address: data.email_address ?? "",
        social_media_handle: data.social_media_handle ?? "",
        state_of_origin: data.state_of_origin,
        local_government_area: data.local_government_area,
        next_of_kin_name: data.next_of_kin_name,
        next_of_kin_address: data.next_of_kin_address,
        next_of_kin_phone: data.next_of_kin_phone,
        next_of_kin_relationship: data.next_of_kin_relationship,
        next_of_kin_place_of_work: data.next_of_kin_place_of_work ?? "",
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setProfile(null);
        setProfileMissing(true);
        reset(emptyDefaults);
      } else {
        setServerMessage("Unable to load profile. Please try again.");
        setIsError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onSubmit = async (data: ProfileForm) => {
    setServerMessage(null);
    setIsError(false);
    try {
      let response;
      if (profileMissing) {
        response = await membersApi.createMe(data);
        setProfile(response.data);
        setProfileMissing(false);
        setServerMessage("Profile created successfully.");
        await loadProfile();
      } else {
        response = await membersApi.update(profile!.id, data);
        setProfile(response.data);
        setServerMessage("Profile updated successfully.");
        reset(response.data);
      }
      setIsError(false);
    } catch (err: any) {
      const d = err?.response?.data;
      const msg =
        d?.approved_monthly_contribution?.[0] ||
        d?.detail ||
        (Object.values(d || {}).flat()[0] as string) ||
        (profileMissing
          ? "Failed to create profile. Please check your details."
          : "Failed to update profile. Please check your details.");
      setServerMessage(msg);
      setIsError(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
      hasError
        ? "border-red-400 bg-red-50"
        : "border-gray-200 hover:border-gray-300"
    }`;

  const selectClass =
    "w-full rounded-lg border border-gray-200 hover:border-gray-300 px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors";

  const textareaClass = (hasError?: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
      hasError
        ? "border-red-400 bg-red-50"
        : "border-gray-200 hover:border-gray-300"
    }`;

  return (
    <div className="max-w-3xl mx-auto pb-10">
      {/* Header card */}
      <div className="rounded-2xl bg-primary-700 px-6 py-5 mb-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-200 mb-1">
              My Profile
            </p>
            <h1 className="text-xl font-bold leading-tight">
              {profile?.full_name || "Complete your profile"}
            </h1>
            <p className="text-sm text-primary-200 mt-0.5">
              {profileMissing
                ? "Fill in your details to join the cooperative."
                : "Keep your information up to date."}
            </p>
          </div>

          {/* Status pill */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                profileMissing
                  ? "bg-amber-400/20 text-amber-200"
                  : "bg-green-400/20 text-green-200"
              }`}
            >
              {profileMissing
                ? "Incomplete"
                : (profile?.membership_status ?? "Active")}
            </span>
            {profile?.is_loan_eligible && (
              <span className="rounded-full px-3 py-1 text-xs font-semibold bg-blue-400/20 text-blue-200">
                Loan Eligible
              </span>
            )}
          </div>
        </div>

        {/* Metric strip */}
        {!profileMissing && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Staff ID", value: profile?.staff_id ?? "—" },
              { label: "File No.", value: profile?.file_number ?? "—" },
              { label: "Branch", value: profile?.school_branch ?? "—" },
              {
                label: "Contribution",
                value: `₦${Number(profile?.approved_monthly_contribution || 0).toLocaleString()}`,
              },
            ].map((m) => (
              <div key={m.label} className="bg-white/10 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-medium text-primary-200 uppercase tracking-wider">
                  {m.label}
                </p>
                <p className="mt-1 text-sm font-bold capitalize">{m.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {serverMessage && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            isError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          <span>{isError ? "⚠️" : "✅"}</span>
          {serverMessage}
        </div>
      )}

      {/* Main form card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Section tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 pt-4 pb-3 border-b border-gray-100 scrollbar-hide">
          {SECTIONS.map((s) => (
            <SectionTab
              key={s.id}
              section={s}
              active={activeSection === s.id}
              onClick={() => setActiveSection(s.id)}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-5 sm:p-6">
            {/* Personal */}
            {activeSection === "personal" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 mb-4">
                  Your identity and contact details as registered with SSC.
                </p>
                <FieldGroup>
                  <Field
                    label="Full Name"
                    required
                    error={errors.full_name?.message}
                  >
                    <input
                      {...register("full_name", { required: "Required" })}
                      className={inputClass(!!errors.full_name)}
                      placeholder="As on your ID"
                    />
                  </Field>
                  <Field
                    label="Primary Phone"
                    required
                    error={errors.phone_primary?.message}
                  >
                    <input
                      {...register("phone_primary", { required: "Required" })}
                      className={inputClass(!!errors.phone_primary)}
                      placeholder="08012345678"
                    />
                  </Field>
                  <Field label="Secondary Phone">
                    <input
                      {...register("phone_secondary")}
                      className={inputClass()}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Email Address">
                    <input
                      {...register("email_address")}
                      type="email"
                      className={inputClass()}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <Field label="Gender">
                    <select {...register("gender")} className={selectClass}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </Field>
                  <Field label="Marital Status">
                    <select
                      {...register("marital_status")}
                      className={selectClass}
                    >
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </Field>
                  <Field
                    label="Date of Birth"
                    required
                    error={errors.date_of_birth?.message}
                  >
                    <input
                      {...register("date_of_birth", { required: "Required" })}
                      type="date"
                      className={inputClass(!!errors.date_of_birth)}
                    />
                  </Field>
                  <Field
                    label="Place of Birth"
                    required
                    error={errors.place_of_birth?.message}
                  >
                    <input
                      {...register("place_of_birth", { required: "Required" })}
                      className={inputClass(!!errors.place_of_birth)}
                    />
                  </Field>
                  <Field
                    label="State of Origin"
                    required
                    error={errors.state_of_origin?.message}
                  >
                    <input
                      {...register("state_of_origin", { required: "Required" })}
                      className={inputClass(!!errors.state_of_origin)}
                    />
                  </Field>
                  <Field
                    label="Local Government Area"
                    required
                    error={errors.local_government_area?.message}
                  >
                    <input
                      {...register("local_government_area", {
                        required: "Required",
                      })}
                      className={inputClass(!!errors.local_government_area)}
                    />
                  </Field>
                  <Field label="Social Media Handle">
                    <input
                      {...register("social_media_handle")}
                      className={inputClass()}
                      placeholder="@handle"
                    />
                  </Field>
                </FieldGroup>
              </div>
            )}

            {/* School */}
            {activeSection === "school" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 mb-4">
                  Your employment details at the school.
                </p>
                <FieldGroup>
                  <Field label="School Branch">
                    <select
                      {...register("school_branch")}
                      className={selectClass}
                    >
                      <option value="primary">Primary</option>
                      <option value="college">College</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Designation">
                    <input
                      {...register("designation")}
                      className={inputClass()}
                      placeholder="e.g. Teacher, Clerk"
                    />
                  </Field>
                  <Field label="Date Joined School">
                    <input
                      {...register("date_joined_school")}
                      type="date"
                      className={inputClass()}
                    />
                  </Field>
                  <Field
                    label="Monthly Income"
                    required
                    error={errors.monthly_income?.message}
                  >
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                        ₦
                      </span>
                      <input
                        {...register("monthly_income", {
                          required: "Required",
                        })}
                        type="number"
                        step="0.01"
                        className={`${inputClass(!!errors.monthly_income)} pl-7`}
                        placeholder="0.00"
                      />
                    </div>
                  </Field>
                </FieldGroup>
              </div>
            )}

            {/* Financial */}
            {activeSection === "financial" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 mb-4">
                  Your monthly savings contribution as approved by the
                  committee.
                </p>
                <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 mb-4">
                  <p className="text-xs font-semibold text-primary-700 mb-1">
                    About your contribution
                  </p>
                  <p className="text-xs text-primary-600">
                    Your approved monthly contribution determines your loan
                    eligibility and borrowing capacity. To change it, submit a
                    change request from the Savings page.
                  </p>
                </div>
                <Field
                  label="Approved Monthly Contribution (₦)"
                  required
                  error={errors.approved_monthly_contribution?.message}
                >
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                      ₦
                    </span>
                    <input
                      {...register("approved_monthly_contribution", {
                        required: "Required",
                        min: { value: 1000, message: "Minimum ₦1,000" },
                      })}
                      type="number"
                      step="1000"
                      min="1000"
                      className={`${inputClass(!!errors.approved_monthly_contribution)} pl-7`}
                      placeholder="1000"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Minimum ₦1,000 per month.
                  </p>
                </Field>
              </div>
            )}

            {/* Addresses */}
            {activeSection === "addresses" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 mb-4">
                  Where you currently live and your permanent home address.
                </p>
                <FieldGroup>
                  <Field
                    label="Residential Address"
                    required
                    error={errors.residential_address?.message}
                  >
                    <textarea
                      {...register("residential_address", {
                        required: "Required",
                      })}
                      rows={3}
                      className={textareaClass(!!errors.residential_address)}
                      placeholder="Your current address"
                    />
                  </Field>
                  <Field
                    label="Permanent Home Address"
                    required
                    error={errors.permanent_home_address?.message}
                  >
                    <textarea
                      {...register("permanent_home_address", {
                        required: "Required",
                      })}
                      rows={3}
                      className={textareaClass(!!errors.permanent_home_address)}
                      placeholder="Your hometown address"
                    />
                  </Field>
                </FieldGroup>
              </div>
            )}

            {/* Next of Kin */}
            {activeSection === "nextofkin" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 mb-4">
                  Emergency contact — who should be reached if needed.
                </p>
                <FieldGroup>
                  <Field
                    label="Full Name"
                    required
                    error={errors.next_of_kin_name?.message}
                  >
                    <input
                      {...register("next_of_kin_name", {
                        required: "Required",
                      })}
                      className={inputClass(!!errors.next_of_kin_name)}
                    />
                  </Field>
                  <Field
                    label="Relationship"
                    required
                    error={errors.next_of_kin_relationship?.message}
                  >
                    <input
                      {...register("next_of_kin_relationship", {
                        required: "Required",
                      })}
                      className={inputClass(!!errors.next_of_kin_relationship)}
                      placeholder="e.g. Spouse, Sibling"
                    />
                  </Field>
                  <Field
                    label="Phone"
                    required
                    error={errors.next_of_kin_phone?.message}
                  >
                    <input
                      {...register("next_of_kin_phone", {
                        required: "Required",
                      })}
                      className={inputClass(!!errors.next_of_kin_phone)}
                      placeholder="08012345678"
                    />
                  </Field>
                  <Field label="Place of Work">
                    <input
                      {...register("next_of_kin_place_of_work")}
                      className={inputClass()}
                    />
                  </Field>
                  <Field
                    label="Address"
                    required
                    full
                    error={errors.next_of_kin_address?.message}
                  >
                    <textarea
                      {...register("next_of_kin_address", {
                        required: "Required",
                      })}
                      rows={3}
                      className={textareaClass(!!errors.next_of_kin_address)}
                    />
                  </Field>
                </FieldGroup>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Section nav */}
            <div className="flex gap-2 order-2 sm:order-1">
              {SECTIONS.map((s, i) => {
                const idx = SECTIONS.findIndex((x) => x.id === activeSection);
                if (i === idx - 1)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSection(s.id)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      ← {s.label}
                    </button>
                  );
                if (i === idx + 1)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSection(s.id)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {s.label} →
                    </button>
                  );
                return null;
              })}
            </div>

            {/* Save button */}
            <button
              type="submit"
              disabled={isSubmitting || (!profileMissing && !isDirty)}
              className="order-1 sm:order-2 w-full sm:w-auto px-8 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting
                ? profileMissing
                  ? "Creating…"
                  : "Saving…"
                : profileMissing
                  ? "Create Profile"
                  : isDirty
                    ? "Save Changes"
                    : "No Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
