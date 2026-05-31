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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await membersApi.me();
        const data = response.data;

        if (!data || !data.id) {
          setProfile(null);
          setProfileMissing(true);
          setIsLoading(false);
          return;
        }

        setProfile(data);
        setProfileMissing(false);

        // Pre-fill form with existing data
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
        } else {
          setServerMessage("Unable to load profile. Please try again.");
          setIsError(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [reset]);

  const onSubmit = async (data: ProfileForm) => {
    setServerMessage(null);
    setIsError(false);

    if (!profile) {
      setServerMessage(
        "No profile found. Please contact Admin to create your member profile.",
      );
      setIsError(true);
      return;
    }

    try {
      const response = await membersApi.update(profile.id, data);
      setProfile(response.data);
      // Re-sync form so isDirty resets
      reset({
        full_name: response.data.full_name,
        phone_primary: response.data.phone_primary,
        phone_secondary: response.data.phone_secondary ?? "",
        marital_status: response.data.marital_status,
        gender: response.data.gender,
        date_of_birth: response.data.date_of_birth,
        place_of_birth: response.data.place_of_birth,
        school_branch: response.data.school_branch,
        designation: response.data.designation,
        date_joined_school: response.data.date_joined_school,
        monthly_income: response.data.monthly_income,
        approved_monthly_contribution:
          response.data.approved_monthly_contribution,
        residential_address: response.data.residential_address,
        permanent_home_address: response.data.permanent_home_address,
        email_address: response.data.email_address ?? "",
        social_media_handle: response.data.social_media_handle ?? "",
        state_of_origin: response.data.state_of_origin,
        local_government_area: response.data.local_government_area,
        next_of_kin_name: response.data.next_of_kin_name,
        next_of_kin_address: response.data.next_of_kin_address,
        next_of_kin_phone: response.data.next_of_kin_phone,
        next_of_kin_relationship: response.data.next_of_kin_relationship,
        next_of_kin_place_of_work:
          response.data.next_of_kin_place_of_work ?? "",
      });
      setServerMessage("Profile updated successfully.");
      setIsError(false);
    } catch (err: any) {
      const d = err?.response?.data;
      const msg =
        d?.approved_monthly_contribution?.[0] ||
        d?.detail ||
        (Object.values(d || {}).flat()[0] as string) ||
        "Failed to update profile. Please check your details.";
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
    <div className="card p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-gray-500">
          Your SSC member record. Contact Admin for changes to contribution
          amount.
        </p>
      </div>

      {/* Profile missing notice */}
      {profileMissing && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          <p className="font-semibold">No member profile found.</p>
          <p className="mt-1">
            Contact your Admin to create your member profile. You cannot create
            it yourself — it must be registered by an administrator.
          </p>
        </div>
      )}

      {serverMessage && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            isError
              ? "border-danger-200 bg-danger-50 text-danger-700"
              : "border-green-200 bg-success-50 text-success-700"
          }`}
        >
          {serverMessage}
        </div>
      )}

      {/* Read-only identity fields */}
      <div className="mb-6 grid gap-4 md:grid-cols-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            Staff ID
          </p>
          <p className="font-mono font-medium text-gray-900 mt-1">
            {profile?.staff_id ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            SSC File Number
          </p>
          <p className="font-mono font-medium text-primary-700 mt-1">
            {profile?.file_number ?? "Not assigned"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            Membership Status
          </p>
          <p className="font-medium capitalize text-gray-900 mt-1">
            {profile?.membership_status ?? "—"}
          </p>
        </div>
      </div>

      {/* Editable form — only shown when profile exists */}
      {!profileMissing && (
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Personal */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Personal Information
          </h2>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
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

          {/* School */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
            School Details
          </h2>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
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

          {/* Financial — contribution is read-only, requires change form */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Financial
          </h2>
          <input
            className="input bg-gray-50 text-gray-500"
            value={`₦${Number(profile?.approved_monthly_contribution ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`}
            disabled
            aria-label="Approved monthly contribution amount"
            title="Approved monthly contribution amount"
          />

          {/* Addresses */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Addresses
          </h2>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
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

          {/* Next of Kin */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Next of Kin
          </h2>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
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
          </div>
          <div className="mb-8">
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

          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="btn-primary w-full py-2.5 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Profile"}
          </button>
          {!isDirty && !isSubmitting && (
            <p className="mt-2 text-center text-xs text-gray-400">
              No changes to save.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
