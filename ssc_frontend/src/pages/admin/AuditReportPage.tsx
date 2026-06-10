import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";

export default function AuditReportPage() {
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-report", userId, dateFrom, dateTo, page],
    queryFn: () =>
      api
        .get("/audit/report/", {
          params: {
            user_id: userId || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            page,
          },
        })
        .then((r) => r.data),
  });

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await api.get("/audit/report/", {
        params: {
          format: "csv",
          user_id: userId,
          date_from: dateFrom,
          date_to: dateTo,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-report.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        subtitle="View all administrative actions"
      />

      {/* Enhanced Filter Bar with gradient and icons */}
      <div className="card-panel p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-100 dark:border-gray-700 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="label text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="input pl-9"
              placeholder="Filter by user ID"
            />
          </div>
          <div>
            <label className="label text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              From (Date)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input"
              title="Filter logs from this date" 
            />
          </div>
          <div>
            <label className="label text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              To (Date)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input"
              title="Filter logs up to this date"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              onClick={handleApplyFilters}
              className="btn-primary flex-1 shadow-sm hover:shadow-md transition-all"
            >
              Apply Filters
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="btn-secondary flex-1 shadow-sm hover:shadow-md transition-all"
            >
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>
      </div>

      {isLoading || isFetching ? (
        <PageLoader />
      ) : data?.results?.length ? (
        <>
          {/* Enhanced Table Container */}
          <div className="table-container rounded-xl overflow-hidden shadow-md">
            <table className="table w-full">
              <thead className="bg-primary-50 dark:bg-primary-900/30 text-gray-700 dark:text-gray-200 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Object Type</th>
                  <th className="px-5 py-4">Object ID</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.results.map((log: any, idx: number) => (
                  <tr
                    key={log.id}
                    className={`transition-colors hover:bg-primary-50/30 dark:hover:bg-primary-900/20 ${
                      idx % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50/50 dark:bg-gray-800/70"
                    }`}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {log.id}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {log.user_name || "System"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-primary-100 dark:bg-primary-900/50 px-2.5 py-0.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {log.object_type}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {log.object_id}
                    </td>
                    <td className="px-5 py-3 max-w-md truncate text-gray-600 dark:text-gray-300">
                      {log.description}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination with better styling */}
          {data.count > (data.results?.length || 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.previous}
                className="btn-secondary btn-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Page {page}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  (of {Math.ceil(data.count / (data.results?.length || 1))})
                </span>
              </div>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.next}
                className="btn-secondary btn-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon="📜"
          title="No audit logs found"
          description="Adjust filters to see more entries."
        />
      )}
    </div>
  );
}
