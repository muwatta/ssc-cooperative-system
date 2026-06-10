import { useState, useEffect } from "react";
import { membersApi, savingsApi } from "@/api/services";
import type { MemberProfile, MemberBalance } from "@/types";
import { HIJRI_MONTHS } from "@/types";

function formatNaira(v: string | number) {
  const n = Number(v);
  return `₦${n.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PostSpecialSavingsPage() {
  const [specialMembers, setSpecialMembers] = useState<MemberProfile[]>([]);
  const [balances, setBalances] = useState<Record<number, MemberBalance>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(
    null,
  );

  // Post fields
  const [amount, setAmount] = useState("");
  const [hijriMonth, setHijriMonth] = useState(1);
  const [hijriYear, setHijriYear] = useState(1446);
  const [details, setDetails] = useState("");
  const [posting, setPosting] = useState(false);

  // Withdrawal fields
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    data?: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    membersApi
      .list({ membership_status: "active" })
      .then(async (r) => {
        const all = r.data.results;
        const special = all.filter((m) => m.is_special_saver);
        setSpecialMembers(special);

        const results = await Promise.allSettled(
          special.map((m) => savingsApi.getBalance(m.id)),
        );
        const map: Record<number, MemberBalance> = {};
        results.forEach((res, idx) => {
          if (res.status === "fulfilled") {
            map[special[idx].id] = res.value.data;
          }
        });
        setBalances(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = specialMembers.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.file_number.toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q)
    );
  });

  const handleSelect = (member: MemberProfile) => {
    setSelectedMember(member);
    setAmount("");
    setDetails("");
    setWithdrawAmount("");
    setResult(null);
  };

  const selectedBalance = selectedMember ? balances[selectedMember.id] : null;
  const maxAmount = selectedBalance
    ? Number(selectedBalance.available_balance)
    : 0;
  const enteredAmount = Number(amount);
  const amountValid = enteredAmount > 0 && enteredAmount <= maxAmount;

  const handlePost = async () => {
    if (!selectedMember || !amount) return;
    setPosting(true);
    setResult(null);
    try {
      const res = await savingsApi.postSpecialSavings({
        member_id: selectedMember.id,
        amount,
        hijri_month: hijriMonth,
        hijri_year: hijriYear,
        details,
      });
      setResult({
        type: "success",
        message: res.data.message,
        data: {
          "Special Savings": formatNaira(res.data.special_savings),
          "Total Savings": formatNaira(res.data.total_savings),
          "Available Balance": formatNaira(res.data.available_balance),
        },
      });
      const updated = await savingsApi.getBalance(selectedMember.id);
      setBalances((prev) => ({
        ...prev,
        [selectedMember.id]: updated.data,
      }));
      setAmount("");
      setDetails("");
      setWithdrawAmount("");
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        "Failed to post special savings. Please try again.";
      setResult({ type: "error", message: msg });
    } finally {
      setPosting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedMember) return;
    const wAmount = Number(withdrawAmount);
    const specialBal = Number(selectedBalance?.special_savings || 0);
    if (wAmount <= 0 || wAmount > specialBal) {
      alert("Invalid amount. Must be between 1 and current special savings.");
      return;
    }
    setWithdrawing(true);
    try {
      const res = await savingsApi.withdrawSpecialSavings({
        member_id: selectedMember.id,
        amount: withdrawAmount,
        hijri_month: hijriMonth,
        hijri_year: hijriYear,
      });
      setResult({ type: "success", message: res.data.message });
      const updated = await savingsApi.getBalance(selectedMember.id);
      setBalances((prev) => ({ ...prev, [selectedMember.id]: updated.data }));
      setWithdrawAmount("");
    } catch (err: any) {
      setResult({
        type: "error",
        message: err?.response?.data?.error || "Withdrawal failed",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="page-title">Post Special Fixed Savings</h1>
        <p className="page-subtitle">
          Move funds from a special saver's available balance into their locked
          special savings pool. Only members flagged as special savers appear
          here.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT — member selector */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Select Member
          </h2>

          <input
            type="text"
            placeholder="Search by name or file number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input mb-3"
            aria-label="Search special savers"
          />

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-gray-200 py-10 text-center text-gray-400 text-sm">
              <p className="text-2xl mb-2">🔒</p>
              {specialMembers.length === 0
                ? "No special savers found. Enable special saver status on a member first."
                : "No members match your search."}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filtered.map((m) => {
                const bal = balances[m.id];
                const isSelected = selectedMember?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      isSelected
                        ? "border-primary-400 bg-primary-50 ring-1 ring-primary-300"
                        : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {m.full_name}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">
                          {m.file_number} · {m.school_branch}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {bal ? (
                          <>
                            <p className="text-xs text-gray-400">Available</p>
                            <p className="text-sm font-bold text-green-700">
                              {formatNaira(bal.available_balance)}
                            </p>
                            {Number(bal.special_savings ?? 0) > 0 && (
                              <p className="text-xs text-purple-600 font-medium mt-0.5">
                                🔒 {formatNaira(bal.special_savings ?? 0)}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-gray-300">Loading…</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — posting & withdrawal form */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Post Special Savings
          </h2>

          {!selectedMember ? (
            <div className="flex h-48 items-center justify-center text-gray-400 text-sm text-center">
              <div>
                <p className="text-3xl mb-2">👈</p>
                Select a member to post special savings
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Member summary */}
              <div className="rounded-lg bg-primary-50 border border-primary-100 p-3 text-sm">
                <p className="font-semibold text-primary-800">
                  {selectedMember.full_name}
                  <span className="ml-2 font-mono text-primary-500 text-xs">
                    {selectedMember.file_number}
                  </span>
                </p>
                {selectedBalance && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-primary-700">
                    <span>
                      Total savings:{" "}
                      <strong>
                        {formatNaira(selectedBalance.total_savings)}
                      </strong>
                    </span>
                    <span>
                      Available:{" "}
                      <strong className="text-green-700">
                        {formatNaira(selectedBalance.available_balance)}
                      </strong>
                    </span>
                    <span>
                      Committed:{" "}
                      <strong>
                        {formatNaira(selectedBalance.suretyship_committed)}
                      </strong>
                    </span>
                    <span>
                      Special:{" "}
                      <strong className="text-purple-700">
                        {formatNaira(selectedBalance.special_savings ?? 0)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Withdrawal section (if special savings > 0) */}
              {selectedBalance &&
                Number(selectedBalance.special_savings) > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                      Withdraw from Special Savings
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="label text-xs">
                          Amount to withdraw (₦)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          max={Number(selectedBalance.special_savings ?? 0)}
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="input"
                          aria-label="Withdrawal amount"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Max:{" "}
                          {formatNaira(selectedBalance.special_savings ?? 0)}
                        </p>
                      </div>
                      <button
                        onClick={handleWithdraw}
                        disabled={withdrawing || !withdrawAmount}
                        className="btn-secondary w-full"
                      >
                        {withdrawing
                          ? "Withdrawing..."
                          : "💰 Withdraw from Special Savings"}
                      </button>
                    </div>
                  </div>
                )}

              {/* Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Islamic Month</label>
                  <select
                    value={hijriMonth}
                    onChange={(e) => setHijriMonth(Number(e.target.value))}
                    className="input"
                    aria-label="Hijri month"
                  >
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
                    value={hijriYear}
                    onChange={(e) => setHijriYear(Number(e.target.value))}
                    className="input"
                    min={1400}
                    aria-label="Hijri year"
                  />
                </div>
              </div>

              {/* Amount to lock */}
              <div>
                <label className="label text-xs">
                  Amount to lock (₦)
                  {selectedBalance && (
                    <span className="ml-2 text-gray-400 font-normal">
                      max {formatNaira(selectedBalance.available_balance)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={maxAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`input ${
                    amount && !amountValid
                      ? "border-danger-400 focus:ring-danger-400"
                      : ""
                  }`}
                  placeholder="Enter amount to lock into special savings"
                  aria-label="Amount to lock"
                />
                {amount && !amountValid && (
                  <p className="text-xs text-danger-700 mt-1">
                    {enteredAmount <= 0
                      ? "Amount must be positive."
                      : `Exceeds available balance of ${formatNaira(maxAmount)}.`}
                  </p>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="label text-xs">
                  Note{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="input"
                  placeholder="e.g. End-of-year fixed deposit"
                  maxLength={200}
                  aria-label="Note"
                />
              </div>

              {/* Result message */}
              {result && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    result.type === "success"
                      ? "border-green-200 bg-success-50 text-success-700"
                      : "border-danger-200 bg-danger-50 text-danger-700"
                  }`}
                >
                  <p className="font-medium">
                    {result.type === "success" ? "✅" : "⚠️"} {result.message}
                  </p>
                  {result.data && (
                    <div className="mt-2 space-y-0.5 text-xs">
                      {Object.entries(result.data).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-gray-500">{k}:</span>
                          <span className="font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Post button */}
              <button
                onClick={handlePost}
                disabled={!amountValid || posting}
                className="btn-primary w-full disabled:opacity-40"
              >
                {posting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting…
                  </span>
                ) : (
                  "🔒 Lock into Special Savings"
                )}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Locking deducts from available balance and adds to special
                savings. Withdrawing does the opposite.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
