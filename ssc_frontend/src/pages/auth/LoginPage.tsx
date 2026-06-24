import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import type { LoginRequest } from "@/types";
import { AxiosError } from "axios";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>();

  const onSubmit = async (data: LoginRequest) => {
    setServerError("");
    try {
      const result = await login(data);

      const token = localStorage.getItem("SSC_access");
      if (token) {
        const payload = token.split(".")[1];
        const decoded = JSON.parse(
          atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
        );
        localStorage.setItem(
          "user",
          JSON.stringify({
            user_id: decoded.user_id,
            staff_id: decoded.staff_id,
            role: decoded.role,
            file_number: decoded.file_number,
            full_name: decoded.full_name,
          }),
        );
      }

      if (result.is_first_login) {
        navigate("/set-password");
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const error = err as AxiosError<Record<string, string[]>>;
      const detail = error.response?.data;
      if (detail?.detail) {
        setServerError(detail.detail as unknown as string);
      } else if (detail?.staff_id) {
        setServerError(detail.staff_id[0]);
      } else if (detail?.non_field_errors) {
        setServerError(detail.non_field_errors[0]);
      } else {
        setServerError(
          "Invalid credentials. Please check your Staff ID and password.",
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-3">
            <span className="text-3xl font-black text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            Solace Staff Cooperative
          </h1>
          <p className="text-primary-200 text-sm mt-1">Management System</p>
        </div>

        {/* Card – dark mode added */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Sign in
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Use your school Staff ID to access the system.
          </p>

          {serverError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <span className="text-red-500 dark:text-red-400 text-base leading-tight mt-0.5">
                ⚠
              </span>
              <span className="leading-snug">{serverError}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {/* Staff ID */}
            <div>
              <label
                htmlFor="staff_id"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Staff ID
              </label>
              <input
                id="staff_id"
                {...register("staff_id", {
                  required: "Staff ID is required",
                  pattern: {
                    value: /^S\d{2}-\d{4}$/,
                    message: "Format: S43-0094",
                  },
                })}
                className={[
                  "w-full px-4 border rounded-xl",
                  "text-base font-mono tracking-wider",
                  "placeholder-gray-400 dark:placeholder-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                  "transition duration-150",
                  errors.staff_id
                    ? "border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200"
                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                ].join(" ")}
                style={{ fontSize: "16px", padding: "14px 16px" }}
                placeholder="S43-0094"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="username"
                inputMode="text"
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                }}
              />
              {errors.staff_id && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                  ⚠ {errors.staff_id.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  {...register("password", {
                    required: "Password is required",
                  })}
                  type={showPassword ? "text" : "password"}
                  className={[
                    "w-full pr-14 border rounded-xl",
                    "text-base",
                    "placeholder-gray-400 dark:placeholder-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                    "transition duration-150",
                    errors.password
                      ? "border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                  ].join(" ")}
                  style={{ fontSize: "16px", padding: "14px 56px 14px 16px" }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="text-xl">{showPassword ? "🙈" : "👁"}</span>
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                  ⚠ {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              style={{ fontSize: "16px", padding: "16px" }}
            >
              {isSubmitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="text-center pt-1">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
              >
                Forgot your password?
              </Link>
            </div>
          </form>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-5 leading-relaxed">
            First time? Your Admin will provide your Staff ID.
          </p>
        </div>

        <p className="text-center text-primary-300 dark:text-primary-400 text-xs mt-4">
          SSC Cooperative Management System v1.2
        </p>
      </div>
    </div>
  );
}
