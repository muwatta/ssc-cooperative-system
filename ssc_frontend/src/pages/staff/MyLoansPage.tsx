import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { loansApi, suretiesApi } from "@/api/services";
import { PageLoader, EmptyState, formatNaira } from "@/components/common";
import { useState } from "react";
import type { LoanApplication as Loan, SuretyRecord as Surety } from "@/types";

export default function MyLoansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hoveredLoan, setHoveredLoan] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"loans" | "sureties">("loans");

  const { data: loansData, isLoading } = useQuery({
    queryKey: ["my-loans"],
    queryFn: () => loansApi.mine().then((r) => r.data),
  });

  const { data: suretiesData, isLoading: suretiesLoading } = useQuery({
    queryKey: ["my-sureties"],
    queryFn: () => suretiesApi.mine().then((r) => r.data),
  });

  const loans = loansData?.results || [];
  const sureties = suretiesData?.results || [];

  const confirmSurety = useMutation({
    mutationFn: (id: number) => suretiesApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-sureties"] });
    },
  });

  const declineSurety = useMutation({
    mutationFn: (id: number) => suretiesApi.decline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-sureties"] });
    },
  });

  const activeLoan = loans.find((l: Loan) => l.status === "active");
  const pendingSureties = sureties.filter(
    (s: Surety) => s.status === "pending",
  );
  const { isAdmin, isCommittee } = useAuth();

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-emerald-100 text-emerald-800 border-emerald-200",
      completed: "bg-blue-100 text-blue-800 border-blue-200",
      pending: "bg-amber-100 text-amber-800 border-amber-200",
      rejected: "bg-rose-100 text-rose-800 border-rose-200",
      approved: "bg-indigo-100 text-indigo-800 border-indigo-200",
      under_review: "bg-purple-100 text-purple-800 border-purple-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  if (isLoading || suretiesLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header Section with Gradient */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white shadow-xl">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold">My Loans</h1>
              <p className="mt-1 text-primary-100">
                Track your loan applications and surety obligations
              </p>
            </div>
            <button
              onClick={() => navigate("/loans/apply")}
              className="transform rounded-xl bg-white px-6 py-3 font-semibold text-primary-700 shadow-lg transition-all hover:scale-105 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-700"
            >
              ✨ Apply for New Loan
            </button>
          </div>
        </div>

        {/* Stats Section - Active Loan Summary */}
        {activeLoan && (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-gray-700">
              Current Active Loan
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="transform rounded-xl border-l-4 border-emerald-500 bg-white p-5 shadow-md transition-all hover:shadow-lg">
                <p className="text-sm font-medium text-gray-500">
                  Amount Approved
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-800">
                  {formatNaira(
                    activeLoan.amount_approved || activeLoan.amount_applied,
                  )}
                </p>
              </div>
              <div className="transform rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-md transition-all hover:shadow-lg">
                <p className="text-sm font-medium text-gray-500">
                  Outstanding Balance
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-600">
                  {formatNaira(activeLoan.outstanding_balance)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {(
                    (parseFloat(activeLoan.outstanding_balance) /
                      parseFloat(activeLoan.amount_applied)) *
                    100
                  ).toFixed(0)}
                  % remaining
                </p>
              </div>
              <div className="transform rounded-xl border-l-4 border-blue-500 bg-white p-5 shadow-md transition-all hover:shadow-lg">
                <p className="text-sm font-medium text-gray-500">
                  Monthly Payment
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-800">
                  {formatNaira(activeLoan.proposed_monthly_repayment)}
                </p>
              </div>
              <div className="transform rounded-xl border-l-4 border-purple-500 bg-white p-5 shadow-md transition-all hover:shadow-lg">
                <p className="text-sm font-medium text-gray-500">Duration</p>
                <p className="mt-2 text-2xl font-bold text-gray-800">
                  {activeLoan.proposed_duration_months} months
                </p>
                <p className="mt-1 text-xs text-gray-400">Maximum 12 months</p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Sureties Banner */}
        {pendingSureties.length > 0 && (
          <div className="mb-8 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-200">
                <span className="text-xl">🤝</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">
                  Action Required
                </h3>
                <p className="text-sm text-amber-700">
                  You have {pendingSureties.length} pending surety request
                  {pendingSureties.length > 1 ? "s" : ""}. Please review and
                  respond below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("loans")}
            className={`rounded-t-lg px-6 py-3 text-sm font-medium transition-all ${
              activeTab === "loans"
                ? "border-b-2 border-primary-600 text-primary-700 bg-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            📋 Loan Applications
            {loans.length > 0 && (
              <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
                {loans.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("sureties")}
            className={`rounded-t-lg px-6 py-3 text-sm font-medium transition-all ${
              activeTab === "sureties"
                ? "border-b-2 border-primary-600 text-primary-700 bg-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            🤝 Surety Obligations
            {pendingSureties.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                {pendingSureties.length} pending
              </span>
            )}
          </button>
        </div>

        {/* Loans Tab Content */}
        {activeTab === "loans" && (
          <div className="rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Loan ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Purpose
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Applied Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Outstanding
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <EmptyState
                          icon="🏦"
                          title="No loan applications yet"
                        />
                      </td>
                    </tr>
                  ) : (
                    loans.map((loan: Loan) => (
                      <tr
                        key={loan.id}
                        className="group transition-all hover:bg-gray-50"
                        onMouseEnter={() => setHoveredLoan(loan.id)}
                        onMouseLeave={() => setHoveredLoan(null)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-semibold text-primary-600">
                            #{loan.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">
                            {formatNaira(loan.amount_applied)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="max-w-xs truncate text-sm text-gray-600">
                            {loan.purpose}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {loan.application_hijri_display}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(loan.status)}`}
                          >
                            {loan.status.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {loan.status === "active" ? (
                            <span className="font-semibold text-amber-600">
                              {formatNaira(loan.outstanding_balance)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(isAdmin ||
                            isCommittee ||
                            loan.status === "active") && (
                            <button
                              className="transform rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                              onClick={() => navigate(`/loans/${loan.id}`)}
                            >
                              {hoveredLoan === loan.id
                                ? "View Details →"
                                : "View"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Loans Summary Footer */}
            {loans.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Applications</span>
                  <span className="font-semibold text-gray-900">
                    {loans.length}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-gray-600">Active Loans</span>
                  <span className="font-semibold text-amber-600">
                    {loans.filter((l: Loan) => l.status === "active").length}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sureties Tab Content */}
        {activeTab === "sureties" && (
          <div className="rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Loan ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Borrower
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Amount Guaranteed
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Remaining Liability
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sureties.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <EmptyState icon="🤝" title="No surety obligations" />
                      </td>
                    </tr>
                  ) : (
                    sureties.map((surety: Surety) => (
                      <tr
                        key={surety.id}
                        className="group transition-all hover:bg-gray-50"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-semibold text-primary-600">
                            #{surety.loan}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          Loan #{surety.loan} Applicant
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">
                            {formatNaira(surety.amount_guaranteed)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-semibold ${
                              parseFloat(surety.current_liability) > 0
                                ? "text-amber-600"
                                : "text-gray-400"
                            }`}
                          >
                            {formatNaira(surety.current_liability)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                              surety.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : surety.status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : surety.status === "released"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {surety.status?.toUpperCase() || "PENDING"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {surety.status === "pending" ? (
                            <div className="flex justify-center gap-2">
                              <button
                                className="transform rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-emerald-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                onClick={() => confirmSurety.mutate(surety.id)}
                              >
                                ✓ Confirm
                              </button>
                              <button
                                className="transform rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-rose-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-500"
                                onClick={() => declineSurety.mutate(surety.id)}
                              >
                                ✗ Decline
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Sureties Summary Footer */}
            {sureties.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Total Surety Commitments
                  </span>
                  <span className="font-semibold text-gray-900">
                    {sureties.length}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-gray-600">Pending Confirmations</span>
                  <span className="font-semibold text-amber-600">
                    {
                      sureties.filter((s: Surety) => s.status === "pending")
                        .length
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Decorative Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>🏦 SSC Cooperative — Islamic (Hijri) Calendar based system</p>
          <p className="mt-1">
            All records are maintained in accordance with cooperative bylaws
          </p>
        </div>
      </div>
    </div>
  );
}
