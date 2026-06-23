import { useState } from "react";
import api from "@/api/client"; // ✅ default import

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Basic validation
    if (newPassword !== confirmPassword) {
      setMessage({
        type: "error",
        text: "New passwords do not match. Please re‑enter.",
      });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "New password must be at least 8 characters long.",
      });
      return;
    }

    setLoading(true);
    try {
      await api.post("/accounts/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setMessage({
        type: "success",
        text: "Password changed successfully! You can now use your new password.",
      });
      // Optionally clear fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorText = "Something went wrong. Please try again later.";

      if (errorData?.error) {
        if (Array.isArray(errorData.error)) {
          errorText = errorData.error.join(", ");
        } else if (typeof errorData.error === "string") {
          errorText = errorData.error;
        }
      } else if (errorData?.detail) {
        errorText = errorData.detail;
      } else if (err.response?.status === 429) {
        errorText = "Too many attempts. Please wait a moment and try again.";
      } else if (err.response?.status === 400) {
        errorText =
          "Invalid input. Please check your current password and the new password requirements.";
      }

      setMessage({ type: "error", text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4 sm:p-6 antialiased">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 mb-4">
            <span className="text-3xl sm:text-4xl font-black text-white">
              S
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            SMS Cooperative
          </h1>
          <p className="text-primary-200 text-sm sm:text-base mt-1">
            Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 transition-all duration-300">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            Change Password
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mb-6">
            Update your password regularly to keep your account secure.
          </p>

          {message && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              <span className="text-lg leading-none">
                {message.type === "success" ? "✓" : "⚠"}
              </span>
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div>
              <label
                htmlFor="current"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  id="current"
                  type={showCurrent ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-200 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                >
                  {showCurrent ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="new"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="new"
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-200 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                >
                  {showNew ? "🙈" : "👁"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Minimum 8 characters, mix of letters, numbers, and symbols.
              </p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-200 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                >
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
              {newPassword &&
                confirmPassword &&
                newPassword !== confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    Passwords do not match
                  </p>
                )}
              {newPassword &&
                confirmPassword &&
                newPassword === confirmPassword && (
                  <p className="mt-1 text-sm text-green-600">
                    ✓ Passwords match
                  </p>
                )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-primary-300 text-xs mt-4">
          SMS Cooperative Management System v1.2
        </p>
      </div>
    </div>
  );
}
