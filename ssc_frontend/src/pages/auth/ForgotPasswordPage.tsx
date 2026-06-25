import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/accounts/password-reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again later.");
    } finally {
      setLoading(false);
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
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Reset Password
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Enter your email address and we'll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition duration-150"
                style={{ fontSize: "16px", padding: "14px 16px" }}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {message && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                <span className="text-green-500 dark:text-green-400 text-base leading-tight mt-0.5">
                  ✓
                </span>
                <span className="leading-snug">{message}</span>
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
              className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  Sending…
                </>
              ) : (
                "Send Reset Link"
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
