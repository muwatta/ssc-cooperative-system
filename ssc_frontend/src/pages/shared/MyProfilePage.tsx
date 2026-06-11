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

export default function MyProfilePage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>();

  const loadProfile = async () => {
    try {
      const response = await membersApi.me();
      const data = response.data;

      if (!data || !data.id) {
        setProfile(null);
        setProfileMissing(true);
        reset({
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
        });
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
        reset({
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
        });
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

  return (
    <div className="space-y-6">
      {/* Page Header using design system */}
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">
          {profileMissing
            ? "Complete your member profile to get started."
            : "Manage your personal and cooperative information."}
        </p>
      </div>

      {/* Colorful Header Card (now uses card-panel with gradient) */}
      <div className="card-panel bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-950 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
            <p className="mt-1 text-primary-100 dark:text-primary-300 text-sm">
              {profileMissing
                ? "Complete your member profile to get started."
                : "Manage your personal and cooperative information."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
              {profileMissing ? "Incomplete" : "Active"}
            </span>
            {profile?.is_new_member && (
              <span className="bg-green-400/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
                New Member
              </span>
            )}
          </div>
        </div>
        {/* Quick metrics */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-primary-200 dark:text-primary-300">
              Staff ID
            </p>
            <p className="font-mono font-semibold mt-1">
              {profile?.staff_id ?? "—"}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-primary-200 dark:text-primary-300">
              File No.
            </p>
            <p className="font-mono font-semibold mt-1">
              {profile?.file_number ?? "—"}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-primary-200 dark:text-primary-300">
              Branch
            </p>
            <p className="capitalize font-semibold mt-1">
              {profile?.school_branch ?? "—"}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-primary-200 dark:text-primary-300">
              Contribution
            </p>
            <p className="font-semibold mt-1">
              ₦{profile?.approved_monthly_contribution || "0"}
            </p>
          </div>
        </div>
      </div>

      {/* Alert message */}
      {serverMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            isError
              ? "border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300"
              : "border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300"
          }`}
        >
          {serverMessage}
        </div>
      )}

      {/* Identity & Status Cards (now using card-panel-light) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <div className="card-panel-light border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-800 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              Profile Status
            </span>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800" />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {profileMissing ? "Incomplete" : "Complete"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Membership: {profile?.membership_status || "Pending"}
          </p>
        </div>

        <div className="card-panel-light border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-800 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              Loan Eligibility
            </span>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-800" />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {profile?.is_loan_eligible ? "Eligible" : "Not Eligible"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Consecutive months: {profile?.consecutive_savings_months ?? 0}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Information */}
        <section className="card-panel-light border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-800 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-purple-700 dark:text-purple-300">
              Personal Information
            </h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Full Name *</label>
              <input
                {...register("full_name", { required: "Required" })}
                className={`input ${errors.full_name ? "input-error" : ""}`}
              />
              {errors.full_name && (
                <p className="field-error">{errors.full_name.message}</p>
              )}
            </div>
            <div>
              <label className="label">Primary Phone *</label>
              <input
                {...register("phone_primary", { required: "Required" })}
                className={`input ${errors.phone_primary ? "input-error" : ""}`}
              />
              {errors.phone_primary && (
                <p className="field-error">{errors.phone_primary.message}</p>
              )}
            </div>
            <div>
              <label className="label">Secondary Phone</label>
              <input {...register("phone_secondary")} className="input" />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input
                {...register("email_address")}
                type="email"
                className="input"
              />
            </div>
            <div>
              <label className="label">Gender</label>
              <select {...register("gender")} className="input">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="label">Marital Status</label>
              <select {...register("marital_status")} className="input">
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Birth *</label>
              <input
                {...register("date_of_birth", { required: "Required" })}
                type="date"
                className={`input ${errors.date_of_birth ? "input-error" : ""}`}
              />
              {errors.date_of_birth && (
                <p className="field-error">{errors.date_of_birth.message}</p>
              )}
            </div>
            <div>
              <label className="label">Place of Birth *</label>
              <input
                {...register("place_of_birth", { required: "Required" })}
                className={`input ${errors.place_of_birth ? "input-error" : ""}`}
              />
              {errors.place_of_birth && (
                <p className="field-error">{errors.place_of_birth.message}</p>
              )}
            </div>
            <div>
              <label className="label">State of Origin *</label>
              <input
                {...register("state_of_origin", { required: "Required" })}
                className={`input ${errors.state_of_origin ? "input-error" : ""}`}
              />
              {errors.state_of_origin && (
                <p className="field-error">{errors.state_of_origin.message}</p>
              )}
            </div>
            <div>
              <label className="label">Local Government Area *</label>
              <input
                {...register("local_government_area", { required: "Required" })}
                className={`input ${errors.local_government_area ? "input-error" : ""}`}
              />
              {errors.local_government_area && (
                <p className="field-error">
                  {errors.local_government_area.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* School Details */}
        <section className="card-panel-light border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-800 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏫</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300">
              School Details
            </h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-2">
            <div>
              <label className="label">School Branch</label>
              <select {...register("school_branch")} className="input">
                <option value="primary">Primary</option>
                <option value="college">College</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Designation</label>
              <input {...register("designation")} className="input" />
            </div>
            <div>
              <label className="label">Date Joined School</label>
              <input
                {...register("date_joined_school")}
                type="date"
                className="input"
              />
            </div>
            <div>
              <label className="label">Monthly Income *</label>
              <input
                {...register("monthly_income", { required: "Required" })}
                type="number"
                step="0.01"
                className={`input ${errors.monthly_income ? "input-error" : ""}`}
              />
              {errors.monthly_income && (
                <p className="field-error">{errors.monthly_income.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* Financial */}
        <section className="card-panel-light border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-800 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              Financial
            </h2>
          </div>
          <div className="mt-5">
            <label className="label">Approved Monthly Contribution (₦) *</label>
            <input
              {...register("approved_monthly_contribution", {
                required: "Required",
                min: 1000,
              })}
              type="number"
              step="1000"
              min="1000"
              className={`input ${errors.approved_monthly_contribution ? "input-error" : ""}`}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Minimum ₦1,000.
            </p>
            {errors.approved_monthly_contribution && (
              <p className="field-error">
                {errors.approved_monthly_contribution.message}
              </p>
            )}
          </div>
        </section>

        {/* Addresses */}
        <section className="card-panel-light border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-gray-800 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📍</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-rose-700 dark:text-rose-300">
              Addresses
            </h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Residential Address *</label>
              <textarea
                {...register("residential_address", { required: "Required" })}
                className={`input h-24 resize-none ${errors.residential_address ? "input-error" : ""}`}
              />
              {errors.residential_address && (
                <p className="field-error">
                  {errors.residential_address.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Permanent Home Address *</label>
              <textarea
                {...register("permanent_home_address", {
                  required: "Required",
                })}
                className={`input h-24 resize-none ${errors.permanent_home_address ? "input-error" : ""}`}
              />
              {errors.permanent_home_address && (
                <p className="field-error">
                  {errors.permanent_home_address.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Next of Kin */}
        <section className="card-panel-light border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-800 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🆘</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              Next of Kin
            </h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Full Name *</label>
              <input
                {...register("next_of_kin_name", { required: "Required" })}
                className={`input ${errors.next_of_kin_name ? "input-error" : ""}`}
              />
              {errors.next_of_kin_name && (
                <p className="field-error">{errors.next_of_kin_name.message}</p>
              )}
            </div>
            <div>
              <label className="label">Relationship *</label>
              <input
                {...register("next_of_kin_relationship", {
                  required: "Required",
                })}
                className={`input ${errors.next_of_kin_relationship ? "input-error" : ""}`}
              />
              {errors.next_of_kin_relationship && (
                <p className="field-error">
                  {errors.next_of_kin_relationship.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Phone *</label>
              <input
                {...register("next_of_kin_phone", { required: "Required" })}
                className={`input ${errors.next_of_kin_phone ? "input-error" : ""}`}
              />
              {errors.next_of_kin_phone && (
                <p className="field-error">
                  {errors.next_of_kin_phone.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Place of Work</label>
              <input
                {...register("next_of_kin_place_of_work")}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Next of Kin Address *</label>
              <textarea
                {...register("next_of_kin_address", { required: "Required" })}
                className={`input h-24 resize-none ${errors.next_of_kin_address ? "input-error" : ""}`}
              />
              {errors.next_of_kin_address && (
                <p className="field-error">
                  {errors.next_of_kin_address.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || (!profileMissing && !isDirty)}
          className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-800 py-3 text-white font-semibold shadow-lg hover:from-primary-700 hover:to-primary-900 disabled:opacity-50 transition-all dark:from-primary-700 dark:to-primary-900"
        >
          {isSubmitting
            ? profileMissing
              ? "Creating..."
              : "Saving..."
            : profileMissing
              ? "Create Profile"
              : "Save Changes"}
        </button>
        {!profileMissing && !isDirty && !isSubmitting && (
          <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
            No changes to save.
          </p>
        )}
      </form>
    </div>
  );
}
