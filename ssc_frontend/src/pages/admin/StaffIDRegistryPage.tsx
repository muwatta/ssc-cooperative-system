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
    } catch (error: any) {
      const message =
        error?.response?.data?.staff_id?.[0] ||
        error?.response?.data?.error ||
        "Failed to register Staff ID.";
      setServerMessage(message);
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="page-title">Staff ID Registry</h1>
        <p className="page-subtitle">
          Add and manage Staff IDs that can be used to register in the system.
        </p>
      </div>

      {/* Alert message */}
      {serverMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            isError
              ? "bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-900/30 dark:border-danger-800 dark:text-danger-300"
              : "bg-success-50 border-green-200 text-success-700 dark:bg-success-900/30 dark:border-success-800 dark:text-success-300"
          }`}
        >
          {serverMessage}
        </div>
      )}

      {/* Add Staff ID Form */}
      <div className="card-panel">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <div className="flex-1">
            <input
              {...register("staff_id", { required: "Staff ID is required" })}
              className="input"
              placeholder="S43-0002"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary whitespace-nowrap"
          >
            {isSubmitting ? "Adding..." : "Add Staff ID"}
          </button>
        </form>
      </div>

      {/* Staff ID List Table */}
      {loading ? (
        <div className="text-gray-600 dark:text-gray-400">
          Loading registry...
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center text-gray-500 dark:text-gray-400"
                  >
                    No Staff IDs registered yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-medium">{entry.staff_id}</td>
                    <td>
                      <span
                        className={`badge ${
                          entry.is_active ? "badge-success" : "badge-gray"
                        }`}
                      >
                        {entry.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        onClick={() => toggleActive(entry.id, entry.is_active)}
                        disabled={togglingId === entry.id}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                          entry.is_active
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
                            : "bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/50 dark:text-primary-300 dark:hover:bg-primary-800 disabled:opacity-50"
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
