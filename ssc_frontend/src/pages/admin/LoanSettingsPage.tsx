import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loansApi } from "@/api/services";
import type { LoanSettings } from "@/types";
import {
  PageHeader,
  PageLoader,
  ErrorAlert,
  SuccessAlert,
} from "@/components/common";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-panel p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

function SliderField({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {description}
      </p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600 dark:accent-primary-500"
          aria-label={label}
        />
        <span className="text-sm font-semibold w-20 text-right text-gray-900 dark:text-white">
          {value} {unit}
        </span>
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          checked
            ? "bg-primary-600 dark:bg-primary-500"
            : "bg-gray-300 dark:bg-gray-600"
        }`}
        aria-label={label}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function LoanSettingsPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery<LoanSettings>({
    queryKey: ["loan-settings"],
    queryFn: () => loansApi.settings().then((r) => r.data),
  });

  const [form, setForm] = useState<LoanSettings | null>(null);

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: Partial<LoanSettings>) => loansApi.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (isLoading || !form) return <PageLoader />;

  const update = (key: keyof LoanSettings, value: any) => {
    setForm({ ...form, [key]: value });
  };

  const handleSave = () => {
    mutation.mutate(form);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <PageHeader
        title="Loan Rules"
        subtitle="Adjust these settings anytime—no code required."
        back={{ to: "/members", label: "Back to Members" }}
      />

      {saved && <SuccessAlert message="Rules saved successfully." />}
      {mutation.isError && (
        <ErrorAlert message="Failed to save. Please try again." />
      )}

      {/* ---- 1. ELIGIBILITY ---- */}
      <Card title="📅 When can a member apply?">
        <div className="grid gap-4 sm:grid-cols-2">
          <SliderField
            label="Minimum savings months"
            description="How many months must a member save consecutively?"
            value={form.consecutive_savings_months_required}
            min={0}
            max={24}
            step={1}
            unit="months"
            onChange={(v) => update("consecutive_savings_months_required", v)}
          />
          <ToggleField
            label="Require no active loan"
            description="Prevent members with an existing active loan from applying."
            checked={form.require_no_active_loan}
            onChange={(v) => update("require_no_active_loan", v)}
          />
          <ToggleField
            label="Require no surety liabilities"
            description="Block members who are currently guaranteeing another loan."
            checked={form.require_no_surety_liabilities}
            onChange={(v) => update("require_no_surety_liabilities", v)}
          />
          <SliderField
            label="Max loans per year"
            description="How many approved loans can a member have in one calendar year?"
            value={form.max_loans_per_year}
            min={1}
            max={10}
            step={1}
            unit="loans"
            onChange={(v) => update("max_loans_per_year", v)}
          />
        </div>
      </Card>

      {/* ---- 2. BORROWING LIMITS ---- */}
      <Card title="💰 How much can members borrow?">
        <div className="grid gap-4 sm:grid-cols-2">
          <SliderField
            label="Self‑surety ratio"
            description="Maximum % of a member's available savings they can borrow without external sureties."
            value={form.self_surety_ratio * 100}
            min={10}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => update("self_surety_ratio", v / 100)}
          />
          <SliderField
            label="Absolute borrowing cap"
            description="Absolute maximum % of available savings a member can ever borrow."
            value={form.max_borrowable_ratio * 100}
            min={10}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => update("max_borrowable_ratio", v / 100)}
          />
          <SliderField
            label="Minimum loan amount"
            description="Smallest loan amount members can request."
            value={form.min_loan_amount}
            min={0}
            max={50000}
            step={1000}
            unit="₦"
            onChange={(v) => update("min_loan_amount", v)}
          />
          <SliderField
            label="Maximum loan amount"
            description="Largest loan amount allowed (0 = no limit)."
            value={form.max_loan_amount}
            min={0}
            max={500000}
            step={5000}
            unit="₦"
            onChange={(v) => update("max_loan_amount", v)}
          />
        </div>
      </Card>

      {/* ---- 3. REPAYMENT ---- */}
      <Card title="📆 Repayment Rules">
        <SliderField
          label="Maximum repayment months"
          description="Longest allowed repayment period."
          value={form.max_repayment_months}
          min={1}
          max={24}
          step={1}
          unit="months"
          onChange={(v) => update("max_repayment_months", v)}
        />
      </Card>

      {/* ---- 4. SURETIES ---- */}
      <Card title="🤝 Surety Rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <SliderField
            label="Max external sureties"
            description="How many people can guarantee one loan?"
            value={form.max_sureties}
            min={1}
            max={10}
            step={1}
            unit="people"
            onChange={(v) => update("max_sureties", v)}
          />
          <SliderField
            label="Surety guarantee limit"
            description="Maximum % of a surety's available balance they can commit."
            value={form.external_surety_max_ratio * 100}
            min={10}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => update("external_surety_max_ratio", v / 100)}
          />
        </div>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="btn-primary px-8 py-3 text-base"
        >
          {mutation.isPending ? "Saving…" : "Save Loan Rules"}
        </button>
      </div>
    </div>
  );
}
