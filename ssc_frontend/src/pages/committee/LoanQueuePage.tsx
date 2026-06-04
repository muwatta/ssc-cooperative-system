import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
import { useAuth } from "@/context/AuthContext";
import { HIJRI_MONTHS } from "@/types";
import type { LoanApplication, PaginatedResponse } from "@/types";

// ---------- Helper: compute end date from start + duration ----------
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

// ---------- Summary Cards ----------
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
      color: "bg-blue-50 text-blue-800",
    },
    {
      label: "Active",
      value: activeLoans.length,
      color: "bg-emerald-50 text-emerald-800",
    },
    {
      label: "Pending Approval",
      value: pendingApproval.length,
      color: "bg-amber-50 text-amber-800",
    },
    {
      label: "Disbursed",
      value: formatNaira(totalDisbursed),
      color: "bg-purple-50 text-purple-800",
    },
    {
      label: "Outstanding",
      value: formatNaira(totalOutstanding),
      color: "bg-rose-50 text-rose-800",
    },
  ];

  if (isLoading) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl p-4 shadow-sm ${card.color} border`}
        >
          <p className="text-xs font-medium opacity-75">{card.label}</p>
          <p className="text-2xl font-bold mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Committee Decision Modal (unchanged, just imported) ----------
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
      <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Applicant</span>
          <span className="font-medium">
            {loan.applicant_file_number} — {loan.applicant_name}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Amount Applied</span>
          <span className="font-bold text-primary-700">
            {formatNaira(loan.amount_applied)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Duration</span>
          <span>{loan.proposed_duration_months} months</span>
        </div>
        <div>
          <span className="text-gray-500">Purpose: </span>
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

// ---------- Admin Final Approval Modal (unchanged) ----------
function AdminFinalApprovalModal({
  loan,
  onClose,
}: {
  loan: LoanApplication;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
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
      <div className="bg-gray-50 rounded-lg p-4 text-sm">
        <p className="font-medium">Loan #{loan.id}</p>
        <p>
          {loan.applicant_file_number} — {loan.applicant_name}
        </p>
        <p className="text-primary-700 font-bold mt-1">
          {formatNaira(loan.amount_approved || loan.amount_applied)}
        </p>
        <p className="text-gray-500 mt-1">{loan.committee_decision_note}</p>
      </div>
      <p className="text-sm text-gray-600">
        Final approval activates the loan and deducts from savings.
      </p>
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

// ---------- Status Badge (replaces LoanStatusBadge for clarity) ----------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    submitted: { color: "bg-purple-100 text-purple-800", label: "Submitted" },
    under_review: {
      color: "bg-purple-100 text-purple-800",
      label: "Under Review",
    },
    pending_sureties: {
      color: "bg-amber-100 text-amber-800",
      label: "Sureties Pending",
    },
    approved: {
      color: "bg-indigo-100 text-indigo-800",
      label: "Committee Approved",
    },
    pending_admin: {
      color: "bg-indigo-100 text-indigo-800",
      label: "Admin Pending",
    },
    active: { color: "bg-emerald-100 text-emerald-800", label: "Active" },
    completed: { color: "bg-blue-100 text-blue-800", label: "Completed" },
    rejected: { color: "bg-rose-100 text-rose-800", label: "Rejected" },
    defaulted: { color: "bg-red-100 text-red-800", label: "Defaulted" },
  };
  const style = map[status] || {
    color: "bg-gray-100 text-gray-800",
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

// ---------- Main Page ----------
export default function LoanQueuePage() {
  const { isAdmin } = useAuth();
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(
    null,
  );
  const [modalType, setModalType] = useState<
    "committee" | "admin" | "repayment" | null
  >(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<PaginatedResponse<LoanApplication>>({
    queryKey: ["loans-queue", activeFilter],
    queryFn: async () => {
      const status = activeFilter === "all" ? undefined : activeFilter;
      const res = await loansApi.list({ status });
      if (res.data.results) {
        res.data.results.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }
      return res.data;
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  const loans = data?.results ?? [];

  // Define filter tabs
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

      {/* Summary Cards */}
      <SummaryCards loans={loans} isLoading={isLoading} />

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeFilter === tab.key
                ? "bg-primary-600 text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loan Cards */}
      {isLoading ? (
        <PageLoader />
      ) : loans.length === 0 ? (
        <EmptyState icon="📑" title="No loans found" />
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-semibold text-primary-600">
                      #{loan.id}
                    </span>
                    <StatusBadge status={loan.status} />
                    {loan.status === "active" && (
                      <span className="text-xs text-amber-600 font-medium">
                        {formatNaira(loan.outstanding_balance)} left
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Applicant:</span>{" "}
                      <span className="font-medium">{loan.applicant_name}</span>
                      <span className="text-gray-400 ml-1">
                        ({loan.applicant_file_number})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Amount:</span>{" "}
                      <span className="font-bold text-primary-700">
                        {formatNaira(loan.amount_applied)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>{" "}
                      {loan.proposed_duration_months} mo.
                    </div>
                    <div>
                      <span className="text-gray-500">Ends:</span>{" "}
                      {computeEndDate(loan)}
                    </div>
                    <div className="col-span-2 md:col-span-4 mt-1">
                      <span className="text-gray-500">Purpose:</span>{" "}
                      {loan.purpose}
                    </div>
                  </div>
                  {/* Approval chain */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span
                      className={
                        [
                          "approved",
                          "pending_admin",
                          "active",
                          "completed",
                        ].includes(loan.status)
                          ? "text-green-600 font-semibold"
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
                          ? "text-green-600 font-semibold"
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
                        <span className="text-green-600 font-semibold">
                          Settled ✓
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
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
                  {/* View Details link always available */}
                  <button
                    onClick={() => window.open(`/loans/${loan.id}`, "_blank")}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals (unchanged, just kept as is) */}
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
    </div>
  );
}
