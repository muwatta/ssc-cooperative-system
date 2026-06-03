import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PageHeader, formatNaira } from "@/components/common";

export default function LoanSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { amount?: string; loanId?: number } | null;
  const amount = state?.amount;

  useEffect(() => {
    if (!state) {
      navigate("/my-loans", { replace: true });
    }
  }, [navigate, state]);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <PageHeader
        title="Congratulations!"
        subtitle="Your loan application is now submitted and under review."
        back={{ to: "/my-loans", label: "Back to My Loans" }}
      />

      <div className="rounded-3xl border border-green-100 bg-green-50 p-8 shadow-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/90 text-6xl shadow-xl ring-2 ring-green-200 animate-bounce">
            🎉
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-green-800">
            Loan request received
          </h2>
          <p className="mt-2 text-gray-700">
            Our committee will review your application and get back to you soon.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            You may exit now or continue with another process.
          </p>
        </div>

        {amount && (
          <div className="rounded-2xl border border-green-200 bg-white p-6 text-center shadow-sm transition duration-500 ease-out hover:scale-[1.01]">
            <p className="text-sm uppercase tracking-wide text-gray-500">
              Requested Amount
            </p>
            <p className="mt-2 text-4xl font-bold text-green-900">
              {formatNaira(Number(amount))}
            </p>
          </div>
        )}
        {state?.loanId && (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-100/80 p-4 text-center text-sm text-green-800">
            Reference: <strong>#{state.loanId}</strong>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/my-loans"
            className="inline-flex items-center justify-center rounded-lg border border-green-700 bg-white px-6 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-50"
          >
            View my loan status
          </Link>
          <Link
            to="/loans/apply"
            className="inline-flex items-center justify-center rounded-lg bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            Submit another request
          </Link>
        </div>
      </div>
    </div>
  );
}
