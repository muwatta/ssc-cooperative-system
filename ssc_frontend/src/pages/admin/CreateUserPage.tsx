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
          <input
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters.",
              },
            })}
            className="input"
            type="password"
          />
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
