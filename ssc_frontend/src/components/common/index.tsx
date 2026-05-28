// SSC Cooperative — Common Reusable Components

import { type ChangeEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  LoanStatus,
  MembershipStatus,
  SuretyStatus,
  SavingsChangeStatus,
} from "@/types";
import { LOAN_STATUS_LABELS, LOAN_STATUS_COLORS } from "@/types";

// Loading Spinner
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" }[size];
  return (
    <div
      className={`${s} border-2 border-primary-600 border-t-transparent rounded-full animate-spin`}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

// Empty State
export function EmptyState({
  icon = "📭",
  title,
  description,
}: {
  icon?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>
      )}
    </div>
  );
}

// Error Alert
export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-lg px-4 py-3">
      ⚠️ {message}
    </div>
  );
}

export function SuccessAlert({ message }: { message: string }) {
  return (
    <div className="bg-success-50 border border-green-200 text-success-700 text-sm rounded-lg px-4 py-3">
      ✅ {message}
    </div>
  );
}

type PageHeaderNavAction = {
  label?: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
};

function HeaderNavButton({
  action,
  defaultLabel,
  variant = "secondary",
}: {
  action: PageHeaderNavAction;
  defaultLabel: string;
  variant?: "secondary" | "primary";
}) {
  const label = action.label || defaultLabel;
  const className =
    variant === "primary" ? "btn-primary btn-sm" : "btn-secondary btn-sm";

  if (action.to) {
    return (
      <Link
        to={action.to}
        className={`${className} ${action.disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={`${className} ${action.disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {label}
    </button>
  );
}

// Page Header
export function PageHeader({
  title,
  subtitle,
  action,
  back,
  next,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: PageHeaderNavAction;
  next?: PageHeaderNavAction;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {(back || next) && (
          <div className="flex flex-wrap gap-2 items-center">
            {back && <HeaderNavButton action={back} defaultLabel="Back" />}
            {next && (
              <HeaderNavButton
                action={next}
                defaultLabel="Next"
                variant="primary"
              />
            )}
          </div>
        )}

        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Stat Card
export function StatCard({
  label,
  value,
  sub,
  color = "primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    primary: "border-primary-100 bg-primary-50 text-primary-700",
    success: "border-green-100 bg-success-50 text-success-700",
    warning: "border-yellow-100 bg-warning-50 text-warning-700",
    danger: "border-red-100 bg-danger-50 text-danger-700",
  };
  return (
    <div className={`card p-5 border ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

// Pagination
export function Pagination({
  count,
  page,
  pageSize = 50,
  onPage,
}: {
  count: number;
  page: number;
  pageSize?: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(count / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
      <span>
        Showing {Math.min((page - 1) * pageSize + 1, count)}–
        {Math.min(page * pageSize, count)} of {count}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="px-3 py-1">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// Currency formatter
export function formatNaira(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Status Badges
export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return (
    <span className={LOAN_STATUS_COLORS[status]}>
      {LOAN_STATUS_LABELS[status]}
    </span>
  );
}

export function MemberStatusBadge({ status }: { status: MembershipStatus }) {
  const map: Record<MembershipStatus, string> = {
    active: "badge-success",
    pending: "badge-warning",
    inactive: "badge-gray",
    exited: "badge-danger",
  };
  return (
    <span className={map[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function SuretyStatusBadge({ status }: { status: SuretyStatus }) {
  const map: Record<SuretyStatus, string> = {
    pending: "badge-warning",
    confirmed: "badge-success",
    declined: "badge-danger",
    released: "badge-gray",
    defaulted: "badge-danger",
  };
  return (
    <span className={map[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function ChangeStatusBadge({ status }: { status: SavingsChangeStatus }) {
  const map: Record<SavingsChangeStatus, string> = {
    pending: "badge-warning",
    approved: "badge-success",
    rejected: "badge-danger",
  };
  return (
    <span className={map[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Confirm Dialog
export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  danger = false,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={danger ? "btn-danger" : "btn-primary"}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal wrapper
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="btn-ghost p-1 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

// Hijri Month Selector
export function HijriMonthYearPicker({
  month,
  year,
  onMonthChange,
  onYearChange,
}: {
  month: number;
  year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}) {
  const months = [
    "Muharram",
    "Safar",
    "Rabi' al-Awwal",
    "Rabi' al-Thani",
    "Jumada al-Ula",
    "Jumada al-Akhira",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhul Qa'da",
    "Dhul Hijja",
  ];
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="label" htmlFor="hijri-month-select">
          Islamic Month
        </label>
        <select
          id="hijri-month-select"
          className="input"
          value={month}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onMonthChange(Number(e.target.value))
          }
        >
          {months.map((m, i) => (
            <option key={i + 1} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="w-28">
        <label className="label" htmlFor="hijri-year-input">
          Hijri Year
        </label>
        <input
          id="hijri-year-input"
          type="number"
          className="input"
          value={year}
          min={1440}
          max={1500}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onYearChange(Number(e.target.value))
          }
        />
      </div>
    </div>
  );
}

// Search Input
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        className="input pl-9 w-full max-w-xs"
      />
    </div>
  );
}
