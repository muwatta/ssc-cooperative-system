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
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <PageHeader
        title="Financial Reconciliation"
        subtitle="Verify that total credits match total debits for a given period."
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow p-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label text-xs">Hijri Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
            title="Hijri month"
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
            className="input w-28"
            placeholder="Year"
          />
        </div>
        <button onClick={() => refetch()} className="btn-primary">
          Apply
        </button>
      </div>

      {/* Results */}
      {isLoading ? (
        <PageLoader />
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-sm text-gray-500">Total Credits</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {formatNaira(data.total_credit)}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-sm text-gray-500">Total Debits</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {formatNaira(data.total_debit)}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-sm text-gray-500">
              {data.is_balanced ? "✅ Balanced" : "⚠️ Difference"}
            </p>
            <p
              className={`text-3xl font-bold mt-2 ${
                data.is_balanced ? "text-gray-900" : "text-amber-600"
              }`}
            >
              {formatNaira(data.difference)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Select a period and click Apply.</p>
      )}
    </div>
  );
}
