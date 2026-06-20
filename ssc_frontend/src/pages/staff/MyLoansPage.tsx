import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { loansApi, suretiesApi } from "@/api/services";
import { PageLoader, EmptyState, formatNaira } from "@/components/common";
import { useState, useMemo, useEffect} from "react";
import type { LoanApplication as Loan, SuretyRecord as Surety } from "@/types";

export default function MyLoansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"loans" | "sureties">("loans");
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (tabParam === "sureties") {
      setActiveTab("sureties");
    }
  }, [tabParam]);

  // Cache loans for 3 minutes
  const { data: loansData, isLoading: loansLoading } = useQuery({
    queryKey: ["my-loans"],
    queryFn: () => loansApi.mine().then((r) => r.data),
    staleTime: 1000 * 60 * 3,
  });

  // Cache sureties for 3 minutes
  const { data: suretiesData, isLoading: suretiesLoading } = useQuery({
    queryKey: ["my-sureties"],
    queryFn: () => suretiesApi.mine().then((r) => r.data),
    staleTime: 1000 * 60 * 3,
  });

  // Sort newest first
  const loans = useMemo(() => {
    const raw = loansData?.results ?? [];
    return [...raw].sort((a, b) => {
      if (a.application_hijri_year && b.application_hijri_year) {
        if (a.application_hijri_year !== b.application_hijri_year)
          return b.application_hijri_year - a.application_hijri_year;
        if (a.application_hijri_month && b.application_hijri_month)
          return (
            (b.application_hijri_month ?? 0) - (a.application_hijri_month ?? 0)
          );
      }
      return b.id - a.id;
    });
  }, [loansData]);

  const sureties = useMemo(() => {
    const raw = suretiesData?.results ?? [];
    return [...raw].sort((a, b) => b.id - a.id);
  }, [suretiesData]);

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
      active:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
      completed:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
      submitted:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
      pending:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
      pending_sureties:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
      pending_admin:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
      rejected:
        "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
      approved:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
      under_review:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
      defaulted: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    };
    return (
      colors[status] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    );
  };

  if (loansLoading && loans.length === 0 && activeTab === "loans")
    return <PageLoader />;
  if (suretiesLoading && sureties.length === 0 && activeTab === "sureties")
    return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 pb-20">
      <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
        {/* Header Section */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-5 text-white shadow-lg dark:from-primary-800 dark:to-primary-950 md:mb-8 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">My Loans</h1>
              <p className="mt-1 text-sm text-primary-100 dark:text-primary-300">
                Track your loan applications & surety obligations
              </p>
            </div>
            <button
              onClick={() => navigate("/loans/apply")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 font-semibold text-primary-700 shadow-md transition-all active:scale-95 dark:bg-gray-800 dark:text-primary-400 dark:shadow-gray-900 md:w-auto md:px-6 md:py-3"
            >
              <span className="text-lg">✨</span>
              Apply for Loan
            </button>
          </div>
        </div>

        {/* Active Loan Summary */}
        {activeLoan && (
          <div className="mb-6">
            <h2 className="mb-3 text-base font-semibold text-gray-700 dark:text-gray-300 md:text-lg">
              Current Active Loan
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border-l-4 border-emerald-500 bg-white p-4 shadow-sm dark:bg-gray-800 dark:border-emerald-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Amount Approved
                </p>
                <p className="mt-1 text-lg font-bold text-gray-800 dark:text-white md:text-2xl">
                  {formatNaira(
                    activeLoan.amount_approved || activeLoan.amount_applied,
                  )}
                </p>
              </div>
              <div className="rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm dark:bg-gray-800 dark:border-amber-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Outstanding
                </p>
                <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400 md:text-2xl">
                  {formatNaira(activeLoan.outstanding_balance)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${Math.round(activePercent)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(activePercent)}%
                  </span>
                </div>
              </div>
              <div className="rounded-xl border-l-4 border-blue-500 bg-white p-4 shadow-sm dark:bg-gray-800 dark:border-blue-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Monthly Payment
                </p>
                <p className="mt-1 text-lg font-bold text-gray-800 dark:text-white md:text-2xl">
                  {formatNaira(activeLoan.proposed_monthly_repayment)}
                </p>
              </div>
              <div className="rounded-xl border-l-4 border-purple-500 bg-white p-4 shadow-sm dark:bg-gray-800 dark:border-purple-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Duration
                </p>
                <p className="mt-1 text-lg font-bold text-gray-800 dark:text-white md:text-2xl">
                  {typeof activeLoan.remaining_months === "number"
                    ? `${activeLoan.remaining_months} / ${activeLoan.proposed_duration_months} months`
                    : `${activeLoan.proposed_duration_months} months`}
                  {activeLoan.remaining_months === 0 && (
                    <span className="ml-2 text-sm text-green-600">✅</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  From {activeLoan.repayment_start_hijri_month || 1}/
                  {activeLoan.repayment_start_hijri_year || ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Sureties Banner */}
        {pendingSureties.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm dark:border-amber-800 dark:from-amber-950/30 dark:to-orange-950/30">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800">
                <span className="text-lg">🤝</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                  Action Required
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  You have {pendingSureties.length} pending surety request
                  {pendingSureties.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("loans")}
            className={`flex-1 rounded-t-lg py-3 text-center text-sm font-medium transition-all md:flex-none md:px-6 ${
              activeTab === "loans"
                ? "border-b-2 border-primary-600 bg-white text-primary-700 dark:bg-gray-800 dark:text-primary-400 dark:border-primary-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            📋 My Loans
            {loans.length > 0 && (
              <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs dark:bg-primary-900/50 dark:text-primary-300">
                {loans.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("sureties")}
            className={`flex-1 rounded-t-lg py-3 text-center text-sm font-medium transition-all md:flex-none md:px-6 ${
              activeTab === "sureties"
                ? "border-b-2 border-primary-600 bg-white text-primary-700 dark:bg-gray-800 dark:text-primary-400 dark:border-primary-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            🤝 My Sureties
            {pendingSureties.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs dark:bg-amber-900/50 dark:text-amber-300">
                {pendingSureties.length}
              </span>
            )}
          </button>
        </div>

        {/* Loans Tab */}
        {activeTab === "loans" && (
          <div>
            {loansLoading && loans.length === 0 ? (
              <div className="flex justify-center rounded-2xl bg-white p-12 shadow-sm dark:bg-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  Loading loans…
                </span>
              </div>
            ) : loans.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 shadow-sm dark:bg-gray-800">
                <EmptyState icon="🏦" title="No loan applications yet" />
              </div>
            ) : (
              <div className="space-y-3">
                {loans.map((loan: Loan) => (
                  <div
                    key={loan.id}
                    className="overflow-hidden rounded-xl bg-white shadow-sm transition-all active:scale-[0.99] dark:bg-gray-800"
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
                          <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
                            #{loan.id}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(loan.status)}`}
                          >
                            {loan.status.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                        <svg
                          className={`h-5 w-5 text-gray-400 transition-transform duration-200 dark:text-gray-500 ${expandedLoan === loan.id ? "rotate-180" : ""}`}
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
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatNaira(loan.amount_applied)}
                        </span>
                        {loan.status === "active" && (
                          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                            {formatNaira(loan.outstanding_balance)} left
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-600 dark:text-gray-300">
                        {loan.purpose}
                      </p>
                    </button>

                    {expandedLoan === loan.id && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              Applied Date
                            </span>
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                              {loan.application_hijri_display}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              Duration
                            </span>
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                              {typeof loan.remaining_months === "number"
                                ? `${loan.remaining_months} / ${loan.proposed_duration_months} months`
                                : `${loan.proposed_duration_months} months`}
                              {loan.remaining_months === 0 && (
                                <span className="ml-1 text-green-600">✅</span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              Sureties
                            </span>
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                              {loan.sureties?.length || 0}
                            </span>
                          </div>
                          {(isAdmin ||
                            isCommittee ||
                            loan.status === "active") && (
                            <button
                              className="mt-3 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition-all active:scale-95 dark:bg-primary-700"
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

                <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total Applications
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {loans.length}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Active Loans
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
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
            {suretiesLoading && sureties.length === 0 ? (
              <div className="flex justify-center rounded-2xl bg-white p-12 shadow-sm dark:bg-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  Loading sureties…
                </span>
              </div>
            ) : sureties.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 shadow-sm dark:bg-gray-800">
                <EmptyState icon="🤝" title="No surety obligations" />
              </div>
            ) : (
              <div className="space-y-3">
                {sureties.map((surety: any) => (
                  <div
                    key={surety.id}
                    className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
                          Loan #{surety.loan}
                        </span>
                        <span
                          className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            surety.status === "confirmed"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                              : surety.status === "pending"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                : surety.status === "declined"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {surety.status?.toUpperCase() || "PENDING"}
                        </span>
                      </div>
                    </div>

                    {(surety.borrower_name || surety.borrower_phone) && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-700/50">
                        <p className="font-semibold dark:text-white">
                          Borrower: {surety.borrower_name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Phone: {surety.borrower_phone || "Unknown"}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Loan amount:
                            </span>{" "}
                            <span className="font-semibold dark:text-white">
                              {formatNaira(surety.loan_amount || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Self‑surety (borrower):
                            </span>{" "}
                            <span className="font-semibold dark:text-white">
                              {formatNaira(surety.self_surety_amount || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Monthly repayment:
                            </span>{" "}
                            <span className="font-semibold dark:text-white">
                              {formatNaira(surety.repayment_monthly || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">
                              Duration:
                            </span>{" "}
                            <span className="font-semibold dark:text-white">
                              {surety.repayment_duration || 0} months
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Purpose: {surety.loan_purpose || "—"}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Amount Guaranteed
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatNaira(surety.amount_guaranteed)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Remaining Liability
                      </span>
                      <span
                        className={`font-semibold ${
                          parseFloat(surety.current_liability) > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {formatNaira(surety.current_liability)}
                      </span>
                    </div>

                    {surety.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        <button
                          className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-all active:scale-95 dark:bg-emerald-700"
                          onClick={() => confirmSurety.mutate(surety.id)}
                        >
                          ✓ Confirm
                        </button>
                        <button
                          className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-medium text-white transition-all active:scale-95 dark:bg-rose-700"
                          onClick={() => declineSurety.mutate(surety.id)}
                        >
                          ✗ Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total Commitments
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {sureties.length}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Pending Confirmations
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {
                        sureties.filter((s: any) => s.status === "pending")
                          .length
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          <p>🏦 SSC Cooperative — Islamic (Hijri) Calendar based system</p>
        </div>
      </div>
    </div>
  );
}
