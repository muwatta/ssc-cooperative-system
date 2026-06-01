import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { membersApi } from "@/api/services";
import Skeleton from "@/components/common/Skeleton";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-success-100 text-success-700",
  pending: "bg-yellow-100 text-yellow-700",
  inactive: "bg-gray-100 text-gray-600",
  exited: "bg-red-100 text-red-700",
};

export default function MembersListPage() {
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const successMsg = (location.state as { success?: string })?.success;

  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const loadStartRef = useRef<number>(Date.now());

  const { data, isLoading, error } = useQuery({
    queryKey: ["members", page, search, statusFilter, branchFilter],
    queryFn: () =>
      membersApi
        .list({
          page,
          search: search || undefined,
          membership_status: statusFilter || undefined,
          school_branch: branchFilter || undefined,
        })
        .then((r) => r.data),
  });

  const { data: pendingData, isLoading: isLoadingPending } = useQuery({
    queryKey: ["members-pending-count"],
    queryFn: () =>
      membersApi.list({ membership_status: "pending" }).then((r) => r.data),
  });
  const pendingCount = pendingData?.count ?? 0;

  useEffect(() => {
    let timeout: number | undefined;
    if (isLoading) {
      loadStartRef.current = Date.now();
      setSkeletonVisible(true);
      return () => clearTimeout(timeout);
    }
    const elapsed = Date.now() - loadStartRef.current;
    if (elapsed >= 2000) {
      setSkeletonVisible(false);
    } else {
      timeout = window.setTimeout(
        () => setSkeletonVisible(false),
        2000 - elapsed,
      );
    }
    return () => clearTimeout(timeout);
  }, [isLoading]);

  const totalPages = Math.ceil((data?.count ?? 0) / 50);
  const hasFilters = !!(search || statusFilter || branchFilter);

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            All Members
            {pendingCount > 0 && !isLoadingPending && (
              <span className="ml-3 inline-block rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {data?.count ?? 0} total members
          </p>
        </div>
        {/* Add Member button is removed – use Create User instead */}
      </div>

      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          ✅ {successMsg}
        </div>
      )}

      {/* Filters – stack on mobile, inline on larger screens */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or file number..."
            className="input w-full pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-sm font-medium text-gray-700"
          >
            Status:
          </label>
          <select
            id="status-filter"
            className="input w-32"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="exited">Exited</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="branch-filter"
            className="text-sm font-medium text-gray-700"
          >
            Branch:
          </label>
          <select
            id="branch-filter"
            className="input w-36"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="primary">Primary</option>
            <option value="college">College</option>
            <option value="other">Other</option>
          </select>
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setBranchFilter("");
              setPage(1);
            }}
            className="btn-ghost text-sm text-gray-400"
          >
            Clear ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          Unable to load members. Please refresh.
        </div>
      )}

      {skeletonVisible && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <Skeleton rows={2} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "File #",
                    "Name",
                    "Staff ID",
                    "Branch",
                    "Designation",
                    "Role",
                    "Contribution",
                    "Savings Months",
                    "Status",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase text-gray-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data?.results?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-16 text-center text-gray-400"
                    >
                      No members found
                    </td>
                  </tr>
                ) : (
                  data?.results?.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <span className="font-mono font-semibold text-primary-700">
                          {member.file_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {member.full_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {member.staff_id}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-600">
                        {member.school_branch}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {member.designation}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-600">
                        {member.role?.replace(/_/g, " ") || "staff"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        ₦
                        {Number(
                          member.approved_monthly_contribution,
                        ).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={
                            member.consecutive_savings_months >= 6
                              ? "text-success-700 font-medium"
                              : "text-warning-700 font-medium"
                          }
                        >
                          {member.consecutive_savings_months}/6
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[member.membership_status]}`}
                        >
                          {member.membership_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          to={`/members/${member.id}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view (enhanced) */}
          <div className="md:hidden space-y-3">
            {data?.results?.map((member) => (
              <Link
                key={member.id}
                to={`/members/${member.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {member.full_name}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono">
                      {member.file_number}
                    </p>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_BADGE[member.membership_status]}`}
                  >
                    {member.membership_status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-500">Staff ID:</span>{" "}
                    {member.staff_id}
                  </div>
                  <div>
                    <span className="text-gray-500">Branch:</span>{" "}
                    <span className="capitalize">{member.school_branch}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Role:</span>{" "}
                    {member.role?.replace(/_/g, " ") || "staff"}
                  </div>
                  <div>
                    <span className="text-gray-500">Savings Months:</span>{" "}
                    <span
                      className={
                        member.consecutive_savings_months >= 6
                          ? "text-success-700 font-medium"
                          : ""
                      }
                    >
                      {member.consecutive_savings_months}/6
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Contribution:</span> ₦
                    {Number(
                      member.approved_monthly_contribution,
                    ).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-gray-500">
              <span>
                Showing {Math.min((page - 1) * 50 + 1, data?.count ?? 0)}–
                {Math.min(page * 50, data?.count ?? 0)} of {data?.count ?? 0}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
