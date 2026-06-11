import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { membersApi, savingsApi } from "@/api/services";
import { PageHeader } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import type { MemberProfile, Role } from "@/types";
import api from "@/api/client";

function formatNaira(value: string | number) {
  const n = Number(value);
  return Number.isNaN(n)
    ? "₦0.00"
    : `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Responsive InfoRow: on mobile label above value, on desktop side by side
function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex flex-col py-2 border-b border-gray-100 last:border-0 dark:border-gray-700 sm:grid sm:grid-cols-2 sm:gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800 break-all dark:text-gray-200">
        {value || "—"}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {title}
      </h3>
      <div className="card px-4 py-2 dark:bg-gray-800 dark:border-gray-700">
        {children}
      </div>
    </div>
  );
}

// Approve Modal (responsive)
function ApproveModal({
  member,
  onClose,
}: {
  member: MemberProfile;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      approved_by_name: "",
      officer_in_charge: "",
      approval_date: new Date().toISOString().split("T")[0],
      approved_monthly_contribution: member.approved_monthly_contribution,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => membersApi.approve(member.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member", String(member.id)] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members-pending-count"] });
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.error || "Approval failed."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
        <div className="card-header flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold dark:text-white">Approve Membership</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <div className="card-body">
          {error && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
              {error}
            </div>
          )}
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Approving{" "}
            <strong className="dark:text-white">{member.full_name}</strong> (
            {member.file_number}).
          </p>
          <form
            onSubmit={handleSubmit((d) => mutation.mutate(d))}
            className="space-y-4"
          >
            <div>
              <label className="label dark:text-gray-300">
                Approved By (Chairman Name) *
              </label>
              <input
                {...register("approved_by_name", { required: true })}
                className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="label dark:text-gray-300">
                Officer in Charge *
              </label>
              <input
                {...register("officer_in_charge", { required: true })}
                className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="label dark:text-gray-300">
                Approval Date *
              </label>
              <input
                {...register("approval_date", { required: true })}
                type="date"
                className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="label dark:text-gray-300">
                Approved Monthly Contribution (₦) *
              </label>
              <input
                {...register("approved_monthly_contribution", {
                  required: true,
                })}
                type="number"
                step="0.01"
                min="1000"
                className="input dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Minimum ₦1,000
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex-1"
              >
                {isSubmitting ? "Approving..." : "Approve Member"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Change Role Modal (responsive)
function ChangeRoleModal({
  member,
  onClose,
}: {
  member: MemberProfile;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role>(member.role);
  const [error, setError] = useState("");
  const ROLE_LABELS: Record<Role, string> = {
    staff: "Staff — standard member, view own records only",
    committee: "Committee — can review loans, post repayments",
    head_of_school: "Head of School — gives final loan approval",
    admin: "Admin — full system control",
  };
  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/accounts/members/${member.id}/change-role/`, {
        role: selectedRole,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member", String(member.id)] });
      qc.invalidateQueries({ queryKey: ["members"] });
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.error || "Failed to change role."),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
        <div className="card-header flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold dark:text-white">Change Role</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <div className="card-body space-y-4">
          {error && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
              {error}
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Changing role for{" "}
            <strong className="dark:text-white">{member.full_name}</strong> (
            {member.file_number}). Current role:{" "}
            <span className="font-medium capitalize dark:text-gray-200">
              {member.role.replace(/_/g, " ")}
            </span>
          </p>
          <div className="space-y-2">
            {(["staff", "committee", "head_of_school", "admin"] as Role[]).map(
              (role) => (
                <label
                  key={role}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selectedRole === role
                      ? "border-primary-400 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={selectedRole === role}
                    onChange={() => setSelectedRole(role)}
                    className="mt-0.5 accent-primary-600"
                  />
                  <div>
                    <p className="text-sm font-medium capitalize text-gray-900 dark:text-white">
                      {role.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-400">
                      {ROLE_LABELS[role]}
                    </p>
                  </div>
                </label>
              ),
            )}
          </div>
          {selectedRole !== member.role && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:border-warning-800 dark:bg-warning-900/30 dark:text-warning-300">
              ⚠️ This will immediately change what {member.full_name} can access
              in the system.
            </div>
          )}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || selectedRole === member.role}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? "Saving..." : "Confirm Role Change"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page
export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [showApprove, setShowApprove] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "savings">("profile");
  const [isEditingContribution, setIsEditingContribution] = useState(false);
  const [contributionDraft, setContributionDraft] = useState("");
  const [contributionError, setContributionError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const updateContributionMutation = useMutation({
    mutationFn: (amount: string) =>
      membersApi.update(Number(id), { approved_monthly_contribution: amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member", id] });
      qc.invalidateQueries({ queryKey: ["members"] });
      setIsEditingContribution(false);
      setContributionError("");
    },
    onError: () =>
      setContributionError(
        "Unable to update monthly contribution. Please try again.",
      ),
  });

  const {
    data: member,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["member", id],
    queryFn: () => membersApi.get(Number(id)).then((r) => r.data),
    enabled: !!id,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const { data: balance } = useQuery({
    queryKey: ["balance", id],
    queryFn: () => savingsApi.getBalance(Number(id)).then((r) => r.data),
    enabled: !!id && member != null,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const { data: ledger } = useQuery({
    queryKey: ["ledger", id],
    queryFn: () => savingsApi.getLedger(Number(id)).then((r) => r.data),
    enabled: activeTab === "savings" && !!id,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (member) {
      setContributionDraft(
        member.approved_monthly_contribution?.toString() ?? "0",
      );
      setContributionError("");
      setIsEditingContribution(false);
    }
  }, [member]);

  const deactivateMutation = useMutation({
    mutationFn: () => membersApi.deactivate(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member", id] });
      qc.invalidateQueries({ queryKey: ["members"] });
      setShowDeactivate(false);
    },
  });

  const fullWithdrawalMutation = useMutation({
    mutationFn: () => api.post(`/savings/withdraw/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance", id] });
      qc.invalidateQueries({ queryKey: ["member", id] });
      setWithdrawing(false);
    },
    onError: () => {
      alert("Withdrawal failed. Please try again.");
      setWithdrawing(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent dark:border-primary-500" />
      </div>
    );
  }
  if (error || !member) {
    return (
      <div className="card p-6 dark:bg-gray-800 dark:border-gray-700">
        <PageHeader
          title="Member details"
          back={{ to: "/members", label: "Back to Members" }}
        />
        <p className="text-danger-700 dark:text-danger-400">
          {error ? "Unable to load member." : "Member not found."}
        </p>
      </div>
    );
  }

  const STATUS_COLOR: Record<string, string> = {
    active: "badge-success",
    pending: "badge-warning",
    inactive: "badge-gray",
    exited: "badge-danger",
  };
  const ROLE_COLOR: Record<string, string> = {
    admin:
      "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300",
    committee:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
    head_of_school:
      "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    staff: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:max-w-4xl lg:mx-auto">
      <PageHeader
        title={member.full_name}
        subtitle={`${member.file_number} · ${member.staff_id}`}
        back={{ to: "/members", label: "Back to Members" }}
      />

      {/* Member header card */}
      <div className="card mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="card-body">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              {member.full_name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {member.full_name}
                </h1>
                <span className={STATUS_COLOR[member.membership_status]}>
                  {member.membership_status.charAt(0).toUpperCase() +
                    member.membership_status.slice(1)}
                </span>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_COLOR[member.role]}`}
                >
                  {member.role.replace(/_/g, " ")}
                </span>
                {member.is_new_member && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    New
                  </span>
                )}
                {member.is_legacy && (
                  <span className="badge-gray text-xs dark:bg-gray-700 dark:text-gray-300">
                    Legacy
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {member.designation} ·{" "}
                {member.school_branch.charAt(0).toUpperCase() +
                  member.school_branch.slice(1)}{" "}
                Branch
              </p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                {member.membership_status === "pending" && (
                  <button
                    onClick={() => setShowApprove(true)}
                    className="btn-primary text-sm"
                  >
                    ✓ Approve
                  </button>
                )}
                <button
                  onClick={() => setShowChangeRole(true)}
                  className="btn-secondary text-sm"
                >
                  🔑 Change Role
                </button>
                <button
                  onClick={() => {
                    const url = `/api/v1/savings/${member.id}/ledger/export/?format=pdf`;
                    window.open(url, "_blank");
                  }}
                  className="btn-secondary text-sm"
                >
                  📄 Export PDF
                </button>
                {member.membership_status === "active" && (
                  <button
                    onClick={() => setShowDeactivate(true)}
                    className="btn-secondary text-sm text-danger-600 dark:text-danger-400"
                  >
                    Deactivate
                  </button>
                )}
                {(member.membership_status === "exited" ||
                  member.membership_status === "inactive") &&
                  balance &&
                  Number(balance.available_balance) > 0 && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Withdraw ₦${Number(balance.available_balance).toLocaleString()} from ${member.full_name}? This cannot be undone.`,
                          )
                        ) {
                          setWithdrawing(true);
                          fullWithdrawalMutation.mutate();
                        }
                      }}
                      disabled={withdrawing}
                      className="btn-secondary text-sm text-danger-600 dark:text-danger-400"
                    >
                      {withdrawing
                        ? "Withdrawing…"
                        : `💰 Full Withdrawal (${formatNaira(balance.available_balance)})`}
                    </button>
                  )}
              </div>
            )}
          </div>

          {/* Balance stats - 2 columns on mobile, 4 on desktop */}
          {balance && (
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 dark:border-gray-700 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Total Savings
                </p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {formatNaira(balance.total_savings)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Suretyship Locked
                </p>
                <p className="font-bold text-warning-700 dark:text-warning-400">
                  {formatNaira(balance.suretyship_committed)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Available Balance
                </p>
                <p className="font-bold text-primary-700 dark:text-primary-400">
                  {formatNaira(balance.available_balance)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  🔒 Special Savings
                </p>
                <p className="font-bold text-purple-700 dark:text-purple-400">
                  {formatNaira(balance.special_savings || 0)}
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span
              className={
                member.consecutive_savings_months >= 6
                  ? "text-success-700 dark:text-success-400"
                  : "text-warning-700 dark:text-warning-400"
              }
            >
              {member.consecutive_savings_months >= 6 ? "✓" : "✗"}{" "}
              {member.consecutive_savings_months}/6 savings months
            </span>
            <span
              className={
                member.is_loan_eligible
                  ? "text-success-700 dark:text-success-400"
                  : "text-gray-400 dark:text-gray-500"
              }
            >
              {member.is_loan_eligible
                ? "✓ Loan eligible"
                : "✗ Not loan eligible"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {(["profile", "savings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab === "profile" ? "👤 Profile" : "₦ Savings"}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-6">
          {/* Left column */}
          <div>
            <Section title="Personal">
              <InfoRow label="Full Name" value={member.full_name} />
              <InfoRow label="Gender" value={member.gender} />
              <InfoRow label="Marital Status" value={member.marital_status} />
              <InfoRow label="Date of Birth" value={member.date_of_birth} />
              <InfoRow label="Place of Birth" value={member.place_of_birth} />
              <InfoRow label="State of Origin" value={member.state_of_origin} />
              <InfoRow label="LGA" value={member.local_government_area} />
            </Section>
            <Section title="Contact">
              <InfoRow label="Primary Phone" value={member.phone_primary} />
              <InfoRow label="Secondary Phone" value={member.phone_secondary} />
              <InfoRow label="Email" value={member.email_address} />
              <InfoRow label="Residential" value={member.residential_address} />
              <InfoRow
                label="Permanent Home"
                value={member.permanent_home_address}
              />
            </Section>
          </div>

          {/* Right column */}
          <div>
            <Section title="School Details">
              <InfoRow label="Branch" value={member.school_branch} />
              <InfoRow label="Designation" value={member.designation} />
              <InfoRow label="Date Joined" value={member.date_joined_school} />
            </Section>
            <Section title="Financial">
              <InfoRow
                label="Monthly Income"
                value={formatNaira(member.monthly_income)}
              />
              {isAdmin ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-gray-400">
                        Monthly Contribution
                      </p>
                      {!isEditingContribution && (
                        <p className="mt-1 text-lg font-semibold dark:text-white">
                          {formatNaira(member.approved_monthly_contribution)}
                        </p>
                      )}
                    </div>
                    {!isEditingContribution && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm self-start sm:self-auto"
                        onClick={() => setIsEditingContribution(true)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditingContribution && (
                    <div className="mt-4 space-y-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={contributionDraft}
                        onChange={(e) => setContributionDraft(e.target.value)}
                        placeholder="Monthly contribution amount"
                        aria-label="Monthly contribution amount"
                        className="input w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      />
                      {contributionError && (
                        <p className="text-sm text-danger-700 dark:text-danger-400">
                          {contributionError}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setIsEditingContribution(false);
                            setContributionDraft(
                              member.approved_monthly_contribution?.toString() ??
                                "0",
                            );
                            setContributionError("");
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={updateContributionMutation.isPending}
                          onClick={() => {
                            const parsedAmount = Number(contributionDraft);
                            if (
                              Number.isNaN(parsedAmount) ||
                              parsedAmount <= 0
                            ) {
                              setContributionError(
                                "Enter a valid monthly contribution amount.",
                              );
                              return;
                            }
                            updateContributionMutation.mutate(
                              contributionDraft,
                            );
                          }}
                        >
                          {updateContributionMutation.isPending
                            ? "Saving..."
                            : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <InfoRow
                  label="Monthly Contribution"
                  value={formatNaira(member.approved_monthly_contribution)}
                />
              )}
              <InfoRow
                label="Consecutive Months"
                value={`${member.consecutive_savings_months} months`}
              />
            </Section>
            <Section title="Next of Kin">
              <InfoRow label="Name" value={member.next_of_kin_name} />
              <InfoRow
                label="Relationship"
                value={member.next_of_kin_relationship}
              />
              <InfoRow label="Phone" value={member.next_of_kin_phone} />
              <InfoRow label="Address" value={member.next_of_kin_address} />
              <InfoRow
                label="Place of Work"
                value={member.next_of_kin_place_of_work}
              />
            </Section>
            {member.approved_by_name && (
              <Section title="Approval">
                <InfoRow label="Approved By" value={member.approved_by_name} />
                <InfoRow label="Officer" value={member.officer_in_charge} />
                <InfoRow
                  label="Approval Date"
                  value={member.approval_date || undefined}
                />
              </Section>
            )}
          </div>
        </div>
      )}

      {/* Savings Tab with scrollable table */}
      {activeTab === "savings" && (
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="card-header border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Savings Ledger
            </h2>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[768px] sm:min-w-full table-auto border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-sm text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
                  <th className="px-2 py-2 text-left">Islamic Date</th>
                  <th className="px-2 py-2 text-left">Gregorian</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Details</th>
                  <th className="px-2 py-2 text-left">Credit</th>
                  <th className="px-2 py-2 text-left">Debit</th>
                  <th className="px-2 py-2 text-left">Balance</th>
                  <th className="px-2 py-2 text-left">Verified By</th>
                </tr>
              </thead>
              <tbody>
                {!ledger?.results?.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-gray-400 dark:text-gray-500"
                    >
                      No ledger entries yet.
                    </td>
                  </tr>
                ) : (
                  ledger.results.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="px-2 py-2 font-medium whitespace-nowrap dark:text-white">
                        {entry.hijri_display}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-400 whitespace-nowrap dark:text-gray-400">
                        {entry.gregorian_date}
                      </td>
                      <td className="px-2 py-2 text-xs capitalize whitespace-nowrap dark:text-gray-300">
                        {entry.entry_type.replace(/_/g, " ")}
                      </td>
                      <td className="max-w-xs truncate px-2 py-2 text-sm text-gray-600 dark:text-gray-400">
                        {entry.details}
                      </td>
                      <td className="px-2 py-2 font-medium text-success-700 whitespace-nowrap dark:text-success-400">
                        {entry.credit ? formatNaira(entry.credit) : "—"}
                      </td>
                      <td className="px-2 py-2 font-medium text-danger-700 whitespace-nowrap dark:text-danger-400">
                        {entry.debit ? formatNaira(entry.debit) : "—"}
                      </td>
                      <td className="px-2 py-2 font-bold whitespace-nowrap dark:text-white">
                        {formatNaira(entry.balance)}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-400 whitespace-nowrap dark:text-gray-400">
                        {entry.verified_by_name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showApprove && (
        <ApproveModal member={member} onClose={() => setShowApprove(false)} />
      )}
      {showChangeRole && (
        <ChangeRoleModal
          member={member}
          onClose={() => setShowChangeRole(false)}
        />
      )}
      {showDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm dark:bg-gray-800 dark:border-gray-700">
            <div className="card-body">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Deactivate Member
              </h3>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                This will deactivate{" "}
                <strong className="dark:text-white">{member.full_name}</strong>
                's account. Their records are preserved.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setShowDeactivate(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deactivateMutation.mutate()}
                  disabled={deactivateMutation.isPending}
                  className="btn-danger flex-1"
                >
                  {deactivateMutation.isPending
                    ? "Deactivating..."
                    : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
