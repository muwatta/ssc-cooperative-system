import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savingsApi } from "@/api/services";
import {
  PageHeader,
  PageLoader,
  EmptyState,
  formatNaira,
} from "@/components/common";
import { HIJRI_MONTHS } from "@/types";
import type { SavingsChangeRequest } from "@/types";
import { useAuth } from "@/context/AuthContext";

function ApproveModal({
  request,
  onClose,
  onSuccess,
}: {
  request: SavingsChangeRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      savingsApi.changeRequests.approve(request.id, {
        effective_hijri_month: month,
        effective_hijri_year: year,
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.error || "Approval failed."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold">Approve Savings Change</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="card-body space-y-4">
          {error && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}
          <p className="text-sm text-gray-600">
            Approving <strong>{request.member_name}</strong> (
            {request.member_file_number})
            <br />
            Current: <strong>{formatNaira(request.current_amount)}</strong> →
            New: <strong>{formatNaira(request.requested_amount)}</strong>
          </p>
          <div>
            <label htmlFor="effective-month" className="label">
              Effective Hijri Month
            </label>
            <select
              id="effective-month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="input"
              aria-label="Effective Hijri month"
              title="Effective Hijri month"
            >
              {HIJRI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="effective-year" className="label">
              Effective Hijri Year
            </label>
            <input
              id="effective-year"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input"
              aria-label="Effective Hijri year"
              title="Effective Hijri year"
              placeholder="e.g., 1446"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? "Approving..." : "Confirm Approval"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SavingsChangeRequestsPage() {
  const qc = useQueryClient();
  const { user } = useAuth(); // current logged‑in user
  const [selectedRequest, setSelectedRequest] =
    useState<SavingsChangeRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data, isLoading, error } = useQuery({
    queryKey: ["savings-change-requests", statusFilter],
    queryFn: () =>
      savingsApi.changeRequests
        .list({ status: statusFilter })
        .then((r) => r.data),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => savingsApi.changeRequests.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings-change-requests"] });
    },
  });

  if (isLoading) return <PageLoader />;
  if (error) return <EmptyState icon="⚠️" title="Failed to load requests" />;

  const requests = data?.results || [];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Savings Change Requests"
        subtitle="Review and approve member requests to increase or decrease monthly contributions"
      />

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {["pending", "approved", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-6 py-2 text-sm font-medium transition-all ${
              statusFilter === status
                ? "border-b-2 border-primary-600 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === "pending" && requests.length > 0 && (
              <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs">
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState icon="📋" title="No change requests" />
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isOwnRequest = req.member_user_id === user?.user_id;
            return (
              <div key={req.id} className="card p-4">
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-gray-900">
                        {req.member_name}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {req.member_file_number}
                      </p>
                      {req.status === "pending" && (
                        <span className="badge-warning text-xs">Pending</span>
                      )}
                      {req.status === "approved" && (
                        <span className="badge-success text-xs">Approved</span>
                      )}
                      {req.status === "rejected" && (
                        <span className="badge-danger text-xs">Rejected</span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Current amount:</span>{" "}
                        <span className="font-medium">
                          {formatNaira(req.current_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Requested amount:</span>{" "}
                        <span className="font-medium text-primary-700">
                          {formatNaira(req.requested_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Submitted:</span>{" "}
                        {new Date(req.submitted_at).toLocaleDateString()}
                      </div>
                      {req.effective_hijri_display && (
                        <div>
                          <span className="text-gray-500">Effective from:</span>{" "}
                          {req.effective_hijri_display}
                        </div>
                      )}
                    </div>
                    {req.status === "pending" && (
                      <div className="mt-3 flex gap-2">
                        {isOwnRequest ? (
                          <span className="text-xs text-gray-400 italic">
                            You cannot approve your own request
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="btn-primary btn-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Reject this request?"))
                                  rejectMutation.mutate(req.id);
                              }}
                              className="btn-danger btn-sm"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedRequest && (
        <ApproveModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["savings-change-requests"] });
          }}
        />
      )}
    </div>
  );
}
