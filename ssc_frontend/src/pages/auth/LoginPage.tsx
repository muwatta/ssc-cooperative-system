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

      // Store user object from decoded token
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
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl">
        {/* Logo / Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <span className="text-3xl sm:text-4xl font-black text-white">
              S
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Solace Staff Cooperative
          </h1>
          <p className="text-primary-200 text-sm sm:text-base mt-1">
            Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 transition-all duration-300">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
            Sign in
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mb-6">
            Use your school Staff ID to access the system.
          </p>

          {serverError && (
            <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <span className="text-danger-500 text-lg leading-none">⚠</span>
              <span>{serverError}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            {/* Staff ID */}
            <div>
              <label
                htmlFor="staff_id"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Staff ID
              </label>
              <input
                id="staff_id"
                {...register("staff_id", {
                  required: "Staff ID is required",
                  pattern: {
                    value: /^S\d{2}-\d{4}$/,
                    message: "Format must be S{YY}-{NNNN} e.g. S43-0094",
                  },
                })}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-200 text-base uppercase ${errors.staff_id ? "border-danger-500 ring-danger-500" : "border-gray-300"}`}
                placeholder="S43-0094"
                autoFocus
                autoComplete="username"
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                }}
              />
              {errors.staff_id && (
                <p className="mt-1 text-sm text-danger-600">
                  {errors.staff_id.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
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
                  className={`w-full px-4 py-3 pr-12 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-200 text-base ${errors.password ? "border-danger-500 ring-danger-500" : "border-gray-300"}`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {isSubmitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-800 font-medium transition duration-150"
              >
                Forgot your password?
              </Link>
            </div>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            First time? Your Admin will provide your Staff ID.
          </p>
        </div>

        <p className="text-center text-primary-300 text-xs mt-4">
          SSC Cooperative Management System v1.2
        </p>
      </div>
    </div>
  );
}
