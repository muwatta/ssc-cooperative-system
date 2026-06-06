import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { membersApi } from "@/api/services";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";
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

  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

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

  const toggleSpecialMutation = useMutation({
    mutationFn: (memberId: number) =>
      api.post(`/accounts/toggle-special/${memberId}/`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
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
      </div>

      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          ✅ {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
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
            aria-label="Search members"
            className="input w-64 pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Status:
          </label>
          <select
            id="status-filter"
            className="input w-32"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="exited">Exited</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="branch-filter"
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Branch:
          </label>
          <select
            id="branch-filter"
            className="input w-36"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">All Branches</option>
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
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50">
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
                  {isAdmin && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-600">
                      Special
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data?.results?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 11 : 10}
                      className="py-16 text-center text-gray-400"
                    >
                      <p className="text-4xl">👥</p>
                      <p className="mt-2">No members found.</p>
                      {!hasFilters && (
                        <Link
                          to="/members/add"
                          className="mt-2 inline-block text-sm text-primary-600 hover:underline"
                        >
                          Add the first member →
                        </Link>
                      )}
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
                        {member.is_new_member && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                            New
                          </span>
                        )}
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
                      <td className="px-4 py-3 text-sm text-gray-600">
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
                          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[member.membership_status] ?? "bg-gray-100 text-gray-600"}`}
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
                      {isAdmin && (
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleSpecialMutation.mutate(member.id);
                            }}
                            disabled={toggleSpecialMutation.isPending}
                            className={`text-lg leading-none transition-colors ${
                              member.is_special_saver
                                ? "text-purple-600 hover:text-purple-800"
                                : "text-gray-300 hover:text-gray-500"
                            }`}
                            title={
                              member.is_special_saver
                                ? "Remove special saver"
                                : "Mark as special saver"
                            }
                          >
                            🔒
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="space-y-3 md:hidden">
            {data?.results?.map((member) => (
              <div
                key={member.id}
                className="relative rounded-lg border border-gray-200 bg-white p-4"
              >
                <Link
                  to={`/members/${member.id}`}
                  className="block active:bg-gray-50"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">
                          {member.full_name}
                        </h3>
                        {member.is_new_member && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                            New
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-sm text-gray-500">
                        {member.file_number}
                      </p>
                    </div>
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_BADGE[member.membership_status] ?? ""}`}
                    >
                      {member.membership_status}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>
                      <span className="font-semibold text-gray-700">
                        Staff ID:
                      </span>{" "}
                      {member.staff_id}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">
                        Branch:
                      </span>{" "}
                      <span className="capitalize">{member.school_branch}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">
                        Designation:
                      </span>{" "}
                      {member.designation}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Role:</span>{" "}
                      <span className="capitalize">
                        {member.role?.replace(/_/g, " ") || "staff"}
                      </span>
                    </div>
                  </div>
                </Link>
                {/* Toggle button outside the Link to avoid navigation */}
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSpecialMutation.mutate(member.id);
                    }}
                    disabled={toggleSpecialMutation.isPending}
                    className={`absolute top-3 right-3 text-lg leading-none transition-colors ${
                      member.is_special_saver
                        ? "text-purple-600 hover:text-purple-800"
                        : "text-gray-300 hover:text-gray-500"
                    }`}
                    title={
                      member.is_special_saver
                        ? "Remove special saver"
                        : "Mark as special saver"
                    }
                  >
                    🔒
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
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
