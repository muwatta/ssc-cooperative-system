import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Membership Donu
interface MembershipData {
  active: number;
  pending: number;
  inactive: number;
  exited: number;
}

const MEMBERSHIP_COLORS = ["#16a34a", "#d97706", "#dc2626", "#6b7280"];

export function MembershipDonut({ data }: { data: MembershipData }) {
  const chartData = [
    { name: "Active", value: data.active },
    { name: "Pending", value: data.pending },
    { name: "Inactive", value: data.inactive },
    { name: "Exited", value: data.exited },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Membership Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={MEMBERSHIP_COLORS[i % MEMBERSHIP_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: any) => [
              `${value} (${Math.round((value / total) * 100)}%)`,
              name,
            ]}
            contentStyle={{
              backgroundColor: "var(--tw-bg-opacity, white)",
              border: "1px solid var(--tw-border-color, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--tw-text-color, #111827)",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--tw-text-color, #111827)",
                }}
              >
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
        {total} total members
      </p>
    </div>
  );
}

// Loan Status Donu──
interface LoanStatusData {
  submitted: number;
  under_review: number;
  pending_admin: number;
  active: number;
  completed: number;
  rejected: number;
  defaulted: number;
}

const LOAN_COLORS = [
  "#8b5cf6",
  "#f59e0b",
  "#3b82f6",
  "#16a34a",
  "#06b6d4",
  "#ef4444",
  "#dc2626",
];

export function LoanStatusDonut({ data }: { data: LoanStatusData }) {
  const chartData = [
    { name: "Submitted", value: data.submitted },
    { name: "Under Review", value: data.under_review },
    { name: "Pending Admin", value: data.pending_admin },
    { name: "Active", value: data.active },
    { name: "Completed", value: data.completed },
    { name: "Rejected", value: data.rejected },
    { name: "Defaulted", value: data.defaulted },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);
  if (total === 0)
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex items-center justify-center h-[280px]">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No loan data yet
        </p>
      </div>
    );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Loan Status Distribution
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={LOAN_COLORS[i % LOAN_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: any) => [
              `${value} (${Math.round((value / total) * 100)}%)`,
              name,
            ]}
            contentStyle={{
              backgroundColor: "var(--tw-bg-opacity, white)",
              border: "1px solid var(--tw-border-color, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--tw-text-color, #111827)",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--tw-text-color, #111827)",
                }}
              >
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
        {total} total loans
      </p>
    </div>
  );
}

// Financial Bar Char
interface FinancialMember {
  file_number: string;
  full_name: string;
  available_balance: string;
  outstanding_loan: string;
  special_savings: string;
}

const formatNairaShort = (value: number) => {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(0)}K`;
  return `₦${value}`;
};

export function FinancialBarChart({ data }: { data: FinancialMember[] }) {
  if (!data || data.length === 0) return null;

  const chartData = data.slice(0, 10).map((m) => ({
    name: m.file_number,
    fullName: m.full_name,
    available: parseFloat(m.available_balance),
    outstanding: parseFloat(m.outstanding_loan),
    special: parseFloat(m.special_savings),
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Member Financial Overview
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Top {Math.min(data.length, 10)} members
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--tw-text-color, #111827)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatNairaShort}
            tick={{ fontSize: 10, fill: "var(--tw-text-color, #111827)" }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value: any, name: any) => [
              `₦${Number(value).toLocaleString("en-NG")}`,
              name === "available"
                ? "Available"
                : name === "outstanding"
                  ? "Outstanding Loan"
                  : "Special Savings",
            ]}
            labelFormatter={(label: any, payload: any) => {
              const item = payload?.[0]?.payload;
              return item ? `${item.fullName} (${label})` : label;
            }}
            contentStyle={{
              backgroundColor: "var(--tw-bg-opacity, white)",
              border: "1px solid var(--tw-border-color, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--tw-text-color, #111827)",
            }}
          />
          <Legend
            iconType="square"
            iconSize={8}
            formatter={(value) => (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--tw-text-color, #111827)",
                }}
              >
                {value === "available"
                  ? "Available"
                  : value === "outstanding"
                    ? "Outstanding"
                    : "Special"}
              </span>
            )}
          />
          <Bar dataKey="available" fill="#16a34a" radius={[3, 3, 0, 0]} />
          <Bar dataKey="outstanding" fill="#ef4444" radius={[3, 3, 0, 0]} />
          <Bar dataKey="special" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Cooperative Totals Bar
interface CoopTotals {
  total_savings: string;
  total_outstanding: string;
  total_special_savings: string;
}

export function CoopTotalsChart({ data }: { data: CoopTotals }) {
  const chartData = [
    {
      name: "Savings Pool",
      value: parseFloat(data.total_savings) || 0,
      fill: "#16a34a",
    },
    {
      name: "Outstanding Loans",
      value: parseFloat(data.total_outstanding) || 0,
      fill: "#ef4444",
    },
    {
      name: "Special Savings",
      value: parseFloat(data.total_special_savings) || 0,
      fill: "#8b5cf6",
    },
  ];

  const total = chartData.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Cooperative Financial Summary
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatNairaShort}
            tick={{ fontSize: 10, fill: "var(--tw-text-color, #111827)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--tw-text-color, #111827)" }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            formatter={(value: any) => [
              `₦${Number(value).toLocaleString("en-NG")}`,
              "Amount",
            ]}
            contentStyle={{
              backgroundColor: "var(--tw-bg-opacity, white)",
              border: "1px solid var(--tw-border-color, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--tw-text-color, #111827)",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
