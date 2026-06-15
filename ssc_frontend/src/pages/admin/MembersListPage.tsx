import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { membersApi } from "@/api/services";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";
import Skeleton from "@/components/common/Skeleton";

const STATUS_BADGE: Record<string, string> = {
  active:
    "bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-300",
  pending:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  exited: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
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
    <div className="space-y-3 p-3 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white md:text-xl">
            All Members
            {pendingCount > 0 && !isLoadingPending && (
              <span className="ml-2 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            {data?.count ?? 0} total members
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-success-50 px-3 py-2 text-xs text-success-700 dark:border-green-800/50 dark:bg-success-900/30 dark:text-success-300">
          ✅ {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or file..."
            aria-label="Search members"
            className="input h-8 w-48 pl-7 text-xs dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-1">
          <label
            htmlFor="status-filter"
            className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
          >
            Status:
          </label>
          <select
            id="status-filter"
            className="input h-8 w-28 text-xs dark:bg-gray-900 dark:border-gray-700 dark:text-white"
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

        <div className="flex items-center gap-1">
          <label
            htmlFor="branch-filter"
            className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
          >
            Branch:
          </label>
          <select
            id="branch-filter"
            className="input h-8 w-32 text-xs dark:bg-gray-900 dark:border-gray-700 dark:text-white"
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
            className="btn-ghost text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Clear ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-2 text-xs text-danger-700 dark:border-danger-800/50 dark:bg-danger-900/30 dark:text-danger-300">
          Unable to load members. Please refresh.
        </div>
      )}

      {skeletonVisible && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
            >
              <Skeleton rows={2} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 md:block">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
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
                      className="px-3 py-2 font-semibold uppercase text-gray-600 dark:text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                  {isAdmin && (
                    <th className="px-3 py-2 font-semibold uppercase text-gray-600 dark:text-gray-400">
                      Special
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data?.results?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 11 : 10}
                      className="py-12 text-center text-gray-400 dark:text-gray-500"
                    >
                      <p className="text-2xl">👥</p>
                      <p className="mt-1 text-xs">No members found.</p>
                      {!hasFilters && (
                        <Link
                          to="/members/add"
                          className="mt-1 inline-block text-xs text-primary-600 hover:underline dark:text-primary-400"
                        >
                          Add the first member →
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  data?.results?.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono font-semibold text-primary-700 dark:text-primary-400">
                          {member.file_number}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {member.full_name}
                        {member.is_new_member && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                            New
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                        {member.staff_id}
                      </td>
                      <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-400">
                        {member.school_branch}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                        {member.designation}
                      </td>
                      <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-400">
                        {member.role?.replace(/_/g, " ") || "staff"}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                        ₦
                        {Number(
                          member.approved_monthly_contribution,
                        ).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            member.consecutive_savings_months >= 6
                              ? "text-success-700 font-medium dark:text-success-400"
                              : "text-warning-700 font-medium dark:text-warning-400"
                          }
                        >
                          {member.consecutive_savings_months}/6
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[member.membership_status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                        >
                          {member.membership_status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/members/${member.id}`}
                          className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                        >
                          View →
                        </Link>
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleSpecialMutation.mutate(member.id);
                            }}
                            disabled={toggleSpecialMutation.isPending}
                            className={`text-base leading-none transition-colors ${
                              member.is_special_saver
                                ? "text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                                : "text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                            }`}
                            title={
                              member.is_special_saver
                                ? "Remove special saver"
                                : "Mark as special saver"
                            }
                          >
                            {member.is_special_saver ? "🔐" : "🔒"}
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
          <div className="space-y-2 md:hidden">
            {data?.results?.map((member) => (
              <div
                key={member.id}
                className="relative rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
              >
                <Link
                  to={`/members/${member.id}`}
                  className="block active:bg-gray-50 dark:active:bg-gray-700/50"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          {member.full_name}
                        </h3>
                        {member.is_new_member && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                            New
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {member.file_number}
                      </p>
                    </div>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[member.membership_status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                    >
                      {member.membership_status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Staff ID:
                      </span>{" "}
                      {member.staff_id}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Branch:
                      </span>{" "}
                      <span className="capitalize">{member.school_branch}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Designation:
                      </span>{" "}
                      {member.designation}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Role:
                      </span>{" "}
                      <span className="capitalize">
                        {member.role?.replace(/_/g, " ") || "staff"}
                      </span>
                    </div>
                  </div>
                </Link>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSpecialMutation.mutate(member.id);
                    }}
                    disabled={toggleSpecialMutation.isPending}
                    className={`absolute top-2 right-2 text-base leading-none transition-colors ${
                      member.is_special_saver
                        ? "text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                        : "text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                    }`}
                    title={
                      member.is_special_saver
                        ? "Remove special saver"
                        : "Mark as special saver"
                    }
                  >
                    {member.is_special_saver ? "🔐" : "🔒"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {Math.min((page - 1) * 50 + 1, data?.count ?? 0)}–
                {Math.min(page * 50, data?.count ?? 0)} of {data?.count ?? 0}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-2 py-0.5 text-xs disabled:opacity-40 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  ← Prev
                </button>
                <span className="px-2 py-0.5">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary px-2 py-0.5 text-xs disabled:opacity-40 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
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
