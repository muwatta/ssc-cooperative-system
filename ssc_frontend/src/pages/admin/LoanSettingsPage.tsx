import { type ChangeEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loansApi } from "@/api/services";
import type { LoanSettings } from "@/types";
import {
  PageHeader,
  PageLoader,
  ErrorAlert,
  SuccessAlert,
} from "@/components/common";

export default function LoanSettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<LoanSettings>({
    consecutive_savings_months_required: 12,
    max_loans_per_year: 4,
    max_repayment_months: 6,
    self_surety_ratio: 0.75,
    max_sureties: 5,
    min_loan_amount: 1000,
    max_loan_amount: 0,
    require_no_active_loan: true,
    require_no_surety_liabilities: true,
  });
  const [serverMessage, setServerMessage] = useState("");
  const [serverError, setServerError] = useState("");

  // Use React Query v5 – no onSuccess/onError in options
  const { data, isLoading, isError } = useQuery({
    queryKey: ["loan-settings"],
    queryFn: () => loansApi.settings().then((response) => response.data),
  });

  // Sync fetched data to local state
  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data]);

  // Mutation for updating settings – v5 uses `isPending`
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<LoanSettings>) =>
      loansApi.updateSettings(payload).then((response) => response.data),
    onSuccess: (updatedData) => {
      setSettings(updatedData);
      setServerMessage("Loan rules updated successfully.");
      setServerError("");
      queryClient.invalidateQueries({ queryKey: ["loan-settings"] });
    },
    onError: () => {
      setServerError("Unable to save loan rules. Please try again.");
      setServerMessage("");
    },
  });

  const handleChange =
    (field: keyof LoanSettings) => (event: ChangeEvent<HTMLInputElement>) => {
      const value =
        event.target.type === "checkbox"
          ? event.target.checked
          : Number(event.target.value);

      setSettings((current) => ({
        ...current,
        [field]: Number.isNaN(value) ? 0 : value,
      }));
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError("");
    setServerMessage("");
    updateMutation.mutate({
      consecutive_savings_months_required:
        settings.consecutive_savings_months_required,
      max_loans_per_year: settings.max_loans_per_year,
      max_repayment_months: settings.max_repayment_months,
      self_surety_ratio: settings.self_surety_ratio,
      max_sureties: settings.max_sureties,
      min_loan_amount: settings.min_loan_amount,
      max_loan_amount: settings.max_loan_amount,
      require_no_active_loan: settings.require_no_active_loan,
      require_no_surety_liabilities: settings.require_no_surety_liabilities,
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <PageHeader
        title="Loan Rules"
        subtitle="Control loan eligibility, minimum/maximum limits, surety rules, and repayment terms."
        back={{ to: "/members", label: "Back to Members" }}
      />

      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 shadow-sm">
        <p className="font-semibold text-gray-900">Loan settings overview</p>
        <p className="mt-2">
          These rules determine which members can apply for loans and how loans
          are structured. Use this panel to update the required savings history,
          repayment limits, loan amount boundaries, and surety requirements
          without a code change.
        </p>
      </div>

      {serverMessage && (
        <div className="mb-6 animate-fade-in">
          <SuccessAlert message={serverMessage} />
        </div>
      )}
      {serverError && (
        <div className="mb-6 animate-fade-in">
          <ErrorAlert message={serverError} />
        </div>
      )}
      {isError && !data && (
        <div className="mb-6">
          <ErrorAlert message="Unable to load loan settings. Refresh the page to retry." />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="consecutive_savings_months_required"
            className="label"
          >
            Consecutive Savings Months Required
          </label>
          <input
            id="consecutive_savings_months_required"
            type="number"
            min={0}
            value={settings.consecutive_savings_months_required}
            onChange={handleChange("consecutive_savings_months_required")}
            className="input w-full"
            aria-label="Consecutive savings months required"
            title="Consecutive savings months required"
          />
          <p className="mt-2 text-sm text-gray-500">
            Members must meet this number of consecutive savings months before
            applying for a loan.
          </p>
        </div>

        <div>
          <label htmlFor="max_loans_per_year" className="label">
            Maximum Approved Loans Per Year
          </label>
          <input
            id="max_loans_per_year"
            type="number"
            min={1}
            value={settings.max_loans_per_year}
            onChange={handleChange("max_loans_per_year")}
            className="input w-full"
            aria-label="Maximum approved loans per year"
            title="Maximum approved loans per year"
          />
          <p className="mt-2 text-sm text-gray-500">
            The maximum number of approved loans a member may have in a calendar
            year.
          </p>
        </div>

        <div>
          <label htmlFor="max_repayment_months" className="label">
            Maximum Repayment Months
          </label>
          <input
            id="max_repayment_months"
            type="number"
            min={1}
            value={settings.max_repayment_months}
            onChange={handleChange("max_repayment_months")}
            className="input w-full"
            aria-label="Maximum repayment months"
            title="Maximum repayment months"
          />
          <p className="mt-2 text-sm text-gray-500">
            Maximum allowed repayment duration for loan applications.
          </p>
        </div>

        <div>
          <label htmlFor="self_surety_ratio" className="label">
            Maximum Borrow Ratio
          </label>
          <input
            id="self_surety_ratio"
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={settings.self_surety_ratio}
            onChange={handleChange("self_surety_ratio")}
            className="input w-full"
            aria-label="Maximum borrow ratio (decimal between 0 and 1)"
            title="Maximum borrow ratio"
          />
          <p className="mt-2 text-sm text-gray-500">
            Fraction of available balance a member may borrow, expressed as a
            decimal between 0 and 1.
          </p>
        </div>

        <div>
          <label htmlFor="max_sureties" className="label">
            Maximum Sureties
          </label>
          <input
            id="max_sureties"
            type="number"
            min={0}
            value={settings.max_sureties}
            onChange={handleChange("max_sureties")}
            className="input w-full"
            aria-label="Maximum number of sureties"
            title="Maximum number of sureties"
          />
          <p className="mt-2 text-sm text-gray-500">
            Maximum number of surety members allowed on a loan application.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="min_loan_amount" className="label">
              Minimum Loan Amount
            </label>
            <input
              id="min_loan_amount"
              type="number"
              min={0}
              step={0.01}
              value={settings.min_loan_amount}
              onChange={handleChange("min_loan_amount")}
              className="input w-full"
              aria-label="Minimum loan amount"
              title="Minimum loan amount"
            />
            <p className="mt-2 text-sm text-gray-500">
              The minimum loan amount members may request.
            </p>
          </div>

          <div>
            <label htmlFor="max_loan_amount" className="label">
              Maximum Loan Amount
            </label>
            <input
              id="max_loan_amount"
              type="number"
              min={0}
              step={0.01}
              value={settings.max_loan_amount}
              onChange={handleChange("max_loan_amount")}
              className="input w-full"
              aria-label="Maximum loan amount (0 = no cap)"
              title="Maximum loan amount"
            />
            <p className="mt-2 text-sm text-gray-500">Set to 0 for no cap.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <input
              id="require_no_active_loan"
              type="checkbox"
              checked={settings.require_no_active_loan}
              onChange={handleChange("require_no_active_loan")}
              className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              aria-label="Require no active loan before applying"
            />
            <span>
              Require no active loan before applying
              <span className="block text-sm text-gray-500">
                If enabled, members must clear any active loan before submitting
                a new application.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <input
              id="require_no_surety_liabilities"
              type="checkbox"
              checked={settings.require_no_surety_liabilities}
              onChange={handleChange("require_no_surety_liabilities")}
              className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              aria-label="Require no active surety liability"
            />
            <span>
              Require no active surety liability
              <span className="block text-sm text-gray-500">
                If enabled, members with existing surety commitments cannot
                apply.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="btn-primary"
        >
          {updateMutation.isPending ? "Saving..." : "Save Loan Rules"}
        </button>
      </form>
    </div>
  );
}
