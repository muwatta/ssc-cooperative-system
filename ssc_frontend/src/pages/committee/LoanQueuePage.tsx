import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { loansApi } from "@/api/services";
import {
  PageHeader,
  PageLoader,
  EmptyState,
  formatNaira,
  Modal,
  ErrorAlert,
} from "@/components/common";
import RepaymentModal from "@/components/loans/RepaymentModal";
import LoanDefaultModal from "@/components/loans/LoanDefaultModal";
import { useAuth } from "@/context/AuthContext";
import { HIJRI_MONTHS } from "@/types";
import type { LoanApplication, PaginatedResponse } from "@/types";

function computeEndDate(loan: LoanApplication) {
  if (!loan.repayment_start_hijri_month || !loan.repayment_start_hijri_year)
    return "TBD";
  let endMonth =
    loan.repayment_start_hijri_month + loan.proposed_duration_months;
  let endYear = loan.repayment_start_hijri_year;
  while (endMonth > 12) {
    endMonth -= 12;
    endYear += 1;
  }
  const label =
    HIJRI_MONTHS.find((m) => m.value === endMonth)?.label ?? endMonth;
  return `${label} ${endYear}`;
}

function SummaryCards({
  loans,
  isLoading,
}: {
  loans: LoanApplication[];
  isLoading: boolean;
}) {
  const activeLoans = loans.filter((l) => l.status === "active");
  const pendingApproval = loans.filter((l) =>
    ["submitted", "under_review", "pending_sureties", "pending_admin"].includes(
      l.status,
    ),
  );

  const totalOutstanding = activeLoans.reduce(
    (sum, l) => sum + parseFloat(l.outstanding_balance || "0"),
    0,
  );
  const totalDisbursed = activeLoans.reduce(
    (sum, l) => sum + parseFloat(l.amount_approved || l.amount_applied || "0"),
    0,
  );

  const cards = [
    {
      label: "Total Loans",
      value: loans.length,
      accent: "primary",
    },
    {
      label: "Active",
      value: activeLoans.length,
      accent: "primary",
    },
    {
      label: "Pending Approval",
      value: pendingApproval.length,
      accent: "primary",
    },
    {
      label: "Disbursed",
      value: formatNaira(totalDisbursed),
      accent: "purple",
    },
    {
      label: "Outstanding",
      value: formatNaira(totalOutstanding),
      accent: "purple",
    },
  ];

  const colorMap: Record<string, string> = {
    primary:
      "bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300",
    success:
      "bg-success-50 text-success-800 dark:bg-success-900/30 dark:text-success-300",
    warning:
      "bg-warning-50 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300",
    purple:
      "bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    danger:
      "bg-danger-50 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300",
  };

  if (isLoading) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl p-4 shadow-sm border ${colorMap[card.accent]}`}
        >
          <p className="text-xs font-medium opacity-75">{card.label}</p>
          <p className="text-2xl font-bold mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function CommitteeDecisionModal({
  loan,
  onClose,
}: {
  loan: LoanApplication;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      decision: "approve",
      amount_approved: loan.amount_applied,
      note: "",
    },
  });
  const decision = watch("decision");

  const mutation = useMutation({
    mutationFn: (data: any) => loansApi.committeeDecision(loan.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans-queue"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || "Action failed."),
  });

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Applicant</span>
          <span className="font-medium dark:text-white">
            {loan.applicant_file_number} — {loan.applicant_name}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Amount Applied
          </span>
          <span className="font-bold text-primary-700 dark:text-primary-400">
            {formatNaira(loan.amount_applied)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Duration</span>
          <span>{loan.proposed_duration_months} months</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Purpose: </span>
          {loan.purpose}
        </div>
      </div>
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4"
      >
        <div>
          <label className="label">Decision</label>
          <select {...register("decision")} className="input">
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </select>
        </div>
        {decision === "approve" && (
          <div>
            <label className="label">Amount Approved (₦)</label>
            <input
              {...register("amount_approved", { required: true })}
              type="number"
              step="0.01"
              className="input"
            />
          </div>
        )}
        <div>
          <label className="label">Note (optional)</label>
          <textarea
            {...register("note")}
            className="input h-16"
            placeholder="Add a note..."
          />
        </div>
        <div className="flex gap-3">
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
            className={`flex-1 ${decision === "approve" ? "btn-primary" : "btn-danger"}`}
          >
            {isSubmitting
              ? "Processing..."
              : decision === "approve"
                ? "Approve Loan"
                : "Reject Loan"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Admin Final Approval Modal
function AdminFinalApprovalModal({
  loan,
  onClose,
}: {
  loan: LoanApplication;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const approvedAmount = parseFloat(
    loan.amount_approved || loan.amount_applied || "0",
  );
  const selfSuretyAmount = (approvedAmount * 0.75).toFixed(2);

  const mutation = useMutation({
    mutationFn: () => loansApi.adminApprove(loan.id, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans-queue"] });
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.error || "Approval failed."),
  });

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm space-y-1">
        <p className="font-semibold text-gray-800 dark:text-white">
          Loan #{loan.id} — {loan.applicant_file_number} {loan.applicant_name}
        </p>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Amount Approved
          </span>
          <span className="font-bold text-primary-700 dark:text-primary-400">
            {formatNaira(approvedAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Duration</span>
          <span>{loan.proposed_duration_months} months</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Purpose</span>
          <span>{loan.purpose}</span>
        </div>
        {loan.committee_decision_note && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">
              Committee Note
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              {loan.committee_decision_note}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-primary-100 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 p-4 text-sm space-y-2">
        <p className="font-semibold text-primary-800 dark:text-primary-200">
          What happens on approval:
        </p>
        <div className="flex justify-between text-primary-700 dark:text-primary-300">
          <span>🔒 Self-surety locked (75%)</span>
          <span className="font-bold">{formatNaira(selfSuretyAmount)}</span>
        </div>
        <div className="flex justify-between text-primary-700 dark:text-primary-300">
          <span>🏦 Loan disbursed from cooperative fund</span>
          <span className="font-bold">{formatNaira(approvedAmount)}</span>
        </div>
        <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
          The self-surety amount is locked from the member's available balance.
          The loan itself is paid out from the cooperative's funds.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn-primary flex-1"
        >
          {mutation.isPending ? "Submitting..." : "Give Final Approval"}
        </button>
      </div>
    </div>
  );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    submitted: {
      color:
        "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300",
      label: "Submitted",
    },
    under_review: {
      color:
        "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300",
      label: "Under Review",
    },
    pending_sureties: {
      color:
        "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300",
      label: "Sureties Pending",
    },
    approved: {
      color:
        "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300",
      label: "Committee Approved",
    },
    pending_admin: {
      color:
        "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300",
      label: "Admin Pending",
    },
    active: {
      color:
        "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300",
      label: "Active",
    },
    completed: {
      color: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300",
      label: "Completed",
    },
    rejected: {
      color: "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300",
      label: "Rejected",
    },
    defaulted: {
      color: "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300",
      label: "Defaulted",
    },
  };
  const style = map[status] || {
    color: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300",
    label: status,
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.color}`}
    >
      {style.label}
    </span>
  );
}

// Main Page
export default function LoanQueuePage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(
    null,
  );
  const [modalType, setModalType] = useState<
    "committee" | "admin" | "repayment" | "default" | null
  >(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<PaginatedResponse<LoanApplication>>({
    queryKey: ["loans-queue", activeFilter],
    queryFn: async () => {
      const status = activeFilter === "all" ? undefined : activeFilter;
      const res = await loansApi.list({ status });
      return res.data;
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  const loans = data?.results ?? [];

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "pending_admin", label: "Admin Pending" },
    { key: "approved", label: "Committee Approved" },
    { key: "submitted", label: "Submitted" },
    { key: "completed", label: "Completed" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div>
      <PageHeader
        title="Loan Queue"
        subtitle="Review and process loan applications"
      />

      <SummaryCards loans={loans} isLoading={isLoading} />

      <div className="flex flex-wrap gap-2 mb-6">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeFilter === tab.key
                ? "bg-primary-600 text-white shadow-md dark:bg-primary-500"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : loans.length === 0 ? (
        <EmptyState icon="📑" title="No loans found" />
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="card-panel p-5 transition hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
                      #{loan.id}
                    </span>
                    <StatusBadge status={loan.status} />
                    {loan.status === "active" && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {formatNaira(loan.outstanding_balance)} left
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Applicant:
                      </span>{" "}
                      <span className="font-medium dark:text-white">
                        {loan.applicant_name}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 ml-1">
                        ({loan.applicant_file_number})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Amount:
                      </span>{" "}
                      <span className="font-bold text-primary-700 dark:text-primary-400">
                        {formatNaira(loan.amount_applied)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Duration:
                      </span>{" "}
                      {loan.proposed_duration_months} mo.
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Ends:
                      </span>{" "}
                      {computeEndDate(loan)}
                    </div>
                    <div className="col-span-2 md:col-span-4 mt-1">
                      <span className="text-gray-500 dark:text-gray-400">
                        Purpose:
                      </span>{" "}
                      {loan.purpose}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span
                      className={
                        [
                          "approved",
                          "pending_admin",
                          "active",
                          "completed",
                        ].includes(loan.status)
                          ? "text-green-600 dark:text-green-400 font-semibold"
                          : ""
                      }
                    >
                      Committee{" "}
                      {[
                        "approved",
                        "pending_admin",
                        "active",
                        "completed",
                      ].includes(loan.status)
                        ? "✓"
                        : "○"}
                    </span>
                    <span>→</span>
                    <span
                      className={
                        ["active", "completed"].includes(loan.status)
                          ? "text-green-600 dark:text-green-400 font-semibold"
                          : ""
                      }
                    >
                      Admin{" "}
                      {["active", "completed"].includes(loan.status)
                        ? "✓"
                        : "○"}
                    </span>
                    {loan.status === "completed" && (
                      <>
                        <span>→</span>
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                          Settled ✓
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                  {["submitted", "under_review", "pending_sureties"].includes(
                    loan.status,
                  ) && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setModalType("committee");
                      }}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Review
                    </button>
                  )}
                  {isAdmin && loan.status === "pending_admin" && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setModalType("admin");
                      }}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      Admin Final Approval
                    </button>
                  )}
                  {loan.status === "active" && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setModalType("repayment");
                      }}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      Post Repayment
                    </button>
                  )}
                  {isAdmin && loan.status === "active" && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setModalType("default");
                      }}
                      className="btn-danger text-xs px-3 py-1.5"
                    >
                      Mark Defaulted
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/loans/${loan.id}`)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedLoan && modalType === "committee"}
        title="Committee Decision"
        onClose={() => {
          setSelectedLoan(null);
          setModalType(null);
        }}
      >
        {selectedLoan && (
          <CommitteeDecisionModal
            loan={selectedLoan}
            onClose={() => {
              setSelectedLoan(null);
              setModalType(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!selectedLoan && modalType === "admin"}
        title="Admin Final Approval"
        onClose={() => {
          setSelectedLoan(null);
          setModalType(null);
        }}
      >
        {selectedLoan && (
          <AdminFinalApprovalModal
            loan={selectedLoan}
            onClose={() => {
              setSelectedLoan(null);
              setModalType(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!selectedLoan && modalType === "repayment"}
        title="Post Loan Repayment"
        onClose={() => {
          setSelectedLoan(null);
          setModalType(null);
        }}
      >
        {selectedLoan && (
          <RepaymentModal
            loanId={selectedLoan.id}
            outstanding={selectedLoan.outstanding_balance}
            monthlyRepayment={selectedLoan.proposed_monthly_repayment}
            defaultMonth={selectedLoan.repayment_start_hijri_month || 1}
            defaultYear={
              selectedLoan.repayment_start_hijri_year ||
              new Date().getFullYear()
            }
            onClose={() => {
              setSelectedLoan(null);
              setModalType(null);
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!selectedLoan && modalType === "default"}
        title="Mark Loan as Defaulted"
        onClose={() => {
          setSelectedLoan(null);
          setModalType(null);
        }}
      >
        {selectedLoan && (
          <LoanDefaultModal
            loan={selectedLoan}
            onClose={() => {
              setSelectedLoan(null);
              setModalType(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
