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
    <div className="space-y-4 p-1">
      {error && <ErrorAlert message={error} />}
      <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Applicant</span>
          <span>
            {loan.applicant_file_number} — {loan.applicant_name}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Amount</span>
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
          <textarea {...register("note")} className="input h-16" />
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
    mutationFn: () =>
      loansApi.adminApprove?.(loan.id) || loansApi.hosApprove?.(loan.id), // adjust to your new endpoint
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
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn-primary flex-1"
        >
          {mutation.isPending ? "Approving..." : "Admin Approve"}
        </button>
      </div>
    </div>
  );
}

export default function LoanQueuePage() {
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(
    null,
  );
  const [modalType, setModalType] = useState<
    "committee" | "admin" | "repayment" | null
  >(null);
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
          aria-label="Filter loan status"
          title="Filter loan status"
        >
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Committee Approved</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      
      {isLoading ? (
        <PageLoader />
      ) : !data?.results?.length ? (
        <EmptyState icon="📑" title="No loans in queue" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="px-4 py-3">Loan #</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Duration</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.results.map((loan) => (
                  <tr key={loan.id}>
                    <td className="px-4 py-3 font-mono text-sm">#{loan.id}</td>
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
                      {[
                        "submitted",
                        "under_review",
                        "pending_sureties",
                      ].includes(loan.status) && (
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setModalType("committee");
                          }}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          Review
                        </button>
                      )}
                      {loan.status === "approved" && (
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setModalType("admin");
                          }}
                          className="btn-primary text-xs px-3 py-1"
                        >
                          Admin Approve
                        </button>
                      )}
                      {loan.status === "active" && (
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setModalType("repayment");
                          }}
                          className="btn-primary text-xs px-3 py-1"
                        >
                          Post Repayment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.results.map((loan) => (
              <div
                key={loan.id}
                className="bg-white rounded-xl border p-4 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm font-semibold text-primary-600">
                      #{loan.id}
                    </p>
                    <p className="font-medium text-gray-900">
                      {loan.applicant_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {loan.applicant_file_number}
                    </p>
                  </div>
                  <LoanStatusBadge status={loan.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Amount:</span>{" "}
                    <span className="font-semibold">
                      {formatNaira(loan.amount_applied)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>{" "}
                    {loan.proposed_duration_months} mo.
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Purpose:</span>{" "}
                    <span className="line-clamp-2">{loan.purpose}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  {["submitted", "under_review", "pending_sureties"].includes(
                    loan.status,
                  ) && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setModalType("committee");
                      }}
                      className="btn-secondary flex-1 py-2 text-sm"
                    >
                      Review
                    </button>
                  )}
                  {loan.status === "approved" && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setModalType("admin");
                      }}
                      className="btn-primary flex-1 py-2 text-sm"
                    >
                      Admin Approve
                    </button>
                  )}
                  {loan.status === "active" && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setModalType("repayment");
                      }}
                      className="btn-primary flex-1 py-2 text-sm"
                    >
                      Post Repayment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
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
