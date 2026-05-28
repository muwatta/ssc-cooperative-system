import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { membersApi } from "@/api/services";
import { useAuth } from "@/context/AuthContext";
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
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await membersApi.me();
        if (!response.data) {
          setProfile(null);
          setProfileMissing(true);
          setServerMessage(
            "No profile found. Complete the form below to create your member profile.",
          );
          setIsError(false);
          reset({
            full_name: user?.full_name ?? "",
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

        setProfile(response.data);
        reset({
          full_name: response.data.full_name,
          phone_primary: response.data.phone_primary,
          phone_secondary: response.data.phone_secondary,
          marital_status: response.data.marital_status,
          gender: response.data.gender,
          date_of_birth: response.data.date_of_birth,
          place_of_birth: response.data.place_of_birth,
          school_branch: response.data.school_branch,
          designation: response.data.designation,
          date_joined_school: response.data.date_joined_school,
          monthly_income: response.data.monthly_income,
          residential_address: response.data.residential_address,
          permanent_home_address: response.data.permanent_home_address,
          email_address: response.data.email_address,
          social_media_handle: response.data.social_media_handle,
          state_of_origin: response.data.state_of_origin,
          local_government_area: response.data.local_government_area,
          next_of_kin_name: response.data.next_of_kin_name,
          next_of_kin_address: response.data.next_of_kin_address,
          next_of_kin_phone: response.data.next_of_kin_phone,
          next_of_kin_relationship: response.data.next_of_kin_relationship,
          next_of_kin_place_of_work: response.data.next_of_kin_place_of_work,
        });
      } catch (error) {
        const axiosError = error as any;
        if (axiosError?.response?.status === 404) {
          setProfile(null);
          setProfileMissing(true);
          setServerMessage(
            "No profile found. Complete the form below to create your member profile.",
          );
          setIsError(false);
          reset({
            full_name: user?.full_name ?? "",
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
          setServerMessage("Unable to load profile. Please try again later.");
          setIsError(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [reset, user]);

  const onSubmit = async (data: ProfileForm) => {
    setServerMessage(null);
    setIsError(false);

    try {
      const response = profileMissing
        ? await membersApi.createMe(data)
        : await membersApi.updateMe(data);

      setProfile(response.data);
      setProfileMissing(false);
      updateUser({ full_name: response.data.full_name });
      setServerMessage(
        profileMissing
          ? "Profile created successfully."
          : "Profile updated successfully.",
      );
      reset(response.data);
    } catch {
      setServerMessage(
        profileMissing
          ? "Failed to create profile. Please check your details and try again."
          : "Failed to update profile. Please check your details and try again.",
      );
      setIsError(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-600">Loading your profile...</div>
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-gray-500">
          Update your personal and contact details here.
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

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="staff_id" className="label">
              Staff ID
            </label>
            <input
              id="staff_id"
              className="input bg-gray-100"
              value={profile?.staff_id ?? user?.staff_id ?? ""}
              disabled
            />
          </div>
          <div className="mb-4">
            <label htmlFor="file_number" className="label">
              SSC File Number
            </label>
            <input
              id="file_number"
              className="input bg-gray-100"
              value={profile?.file_number ?? "Not assigned yet"}
              disabled
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="full_name" className="label">
              Full Name
            </label>
            <input
              id="full_name"
              {...register("full_name", { required: "Full name is required" })}
              className={`input ${errors.full_name ? "input-error" : ""}`}
            />
            {errors.full_name && (
              <p className="field-error">{errors.full_name.message}</p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="phone_primary" className="label">
              Phone
            </label>
            <input
              id="phone_primary"
              {...register("phone_primary", {
                required: "Phone number is required",
              })}
              className={`input ${errors.phone_primary ? "input-error" : ""}`}
            />
            {errors.phone_primary && (
              <p className="field-error">{errors.phone_primary.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="phone_secondary" className="label">
              Secondary Phone
            </label>
            <input
              id="phone_secondary"
              {...register("phone_secondary")}
              className="input"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="email_address" className="label">
              Email Address
            </label>
            <input
              id="email_address"
              {...register("email_address")}
              className="input"
              type="email"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="marital_status" className="label">
              Marital Status
            </label>
            <select
              id="marital_status"
              {...register("marital_status")}
              className="input"
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </div>
          <div className="mb-4">
            <label htmlFor="gender" className="label">
              Gender
            </label>
            <select id="gender" {...register("gender")} className="input">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="date_of_birth" className="label">
              Date of Birth
            </label>
            <input
              id="date_of_birth"
              {...register("date_of_birth", {
                required: "Date of birth is required",
              })}
              className={`input ${errors.date_of_birth ? "input-error" : ""}`}
              type="date"
            />
            {errors.date_of_birth && (
              <p className="field-error">{errors.date_of_birth.message}</p>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="place_of_birth" className="label">
              Place of Birth
            </label>
            <input
              id="place_of_birth"
              {...register("place_of_birth", {
                required: "Place of birth is required",
              })}
              className={`input ${errors.place_of_birth ? "input-error" : ""}`}
            />
            {errors.place_of_birth && (
              <p className="field-error">{errors.place_of_birth.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="school_branch" className="label">
              School Branch
            </label>
            <select
              id="school_branch"
              {...register("school_branch")}
              className="input"
            >
              <option value="primary">Primary</option>
              <option value="college">College</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="mb-4">
            <label htmlFor="designation" className="label">
              Designation
            </label>
            <input
              id="designation"
              {...register("designation")}
              className="input"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="date_joined_school" className="label">
              Date Joined School
            </label>
            <input
              id="date_joined_school"
              {...register("date_joined_school")}
              className="input"
              type="date"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="monthly_income" className="label">
              Monthly Income
            </label>
            <input
              id="monthly_income"
              {...register("monthly_income", {
                required: "Monthly income is required",
              })}
              className={`input ${errors.monthly_income ? "input-error" : ""}`}
              type="number"
              step="0.01"
            />
            {errors.monthly_income && (
              <p className="field-error">{errors.monthly_income.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="residential_address" className="label">
              Residential Address
            </label>
            <textarea
              id="residential_address"
              {...register("residential_address", {
                required: "Residential address is required",
              })}
              className={`input h-24 resize-none ${errors.residential_address ? "input-error" : ""}`}
            />
            {errors.residential_address && (
              <p className="field-error">
                {errors.residential_address.message}
              </p>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="permanent_home_address" className="label">
              Permanent Home Address
            </label>
            <textarea
              id="permanent_home_address"
              {...register("permanent_home_address", {
                required: "Permanent address is required",
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="state_of_origin" className="label">
              State of Origin
            </label>
            <input
              id="state_of_origin"
              {...register("state_of_origin", {
                required: "State of origin is required",
              })}
              className={`input ${errors.state_of_origin ? "input-error" : ""}`}
            />
            {errors.state_of_origin && (
              <p className="field-error">{errors.state_of_origin.message}</p>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="local_government_area" className="label">
              Local Government Area
            </label>
            <input
              id="local_government_area"
              {...register("local_government_area", {
                required: "LGA is required",
              })}
              className={`input ${errors.local_government_area ? "input-error" : ""}`}
            />
            {errors.local_government_area && (
              <p className="field-error">
                {errors.local_government_area.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="next_of_kin_name" className="label">
              Next of Kin Name
            </label>
            <input
              id="next_of_kin_name"
              {...register("next_of_kin_name", {
                required: "Next of kin name is required",
              })}
              className={`input ${errors.next_of_kin_name ? "input-error" : ""}`}
            />
            {errors.next_of_kin_name && (
              <p className="field-error">{errors.next_of_kin_name.message}</p>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="next_of_kin_phone" className="label">
              Next of Kin Phone
            </label>
            <input
              id="next_of_kin_phone"
              {...register("next_of_kin_phone", {
                required: "Next of kin phone is required",
              })}
              className={`input ${errors.next_of_kin_phone ? "input-error" : ""}`}
            />
            {errors.next_of_kin_phone && (
              <p className="field-error">{errors.next_of_kin_phone.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label htmlFor="next_of_kin_relationship" className="label">
              Next of Kin Relationship
            </label>
            <input
              id="next_of_kin_relationship"
              {...register("next_of_kin_relationship", {
                required: "Relationship is required",
              })}
              className={`input ${errors.next_of_kin_relationship ? "input-error" : ""}`}
            />
            {errors.next_of_kin_relationship && (
              <p className="field-error">
                {errors.next_of_kin_relationship.message}
              </p>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="next_of_kin_place_of_work" className="label">
              Next of Kin Place of Work
            </label>
            <input
              id="next_of_kin_place_of_work"
              {...register("next_of_kin_place_of_work")}
              className="input"
            />
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="next_of_kin_address" className="label">
            Next of Kin Address
          </label>
          <textarea
            id="next_of_kin_address"
            {...register("next_of_kin_address", {
              required: "Next of kin address is required",
            })}
            className={`input h-24 resize-none ${errors.next_of_kin_address ? "input-error" : ""}`}
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
          {isSubmitting
            ? "Saving..."
            : profileMissing
              ? "Create Profile"
              : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
