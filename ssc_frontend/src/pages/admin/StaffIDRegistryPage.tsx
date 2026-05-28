import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { staffIdApi } from "@/api/services";
import type { StaffIDEntry } from "@/types";

interface FormData {
  staff_id: string;
}

export default function StaffIDRegistryPage() {
  const [entries, setEntries] = useState<StaffIDEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>();

  useEffect(() => {
    const loadRegistry = async () => {
      try {
        const response = await staffIdApi.list();
        setEntries(response.data.results);
      } catch {
        setServerMessage("Unable to load staff registry.");
        setIsError(true);
      } finally {
        setLoading(false);
      }
    };

    loadRegistry();
  }, []);

  const onSubmit = async (data: FormData) => {
    setServerMessage(null);
    setIsError(false);

    try {
      const response = await staffIdApi.create(data.staff_id);
      setEntries((prev) => [response.data, ...prev]);
      reset();
      setServerMessage("Staff ID registered successfully.");
    } catch (error) {
      setServerMessage("Failed to register Staff ID.");
      setIsError(true);
    }
  };

  const toggleActive = async (id: number, currentStatus: boolean) => {
    setTogglingId(id);
    setServerMessage(null);
    setIsError(false);

    try {
      const response = await staffIdApi.update(id, {
        is_active: !currentStatus,
      });
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? response.data : entry)),
      );
      setServerMessage(
        !currentStatus ? "Staff ID activated." : "Staff ID deactivated.",
      );
    } catch {
      setServerMessage("Failed to update Staff ID status.");
      setIsError(true);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="card p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Staff ID Registry</h1>
        <p className="text-sm text-gray-500">
          Add and manage Staff IDs that can be used to register in the system.
        </p>
      </div>

      {serverMessage && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${isError ? "bg-danger-50 text-danger-700 border border-danger-200" : "bg-success-50 text-success-700 border border-success-200"}`}
        >
          {serverMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]"
      >
        <input
          {...register("staff_id", { required: "Staff ID is required" })}
          className="input"
          placeholder="S43-0002"
        />
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? "Adding..." : "Add Staff ID"}
        </button>
      </form>

      {loading ? (
        <div className="text-gray-600">Loading registry...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-sm text-gray-500">
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No Staff IDs registered yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entry.staff_id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`badge ${entry.is_active ? "badge-success" : "badge-gray"}`}
                      >
                        {entry.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleActive(entry.id, entry.is_active)}
                        disabled={togglingId === entry.id}
                        className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${
                          entry.is_active
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            : "bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                        }`}
                      >
                        {togglingId === entry.id
                          ? "Updating..."
                          : entry.is_active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
