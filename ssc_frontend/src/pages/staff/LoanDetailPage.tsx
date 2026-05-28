import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { loansApi } from "@/api/services";
import {
  PageHeader,
  PageLoader,
  LoanStatusBadge,
  SuretyStatusBadge,
  formatNaira,
  EmptyState,
} from "@/components/common";

export default function LoanDetailPage() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["loan", id],
    queryFn: () => loansApi.get(Number(id)).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (!data) return <EmptyState icon="🔍" title="Loan not found" />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Loan #${data.id}`}
        subtitle={`Applicant: ${data.applicant_name}`}
        back={{ to: "/my-loans", label: "Back to My Loans" }}
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
    </div>
  );
}
