import { useState } from "react";
import { useForm } from "react-hook-form";
import { AxiosError } from "axios";
import { usersApi } from "@/api/services";

type Form = {
  staff_id: string;
  role: "admin" | "committee" | "head_of_school" | "staff";
  password: string;
  is_first_login: boolean;
};

export default function CreateUserPage() {
  const { register, handleSubmit, reset } = useForm<Form>({
    defaultValues: { role: "staff", is_first_login: false },
  });
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data: Form) => {
    setServerMsg(null);
    setIsError(false);

    try {
      await usersApi.create(data);
      setServerMsg("User created successfully.");
      reset({
        role: "staff",
        is_first_login: false,
        staff_id: "",
        password: "",
      });
    } catch (err) {
      const error = err as AxiosError<Record<string, string | string[]>>;
      const detail = error.response?.data || {};
      const message =
        typeof detail === "object" && !Array.isArray(detail)
          ? Object.values(detail).flat().join(" ") || "Failed to create user."
          : "Failed to create user.";
      setServerMsg(message);
      setIsError(true);
    }
  };

  return (
    <div className="card p-6 max-w-md">
      <h2 className="text-lg font-semibold mb-4">Create User</h2>

      {serverMsg && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            isError
              ? "bg-danger-50 text-danger-700"
              : "bg-success-50 text-success-700"
          }`}
        >
          {serverMsg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-3">
          <label className="label">Staff ID</label>
          <input
            {...register("staff_id", { required: "Staff ID is required" })}
            className="input uppercase"
            placeholder="S43-0002"
          />
        </div>

        <div className="mb-3">
          <label className="label">Role</label>
          <select {...register("role")} className="input">
            <option value="staff">Staff</option>
            <option value="committee">Committee</option>
            <option value="head_of_school">Head of School</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="label">Password</label>
          <div className="relative">
            <input
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters.",
                },
              })}
              className="input w-full pr-10"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 012.825-4.458m4.442 4.442a3 3 0 114.243 4.243"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3l18 18"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="label inline-flex items-center gap-2">
            <input type="checkbox" {...register("is_first_login")} />
            <span>Require user to set password on first login</span>
          </label>
        </div>

        <button className="btn-primary w-full py-2.5" type="submit">
          Create User
        </button>
      </form>
    </div>
  );
}
