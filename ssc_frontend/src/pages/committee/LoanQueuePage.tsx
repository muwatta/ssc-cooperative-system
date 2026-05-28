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
import type { LoanApplication } from "@/types";

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

function HOSApprovalModal({
  loan,
  onClose,
}: {
  loan: LoanApplication;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => loansApi.hosApprove(loan.id),
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
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(
    null,
  );
  const [modalType, setModalType] = useState<"committee" | "hos" | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["loans-queue", statusFilter],
    queryFn: () =>
      loansApi.list({ status: statusFilter || undefined }).then((r) => r.data),
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
          <option value="approved">Committee Approved</option>
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
              <th>Applied</th>
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
                  <td className="text-xs text-gray-500">
                    {loan.application_hijri_display}
                  </td>
                  <td>
                    <LoanStatusBadge status={loan.status} />
                  </td>
                  <td>
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
                    {loan.status === "approved" && (
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setModalType("hos");
                        }}
                        className="btn-primary text-xs px-2 py-1"
                      >
                        HOS Approve
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
        open={!!selectedLoan && modalType === "hos"}
        title="Head of School — Final Approval"
        onClose={() => {
          setSelectedLoan(null);
          setModalType(null);
        }}
      >
        {selectedLoan && (
          <HOSApprovalModal
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
