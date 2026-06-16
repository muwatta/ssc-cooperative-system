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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow">
        <h2 className="text-center text-3xl font-bold">Reset Password</h2>
        <p className="text-center text-gray-600">
          Enter your email address and we'll send you a link to reset your
          password.
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-3 py-2 border rounded-lg"
          />
          {message && <div className="text-green-600 text-sm">{message}</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      </div>
    </div>
  );
}
