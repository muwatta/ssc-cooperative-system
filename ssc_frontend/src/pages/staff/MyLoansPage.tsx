import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loansApi, suretiesApi } from "@/api/services";
import {
  PageHeader,
  LoanStatusBadge,
  PageLoader,
  EmptyState,
  formatNaira,
  StatCard,
  SuretyStatusBadge,
} from "@/components/common";

export default function MyLoansPage() {
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { data: loans, isLoading } = useQuery({
    queryKey: ["my-loans"],
    queryFn: () => loansApi.mine().then((r) => r.data),
  });

  const { data: sureties } = useQuery({
    queryKey: ["my-sureties"],
    queryFn: () => suretiesApi.mine().then((r) => r.data),
  });

  const confirmSurety = useMutation({
    mutationFn: (id: number) => suretiesApi.confirm(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-sureties"] }),
  });

  const declineSurety = useMutation({
    mutationFn: (id: number) => suretiesApi.decline(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-sureties"] }),
  });

  const activeLoan = loans?.results?.find((l) => l.status === "active");

  return (
    <div>
      <PageHeader
        title="My Loans"
        subtitle="Loan applications and repayment history"
        action={
          <button
            onClick={() => navigate("/loans/apply")}
            className="btn-primary"
          >
            Apply for Loan
          </button>
        }
      />

      {/* Active loan summary */}
      {activeLoan && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Amount Approved"
            value={formatNaira(
              activeLoan.amount_approved || activeLoan.amount_applied,
            )}
            color="primary"
          />
          <StatCard
            label="Outstanding Balance"
            value={formatNaira(activeLoan.outstanding_balance)}
            color="warning"
          />
          <StatCard
            label="Duration"
            value={`${activeLoan.proposed_duration_months} months`}
            color="success"
            sub="Max 6 months"
          />
        </div>
      )}

      {/* Loans table */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Loan Applications</h2>
        </div>
        <div className="table-container rounded-none border-0">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <PageLoader />
                  </td>
                </tr>
              ) : !loans?.results?.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="🏦" title="No loan applications yet" />
                  </td>
                </tr>
              ) : (
                loans.results.map((l) => (
                  <tr key={l.id}>
                    <td className="font-mono text-sm">#{l.id}</td>
                    <td className="font-medium">
                      {formatNaira(l.amount_applied)}
                    </td>
                    <td className="text-sm text-gray-600 max-w-xs truncate">
                      {l.purpose}
                    </td>
                    <td className="text-xs text-gray-500">
                      {l.application_hijri_display}
                    </td>
                    <td>
                      <LoanStatusBadge status={l.status} />
                    </td>
                    <td
                      className={
                        l.status === "active"
                          ? "font-bold text-warning-700"
                          : ""
                      }
                    >
                      {l.status === "active"
                        ? formatNaira(l.outstanding_balance)
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sureties */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">My Surety Obligations</h2>
        </div>
        <div className="table-container rounded-none border-0">
          <table className="table">
            <thead>
              <tr>
                <th>Loan #</th>
                <th>Borrower</th>
                <th>Guaranteed</th>
                <th>Remaining Liability</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!sureties?.results?.length ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon="🤝" title="No surety obligations" />
                  </td>
                </tr>
              ) : (
                sureties.results.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">#{s.loan}</td>
                    <td className="text-sm text-gray-600">Loan #{s.loan}</td>
                    <td>{formatNaira(s.amount_guaranteed)}</td>
                    <td
                      className={
                        parseFloat(s.current_liability) > 0
                          ? "font-medium text-warning-700"
                          : "text-gray-400"
                      }
                    >
                      {formatNaira(s.current_liability)}
                    </td>
                    <td>
                      <SuretyStatusBadge status={s.status} />
                    </td>
                    <td>
                      {s.status === "pending" ? (
                        <div className="flex flex-col gap-2">
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => confirmSurety.mutate(s.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => declineSurety.mutate(s.id)}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
