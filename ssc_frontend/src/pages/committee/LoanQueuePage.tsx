import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { loansApi } from "@/api/services";
import {
  PageHeader,
  LoanStatusBadge,
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
        <div className="flex justify-between">
          <span className="text-gray-500">Monthly Repayment</span>
          <span>{formatNaira(loan.proposed_monthly_repayment)}</span>
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
    mutationFn: () => loansApi.adminApprove(loan.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans-queue"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || "Failed."),
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
        By approving, you give final sign-off to activate this loan.
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
          {mutation.isPending ? "Approving..." : "Give Final Approval"}
        </button>
      </div>
    </div>
  );
}

export default function LoanQueuePage() {
  const { isAdmin } = useAuth();
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(
    null,
  );
  const [modalType, setModalType] = useState<
    "committee" | "admin" | "repayment" | null
  >(null);
  const [statusFilter, setStatusFilter] = useState("");

  const formatHijriDate = (month: number | null, year: number | null) => {
    if (!month || !year) return "TBD";
    const monthLabel = HIJRI_MONTHS.find((item) => item.value === month)?.label;
    return monthLabel ? `${monthLabel} ${year}` : `${month}/${year}`;
  };

  const renderApprovalChain = (loan: LoanApplication) => {
    const committeeDone = [
      "approved",
      "pending_admin",
      "hos_approved",
      "active",
      "completed",
    ].includes(loan.status);
    const adminDone = ["hos_approved", "active", "completed"].includes(
      loan.status,
    );

    return (
      <div className="text-xs text-gray-500">
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={
              committeeDone ? "text-gray-800 font-semibold" : "text-gray-400"
            }
          >
            {committeeDone ? "Committee ✓" : "Committee"}
          </span>
          <span>→</span>
          <span
            className={
              adminDone ? "text-gray-800 font-semibold" : "text-gray-400"
            }
          >
            {adminDone ? "Admin ✓" : "Admin"}
          </span>
          {loan.status === "hos_approved" && (
            <>
              <span>→</span>
              <span className="text-gray-800 font-semibold">HOS ✓</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const fetchLoans = async (): Promise<PaginatedResponse<LoanApplication>> =>
    loansApi.list({ status: statusFilter || undefined }).then((r) => r.data);

  const { data, isLoading } = useQuery<PaginatedResponse<LoanApplication>>({
    queryKey: ["loans-queue", statusFilter],
    queryFn: fetchLoans,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return (
    <div>
      <PageHeader
        title="Loan Queue"
        subtitle="Review and process loan applications"
      />

      <div className="mb-4">
        <label htmlFor="loan-status-filter" className="sr-only">
          Filter loan status
        </label>
        <select
          id="loan-status-filter"
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="pending_sureties">Pending Surety Confirmation</option>
          <option value="approved">Committee Approved</option>
          <option value="pending_admin">Pending Admin Approval</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Loan #</th>
              <th>Member</th>
              <th>Amount</th>
              <th>Duration</th>
              <th>Timeline</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center">
                  <PageLoader />
                </td>
              </tr>
            ) : !data?.results?.length ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon="📑" title="No loans in queue" />
                </td>
              </tr>
            ) : (
              data.results.map((loan) => (
                <tr key={loan.id}>
                  <td className="font-mono text-sm">#{loan.id}</td>
                  <td>
                    <span className="font-medium">
                      {loan.applicant_file_number}
                    </span>
                    <br />
                    <span className="text-xs text-gray-400">
                      {loan.applicant_name}
                    </span>
                  </td>
                  <td className="font-medium">
                    {formatNaira(loan.amount_applied)}
                  </td>
                  <td>{loan.proposed_duration_months} mo.</td>
                  <td className="space-y-1 text-xs text-gray-500">
                    <div>
                      {loan.application_hijri_display} →{" "}
                      {formatHijriDate(
                        loan.repayment_end_hijri_month,
                        loan.repayment_end_hijri_year,
                      )}
                    </div>
                    {renderApprovalChain(loan)}
                  </td>
                  <td>
                    <LoanStatusBadge status={loan.status} />
                  </td>
                  <td className="flex flex-col gap-2">
                    {["submitted", "under_review", "pending_sureties"].includes(
                      loan.status,
                    ) && (
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setModalType("committee");
                        }}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        Review
                      </button>
                    )}
                    {isAdmin &&
                      ["pending_admin", "approved"].includes(loan.status) && (
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setModalType("admin");
                          }}
                          className="btn-primary text-xs px-2 py-1"
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
                        className="btn-primary text-xs px-2 py-1"
                      >
                        Post Repayment
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
