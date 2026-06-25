import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/accounts/password-reset/confirm/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token, new_password: newPassword }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setError(data.error || "Invalid or expired reset link");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { label: "", color: "", width: "0%" };
    const score =
      (password.length >= 8 ? 1 : 0) +
      (/[a-z]/.test(password) ? 1 : 0) +
      (/[A-Z]/.test(password) ? 1 : 0) +
      (/[0-9]/.test(password) ? 1 : 0) +
      (/[^a-zA-Z0-9]/.test(password) ? 1 : 0);
    if (score <= 2) return { label: "Weak", color: "bg-red-500", width: "20%" };
    if (score <= 3)
      return { label: "Fair", color: "bg-yellow-500", width: "50%" };
    if (score <= 4)
      return { label: "Good", color: "bg-blue-500", width: "75%" };
    return { label: "Strong", color: "bg-green-500", width: "100%" };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
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
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Create New Password
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-150"
                  style={{ fontSize: "16px", padding: "14px 56px 14px 16px" }}
                  autoComplete="new-password"
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

              {/* Strength indicator */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-12 text-right">
                      {strength.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Min. 8 characters — mix letters, numbers, symbols.
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-150"
                  style={{ fontSize: "16px", padding: "14px 56px 14px 16px" }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  <span className="text-xl">
                    {showConfirmPassword ? "🙈" : "👁"}
                  </span>
                </button>
              </div>
              {newPassword &&
                confirmPassword &&
                newPassword !== confirmPassword && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    ⚠ Passwords do not match
                  </p>
                )}
              {newPassword &&
                confirmPassword &&
                newPassword === confirmPassword && (
                  <p className="mt-1.5 text-sm text-green-600 dark:text-green-400">
                    ✓ Passwords match
                  </p>
                )}
            </div>

            {message && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                <span className="text-green-500 dark:text-green-400 text-base leading-tight mt-0.5">
                  ✓
                </span>
                <span className="leading-snug">
                  {message} Redirecting to login…
                </span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                <span className="text-red-500 dark:text-red-400 text-base leading-tight mt-0.5">
                  ⚠
                </span>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              style={{ fontSize: "16px", padding: "16px" }}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Resetting…
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="text-center pt-1">
              <a
                href="/login"
                className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition duration-150"
              >
                ← Back to Sign In
              </a>
            </div>
          </form>
        </div>

        <p className="text-center text-primary-300 dark:text-primary-400 text-xs mt-4">
          SSC Cooperative Management System v1.2
        </p>
      </div>
    </div>
  );
}
