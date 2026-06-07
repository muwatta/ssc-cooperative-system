import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { PageHeader, PageLoader } from "@/components/common";

export default function AuditReportPage() {
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
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
      const response = await api.get("/audit/report/?format=csv", {
        params: { user_id: userId, date_from: dateFrom, date_to: dateTo },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-report.csv";
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <PageHeader
        title="Audit Trail"
        subtitle="View all administrative actions"
      />

      <div className="bg-white rounded-2xl shadow p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label text-xs">User ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input w-32"
            placeholder="User ID"
          />
        </div>
        <div>
          <label className="label text-xs">From</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input w-32"
            placeholder="User ID"
            title="Filter by user ID"
          />
        </div>
        <div>
          <label className="label text-xs">To</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input"
            title="Start date"
          />
        </div>
        <div>
          <label className="label text-xs">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input"
            title="End date"
          />
        </div>
        <button onClick={() => setPage(1)} className="btn-primary">
          Apply
        </button>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="btn-secondary"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table min-w-full">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Object</th>
                  <th>ID</th>
                  <th>Description</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data?.results?.length ? (
                  data.results.map((log: any) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{log.user_name || "System"}</td>
                      <td>{log.action}</td>
                      <td>{log.object_type}</td>
                      <td>{log.object_id}</td>
                      <td className="max-w-xs truncate">{log.description}</td>
                      <td className="text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.count > (data?.results?.length || 0) && (
            <div className="flex justify-between mt-4">
              <button
                disabled={!data.previous}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary"
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                disabled={!data.next}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
