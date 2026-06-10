import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { PageHeader, PageLoader } from "@/components/common";
import { HIJRI_MONTHS } from "@/types";

function formatNaira(value: string | number) {
  const n = Number(value);
  return Number.isNaN(n)
    ? "₦0.00"
    : `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReconciliationPage() {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reconciliation", month, year],
    queryFn: () =>
      api
        .get("/savings/reconciliation/", {
          params: {
            hijri_month: month || undefined,
            hijri_year: year || undefined,
          },
        })
        .then((r) => r.data),
    staleTime: 0,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reconciliation"
        subtitle="Verify that total credits match total debits for a given period."
      />

      {/* Filters card */}
      <div className="card-panel p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label text-xs">Hijri Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input w-48"
              title="Filter by Hijri month"
            >
              <option value="">All months</option>
              {HIJRI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Hijri Year</label>
            <input
              type="number"
              min={1400}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="input w-32"
              placeholder="Year"
            />
          </div>
          <button onClick={() => refetch()} className="btn-primary">
            Apply
          </button>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <PageLoader />
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Credits Card */}
          <div className="card-panel p-3 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 border border-green-100 dark:border-green-800/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Total Credits
              </p>
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-2">
              {formatNaira(data.total_credit)}
            </p>
          </div>

          {/* Debits Card */}
          <div className="card-panel p-3 bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 border border-red-100 dark:border-red-800/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Total Debits
              </p>
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </div>
            <p className="text-3xl font-bold text-red-700 dark:text-red-400 mt-2">
              {formatNaira(data.total_debit)}
            </p>
          </div>

          {/* Difference / Balance Card */}
          <div
            className={`card-panel p-3 bg-gradient-to-br ${
              data.is_balanced
                ? "from-primary-50 to-white dark:from-primary-900/20 dark:to-gray-800 border-primary-100 dark:border-primary-800/50"
                : "from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800 border-amber-100 dark:border-amber-800/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {data.is_balanced ? "✅ Balanced" : "⚠️ Difference"}
              </p>
              {!data.is_balanced && (
                <svg
                  className="w-5 h-5 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              )}
            </div>
            <p
              className={`text-3xl font-bold mt-2 ${
                data.is_balanced
                  ? "text-gray-900 dark:text-white"
                  : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {formatNaira(data.difference)}
            </p>
          </div>
        </div>
      ) : (
        <div className="card-panel p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Select a period and click Apply.
          </p>
        </div>
      )}
    </div>
  );
}
