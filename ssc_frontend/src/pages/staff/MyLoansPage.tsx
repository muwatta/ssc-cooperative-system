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
  const [activeTab, setActiveTab] = useState<"loans" | "sureties">("loans");
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);

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
  const activePercent = activeLoan
    ? (parseFloat(activeLoan.outstanding_balance) /
        parseFloat(activeLoan.amount_approved || activeLoan.amount_applied)) *
      100
    : 0;
  const { isAdmin, isCommittee } = useAuth();

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-emerald-100 text-emerald-800",
      completed: "bg-blue-100 text-blue-800",
      submitted: "bg-purple-100 text-purple-800",
      pending: "bg-amber-100 text-amber-800",
      pending_sureties: "bg-amber-100 text-amber-800",
      pending_admin: "bg-indigo-100 text-indigo-800",
      rejected: "bg-rose-100 text-rose-800",
      approved: "bg-indigo-100 text-indigo-800",
      under_review: "bg-purple-100 text-purple-800",
      defaulted: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading || suretiesLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
        {/* Header Section */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-5 text-white shadow-lg md:mb-8 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">My Loans</h1>
              <p className="mt-1 text-sm text-primary-100">
                Track your loan applications & surety obligations
              </p>
            </div>
            <button
              onClick={() => navigate("/loans/apply")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 font-semibold text-primary-700 shadow-md transition-all active:scale-95 md:w-auto md:px-6 md:py-3"
            >
              <span className="text-lg">✨</span>
              Apply for Loan
            </button>
          </div>
        </div>

        {/* Active Loan Summary */}
        {activeLoan && (
          <div className="mb-6">
            <h2 className="mb-3 text-base font-semibold text-gray-700 md:text-lg">
              Current Active Loan
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border-l-4 border-emerald-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  Amount Approved
                </p>
                <p className="mt-1 text-lg font-bold text-gray-800 md:text-2xl">
                  {formatNaira(
                    activeLoan.amount_approved || activeLoan.amount_applied,
                  )}
                </p>
              </div>
              <div className="rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Outstanding</p>
                <p className="mt-1 text-lg font-bold text-amber-600 md:text-2xl">
                  {formatNaira(activeLoan.outstanding_balance)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${Math.round(activePercent)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round(activePercent)}%
                  </span>
                </div>
              </div>
              <div className="rounded-xl border-l-4 border-blue-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  Monthly Payment
                </p>
                <p className="mt-1 text-lg font-bold text-gray-800 md:text-2xl">
                  {formatNaira(activeLoan.proposed_monthly_repayment)}
                </p>
              </div>
              <div className="rounded-xl border-l-4 border-purple-500 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Duration</p>
                <p className="mt-1 text-lg font-bold text-gray-800 md:text-2xl">
                  {activeLoan.proposed_duration_months} months
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  From {activeLoan.repayment_start_hijri_month || 1}/
                  {activeLoan.repayment_start_hijri_year || ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Sureties Banner */}
        {pendingSureties.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-200">
                <span className="text-lg">🤝</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">
                  Action Required
                </h3>
                <p className="text-sm text-amber-700">
                  You have {pendingSureties.length} pending surety request
                  {pendingSureties.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("loans")}
            className={`flex-1 rounded-t-lg py-3 text-center text-sm font-medium transition-all md:flex-none md:px-6 ${
              activeTab === "loans"
                ? "border-b-2 border-primary-600 bg-white text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            📋 My Loans
            {loans.length > 0 && (
              <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs">
                {loans.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("sureties")}
            className={`flex-1 rounded-t-lg py-3 text-center text-sm font-medium transition-all md:flex-none md:px-6 ${
              activeTab === "sureties"
                ? "border-b-2 border-primary-600 bg-white text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🤝 My Sureties
            {pendingSureties.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs">
                {pendingSureties.length}
              </span>
            )}
          </button>
        </div>

        {/* Loans Tab */}
        {activeTab === "loans" && (
          <div>
            {loans.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 shadow-sm">
                <EmptyState icon="🏦" title="No loan applications yet" />
              </div>
            ) : (
              <div className="space-y-3">
                {loans.map((loan: Loan) => (
                  <div
                    key={loan.id}
                    className="overflow-hidden rounded-xl bg-white shadow-sm transition-all active:scale-[0.99]"
                  >
                    <button
                      className="w-full cursor-pointer p-4 text-left"
                      onClick={() =>
                        setExpandedLoan(
                          expandedLoan === loan.id ? null : loan.id,
                        )
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-primary-600">
                            #{loan.id}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(loan.status)}`}
                          >
                            {loan.status.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                        <svg
                          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expandedLoan === loan.id ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-lg font-bold text-gray-900">
                          {formatNaira(loan.amount_applied)}
                        </span>
                        {loan.status === "active" && (
                          <span className="text-sm font-semibold text-amber-600">
                            {formatNaira(loan.outstanding_balance)} left
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-600">
                        {loan.purpose}
                      </p>
                    </button>

                    {expandedLoan === loan.id && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Applied Date</span>
                            <span className="font-medium text-gray-700">
                              {loan.application_hijri_display}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Duration</span>
                            <span className="font-medium text-gray-700">
                              {loan.proposed_duration_months} months
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Sureties</span>
                            <span className="font-medium text-gray-700">
                              {loan.sureties?.length || 0}
                            </span>
                          </div>
                          {(isAdmin ||
                            isCommittee ||
                            loan.status === "active") && (
                            <button
                              className="mt-3 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition-all active:scale-95"
                              onClick={() => navigate(`/loans/${loan.id}`)}
                            >
                              View Full Details →
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Summary Footer */}
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Applications</span>
                    <span className="font-semibold text-gray-900">
                      {loans.length}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-600">Active Loans</span>
                    <span className="font-semibold text-amber-600">
                      {loans.filter((l: Loan) => l.status === "active").length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sureties Tab */}
        {activeTab === "sureties" && (
          <div>
            {sureties.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 shadow-sm">
                <EmptyState icon="🤝" title="No surety obligations" />
              </div>
            ) : (
              <div className="space-y-3">
                {sureties.map((surety: Surety) => (
                  <div
                    key={surety.id}
                    className="rounded-xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-semibold text-primary-600">
                          Loan #{surety.loan}
                        </span>
                        <span
                          className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            surety.status === "confirmed"
                              ? "bg-emerald-100 text-emerald-800"
                              : surety.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : surety.status === "declined"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {surety.status?.toUpperCase() || "PENDING"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Amount Guaranteed</span>
                        <span className="font-semibold text-gray-900">
                          {formatNaira(surety.amount_guaranteed)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          Remaining Liability
                        </span>
                        <span
                          className={`font-semibold ${parseFloat(surety.current_liability) > 0 ? "text-amber-600" : "text-gray-400"}`}
                        >
                          {formatNaira(surety.current_liability)}
                        </span>
                      </div>
                    </div>

                    {surety.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        <button
                          className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-all active:scale-95"
                          onClick={() => confirmSurety.mutate(surety.id)}
                        >
                          ✓ Confirm
                        </button>
                        <button
                          className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-medium text-white transition-all active:scale-95"
                          onClick={() => declineSurety.mutate(surety.id)}
                        >
                          ✗ Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Summary Footer */}
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Commitments</span>
                    <span className="font-semibold text-gray-900">
                      {sureties.length}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-600">Pending Confirmations</span>
                    <span className="font-semibold text-amber-600">
                      {
                        sureties.filter((s: Surety) => s.status === "pending")
                          .length
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>🏦 SSC Cooperative — Islamic (Hijri) Calendar based system</p>
        </div>
      </div>
    </div>
  );
}
