import { useState } from "react";
import api from "@/api/client";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await api.post("/accounts/change-password/", {
        current_password: current,
        new_password: newPwd,
        confirm_password: confirm,
      });
      setMessage("Password changed successfully.");
      setCurrent("");
      setNewPwd("");
      setConfirm("");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Change Password</h1>
      {message && (
        <div className="bg-success-50 text-success-700 p-3 rounded mb-4">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-danger-50 text-danger-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="current-password" className="label">
            Current Password
          </label>
          <input
            id="current-password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="input"
            required
            aria-label="Current password"
            title="Current password"
          />
        </div>
        <div>
          <label htmlFor="new-password" className="label">
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="input"
            required
            aria-label="New password"
            title="New password"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">
            Confirm New Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            required
            aria-label="Confirm new password"
            title="Confirm new password"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
