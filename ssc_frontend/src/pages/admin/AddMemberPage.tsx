import { useState } from "react";
import { useForm } from "react-hook-form";
import { membersApi } from "@/api/services";
import { PageHeader } from "@/components/common";
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
}

export default function AddMemberPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      role: "staff",
      marital_status: "single",
      gender: "male",
      school_branch: "primary",
    },
  });

  const onSubmit = async (data: FormData) => {
    setMessage(null);
    setIsError(false);

    try {
      await membersApi.create({
        ...data,
        proposed_monthly_contribution: data.proposed_monthly_contribution,
      });
      setMessage("Member created successfully.");
      reset({
        role: "staff",
        marital_status: "single",
        gender: "male",
        school_branch: "primary",
      } as Partial<FormData>);
    } catch {
      setMessage("Failed to create member. Please check all fields.");
      setIsError(true);
    }
  };

  return (
    <div className="card p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Add Member"
        subtitle="Create a new member account and profile from the admin panel."
        back={{ to: "/members", label: "Back to Members" }}
      />

      {message && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${isError ? "bg-danger-50 text-danger-700 border border-danger-200" : "bg-success-50 text-success-700 border border-success-200"}`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Staff ID</label>
            <input
              {...register("staff_id", { required: "Staff ID is required" })}
              className="input"
            />
            {errors.staff_id && (
              <p className="field-error">{errors.staff_id.message}</p>
            )}
          </div>
          <div>
            <label className="label">Role</label>
            <select {...register("role")} className="input">
              <option value="staff">Staff</option>
              <option value="committee">Committee</option>
              <option value="head_of_school">Head of School</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Full Name</label>
            <input
              {...register("full_name", { required: "Full name is required" })}
              className="input"
            />
            {errors.full_name && (
              <p className="field-error">{errors.full_name.message}</p>
            )}
          </div>
          <div>
            <label className="label">Primary Phone</label>
            <input
              {...register("phone_primary", { required: "Phone is required" })}
              className="input"
            />
            {errors.phone_primary && (
              <p className="field-error">{errors.phone_primary.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Secondary Phone</label>
            <input {...register("phone_secondary")} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              {...register("email_address")}
              className="input"
              type="email"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
            <label className="label">Gender</label>
            <select {...register("gender")} className="input">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Date of Birth</label>
            <input
              {...register("date_of_birth", {
                required: "Date of birth is required",
              })}
              type="date"
              className="input"
            />
            {errors.date_of_birth && (
              <p className="field-error">{errors.date_of_birth.message}</p>
            )}
          </div>
          <div>
            <label className="label">Place of Birth</label>
            <input
              {...register("place_of_birth", {
                required: "Place of birth is required",
              })}
              className="input"
            />
            {errors.place_of_birth && (
              <p className="field-error">{errors.place_of_birth.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
            <input
              {...register("designation", {
                required: "Designation is required",
              })}
              className="input"
            />
            {errors.designation && (
              <p className="field-error">{errors.designation.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Date Joined School</label>
            <input
              {...register("date_joined_school", {
                required: "Join date is required",
              })}
              type="date"
              className="input"
            />
            {errors.date_joined_school && (
              <p className="field-error">{errors.date_joined_school.message}</p>
            )}
          </div>
          <div>
            <label className="label">Monthly Income</label>
            <input
              {...register("monthly_income", {
                required: "Income is required",
              })}
              type="number"
              step="0.01"
              className="input"
            />
            {errors.monthly_income && (
              <p className="field-error">{errors.monthly_income.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Proposed Monthly Contribution</label>
            <input
              {...register("proposed_monthly_contribution", {
                required: "Contribution is required",
              })}
              type="number"
              step="0.01"
              className="input"
            />
            {errors.proposed_monthly_contribution && (
              <p className="field-error">
                {errors.proposed_monthly_contribution.message}
              </p>
            )}
          </div>
          <div>
            <label className="label">Social Media Handle</label>
            <input {...register("social_media_handle")} className="input" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Residential Address</label>
            <textarea
              {...register("residential_address", {
                required: "Residential address is required",
              })}
              className="input h-24 resize-none"
            />
            {errors.residential_address && (
              <p className="field-error">
                {errors.residential_address.message}
              </p>
            )}
          </div>
          <div>
            <label className="label">Permanent Home Address</label>
            <textarea
              {...register("permanent_home_address", {
                required: "Permanent address is required",
              })}
              className="input h-24 resize-none"
            />
            {errors.permanent_home_address && (
              <p className="field-error">
                {errors.permanent_home_address.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">State of Origin</label>
            <input
              {...register("state_of_origin", {
                required: "State of origin is required",
              })}
              className="input"
            />
            {errors.state_of_origin && (
              <p className="field-error">{errors.state_of_origin.message}</p>
            )}
          </div>
          <div>
            <label className="label">Local Government Area</label>
            <input
              {...register("local_government_area", {
                required: "LGA is required",
              })}
              className="input"
            />
            {errors.local_government_area && (
              <p className="field-error">
                {errors.local_government_area.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Next of Kin Name</label>
            <input
              {...register("next_of_kin_name", {
                required: "Next of kin is required",
              })}
              className="input"
            />
            {errors.next_of_kin_name && (
              <p className="field-error">{errors.next_of_kin_name.message}</p>
            )}
          </div>
          <div>
            <label className="label">Next of Kin Phone</label>
            <input
              {...register("next_of_kin_phone", {
                required: "Next of kin phone is required",
              })}
              className="input"
            />
            {errors.next_of_kin_phone && (
              <p className="field-error">{errors.next_of_kin_phone.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Relationship</label>
            <input
              {...register("next_of_kin_relationship", {
                required: "Relationship is required",
              })}
              className="input"
            />
            {errors.next_of_kin_relationship && (
              <p className="field-error">
                {errors.next_of_kin_relationship.message}
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

        <div>
          <label className="label">Next of Kin Address</label>
          <textarea
            {...register("next_of_kin_address", {
              required: "Address is required",
            })}
            className="input h-24 resize-none"
          />
          {errors.next_of_kin_address && (
            <p className="field-error">{errors.next_of_kin_address.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-2.5"
        >
          {isSubmitting ? "Creating member..." : "Create Member"}
        </button>
      </form>
    </div>
  );
}
