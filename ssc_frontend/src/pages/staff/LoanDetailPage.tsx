import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
import { useState } from "react";
import {
  PageHeader,
  PageLoader,
  LoanStatusBadge,
  SuretyStatusBadge,
  formatNaira,
  EmptyState,
} from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import RepaymentModal from "@/components/loans/RepaymentModal";

export default function LoanDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { isAdmin, isCommittee } = useAuth();
  const [showRepayment, setShowRepayment] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["loan", id],
    queryFn: () => loansApi.get(Number(id)).then((r) => r.data),
    enabled: !!id,
  });

  const { data: repayments, isLoading: isLoadingReps } = useQuery({
    queryKey: ["loan-repayments", id],
    queryFn: () => loansApi.repaymentHistory(Number(id)).then((r) => r.data),
    enabled: !!id,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalRecs = repayments ? repayments.length : 0;
  const pageCount = Math.max(1, Math.ceil(totalRecs / pageSize));
  const pagedReps = repayments ? repayments.slice((page - 1) * pageSize, page * pageSize) : [];

  // Reset page when repayments change
  useState(() => {});

  const exportCsv = () => {
    if (!repayments || repayments.length === 0) return;
    const headers = ["hijri", "amount", "balance_before", "balance_after", "posted_by", "posted_at"];
    const rows = repayments.map((r: any) => [
      r.hijri_display,
      r.amount,
      r.balance_before,
      r.balance_after,
      r.verified_by_name,
      r.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fname = data ? `loan-${data.id}-repayments.csv` : `loan-${id}-repayments.csv`;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <PageLoader />;
  if (!data) return <EmptyState icon="🔍" title="Loan not found" />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Loan #${data.id}`}
        subtitle={`Applicant: ${data.applicant_name}`}
        back={{ to: "/my-loans", label: "Back to My Loans" }}
        action={
          (isAdmin || isCommittee) && (
            <button
              onClick={() => setShowRepayment(true)}
              className="btn-primary"
            >
              Post Repayment
            </button>
          )
        }
      />

      <div className="card mb-4">
        <div className="card-body grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Amount Applied</p>
            <p className="font-semibold text-lg">
              {formatNaira(data.amount_applied)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <LoanStatusBadge status={data.status} />
          </div>
          <div>
            <p className="text-sm text-gray-600">Proposed Duration</p>
            <p className="font-semibold">
              {data.proposed_duration_months} months
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className="font-semibold">
              {formatNaira(data.outstanding_balance || "0")}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">Sureties</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Member</th>
                <th>Guaranteed</th>
                <th>Remaining</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray((data as any).sureties) &&
              (data as any).sureties.length ? (
                (data as any).sureties.map((s: any) => (
                  <tr key={s.id}>
                    <td>#{s.layer}</td>
                    <td className="text-sm text-gray-700">
                      {s.surety_file_number} — {s.surety_name}
                    </td>
                    <td>{formatNaira(s.amount_guaranteed)}</td>
                    <td>{formatNaira(s.current_liability)}</td>
                    <td>
                      <SuretyStatusBadge status={s.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon="🤝" title="No sureties attached" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h3 className="font-semibold">Repayment History</h3>
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="btn-secondary btn-sm">
              Export CSV
            </button>
            <label className="text-sm text-gray-600">Show</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="input w-20"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-500">records</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-600">{page} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="btn-secondary btn-sm"
            >
              Next →
            </button>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Hijri</th>
                <th>Amount</th>
                <th>Balance Before</th>
                <th>Balance After</th>
                <th>Posted By</th>
                <th>Posted At</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingReps ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <PageLoader />
                  </td>
                </tr>
              ) : !repayments?.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="💸" title="No repayments posted" />
                  </td>
                </tr>
              ) : (
                pagedReps.map((r: any) => (
                  <tr key={r.id}>
                    <td className="text-sm text-gray-600">{r.hijri_display}</td>
                    <td>{formatNaira(r.amount)}</td>
                    <td>{formatNaira(r.balance_before)}</td>
                    <td>{formatNaira(r.balance_after)}</td>
                    <td className="text-sm text-gray-600">{r.verified_by_name}</td>
                    <td className="text-xs text-gray-500">{r.created_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showRepayment && data && (
        <div>
          <RepaymentModal
            loanId={data.id}
            outstanding={data.outstanding_balance}
            defaultMonth={data.repayment_start_hijri_month || 1}
            defaultYear={data.repayment_start_hijri_year || new Date().getFullYear()}
            onClose={() => setShowRepayment(false)}
            onSuccess={() => qc.invalidateQueries({ queryKey: ["loan-repayments", String(id)] })}
          />
        </div>
      )}
    </div>
  );
}
