import { useState, useEffect, useCallback } from "react";
import { membersApi, savingsApi, loansApi } from "@/api/services";
import type { MemberProfile, MemberBalance, LoanApplication } from "@/types";
import { HIJRI_MONTHS } from "@/types";

function formatNaira(v: string | number) {
  const n = Number(v);
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PeriodState {
  hijri_month: number;
  hijri_year: number;
}

interface MemberPostState {
  amount: string;
  editReason: string;
  isEdited: boolean;
  status: "idle" | "posting" | "success" | "error";
  message: string;
}

// ---------- Member Savings Card (now includes loan & surety details) ----------
function MemberSavingsCard({
  member,
  state,
  balance,
  activeLoan,
  onChange,
  onPost,
}: {
  member: MemberProfile;
  state: MemberPostState;
  balance?: MemberBalance;
  activeLoan?: LoanApplication;
  onChange: (updates: Partial<MemberPostState>) => void;
  onPost: () => void;
}) {
  const approved = Number(member.approved_monthly_contribution);
  const entered = Number(state.amount);
  const differs = Math.abs(entered - approved) > 0.009;
  const needsReason = differs && state.isEdited;
  const canPost =
    state.amount &&
    Number(state.amount) >= 1000 &&
    (!needsReason || state.editReason.trim().length > 0);

  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={`card overflow-hidden transition-all ${
        state.status === "success"
          ? "ring-2 ring-green-300"
          : state.status === "error"
            ? "ring-2 ring-danger-300"
            : ""
      }`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shrink-0">
            {member.full_name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {member.full_name}
            </p>
            <p className="text-xs text-gray-400 font-mono">
              {member.file_number} · {member.school_branch}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Approved monthly</p>
          <p className="font-bold text-primary-700">{formatNaira(approved)}</p>
        </div>
      </div>

      <div className="px-5 py-4">
        {state.status === "success" ? (
          <div className="flex items-center gap-2 text-success-700 text-sm py-2">
            <span className="text-lg">✓</span>
            <span>{state.message}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="label text-xs">
                  Amount (₦)
                  {differs && state.isEdited && (
                    <span className="ml-2 text-warning-700 font-medium">
                      ⚠ Differs from approved {formatNaira(approved)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1000"
                    value={state.amount}
                    onChange={(e) =>
                      onChange({
                        amount: e.target.value,
                        isEdited: Number(e.target.value) !== approved,
                      })
                    }
                    className={`input pr-24 ${
                      differs && state.isEdited
                        ? "border-warning-400 focus:ring-warning-400"
                        : ""
                    }`}
                    aria-label="Monthly savings amount in Naira"
                    title="Monthly savings amount"
                  />
                  {differs && state.isEdited && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          amount: String(approved),
                          isEdited: false,
                          editReason: "",
                        })
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary-600 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onPost}
                disabled={!canPost || state.status === "posting"}
                className="btn-primary shrink-0 px-5 py-2 disabled:opacity-40"
              >
                {state.status === "posting" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting
                  </span>
                ) : (
                  "Post"
                )}
              </button>
            </div>

            {needsReason && (
              <div>
                <label className="label text-xs text-warning-700">
                  Reason for adjustment *{" "}
                  <span className="text-gray-400 font-normal">
                    (visible to member)
                  </span>
                </label>
                <input
                  type="text"
                  value={state.editReason}
                  onChange={(e) => onChange({ editReason: e.target.value })}
                  className="input border-warning-300 focus:ring-warning-400"
                  placeholder="e.g. Loan repayment deduction applied..."
                  maxLength={200}
                  aria-label="Reason for adjustment"
                  title="Reason for adjustment"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {state.editReason.length}/200 chars
                </p>
              </div>
            )}

            {state.status === "error" && (
              <p className="text-sm text-danger-700">⚠ {state.message}</p>
            )}

            {/* Toggle details */}
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              {showDetails ? "▲ Hide Details" : "▼ Show Details"}
            </button>

            {showDetails && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2 border border-gray-100">
                {/* Loan info */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Active Loan
                  </p>
                  {activeLoan ? (
                    <div className="mt-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Approved:</span>
                        <span className="font-medium">
                          {formatNaira(
                            activeLoan.amount_approved ||
                              activeLoan.amount_applied,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Outstanding:</span>
                        <span className="font-medium text-amber-600">
                          {formatNaira(activeLoan.outstanding_balance)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Monthly Repay:</span>
                        <span>
                          {formatNaira(activeLoan.proposed_monthly_repayment)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span className="capitalize font-medium text-emerald-600">
                          {activeLoan.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 mt-1">No active loan</p>
                  )}
                </div>

                {/* Surety info */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Surety Commitment
                  </p>
                  {balance && parseFloat(balance.suretyship_committed) > 0 ? (
                    <p className="mt-1 font-medium text-purple-600">
                      {formatNaira(balance.suretyship_committed)}
                    </p>
                  ) : (
                    <p className="text-gray-400 mt-1">None</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1 text-xs text-gray-400">
              <span
                className={
                  member.consecutive_savings_months >= 6
                    ? "text-success-700"
                    : "text-warning-700"
                }
              >
                {member.consecutive_savings_months}/6 months
              </span>
              <span>·</span>
              <span>
                {member.is_loan_eligible
                  ? "✓ Loan eligible"
                  : "Not yet loan eligible"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function PostSavingsPage() {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodState>({
    hijri_month: 1,
    hijri_year: 1446,
  });
  const [postStates, setPostStates] = useState<Record<number, MemberPostState>>(
    {},
  );
  const [globalMsg, setGlobalMsg] = useState("");
  const [postAllPending, setPostAllPending] = useState(false);

  // Additional data: balances & active loans
  const [balances, setBalances] = useState<Record<number, MemberBalance>>({});
  const [activeLoansMap, setActiveLoansMap] = useState<
    Record<number, LoanApplication>
  >({});
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    membersApi
      .list({ membership_status: "active" })
      .then((r) => {
        const data = r.data.results;
        setMembers(data);
        const initial: Record<number, MemberPostState> = {};
        data.forEach((m) => {
          initial[m.id] = {
            amount: m.approved_monthly_contribution,
            editReason: "",
            isEdited: false,
            status: "idle",
            message: "",
          };
        });
        setPostStates(initial);
        // After members load, fetch balances & active loans
        fetchDetails(data);
      })
      .catch(() => setGlobalMsg("Unable to load members."))
      .finally(() => setLoading(false));
  }, []);

  const fetchDetails = async (members: MemberProfile[]) => {
    setDetailsLoading(true);
    try {
      // Fetch balances
      const balanceResults = await Promise.allSettled(
        members.map((m) => savingsApi.getBalance(m.id)),
      );
      const balanceMap: Record<number, MemberBalance> = {};
      balanceResults.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          balanceMap[members[idx].id] = result.value.data;
        }
      });
      setBalances(balanceMap);

      // Fetch all active loans (admin sees all)
      const loansRes = await loansApi.list({ status: "active" });
      const activeLoans: LoanApplication[] = loansRes.data.results || [];
      const loanMap: Record<number, LoanApplication> = {};
      activeLoans.forEach((loan) => {
        if (loan.applicant) {
          // applicant is an object or just id? In the response it might be an id number.
          // The LoanApplication type includes `applicant: number`. So we use loan.applicant as number.
          loanMap[loan.applicant] = loan;
        }
      });
      setActiveLoansMap(loanMap);
    } catch {
      // non‑critical, leave maps empty
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateMemberState = (id: number, updates: Partial<MemberPostState>) => {
    setPostStates((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const postForMember = async (member: MemberProfile) => {
    const s = postStates[member.id];
    if (!s) return;
    updateMemberState(member.id, { status: "posting", message: "" });
    try {
      await savingsApi.postSavings({
        member: member.id,
        amount: String(s.amount),
        hijri_month: period.hijri_month,
        hijri_year: period.hijri_year,
      });
      updateMemberState(member.id, {
        status: "success",
        message: `₦${Number(s.amount).toLocaleString()} posted for ${HIJRI_MONTHS.find((m) => m.value === period.hijri_month)?.label} ${period.hijri_year}`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.amount?.[0] ||
        e?.response?.data?.error ||
        "Failed to post savings.";
      updateMemberState(member.id, { status: "error", message: msg });
    }
  };

  const postAll = async () => {
    setPostAllPending(true);
    setGlobalMsg("");
    const idle = members.filter((m) => postStates[m.id]?.status === "idle");
    for (const member of idle) {
      await postForMember(member);
    }
    setPostAllPending(false);
    setGlobalMsg(`Batch posting complete for ${idle.length} members.`);
  };

  const resetSuccessful = () => {
    setPostStates((prev) => {
      const next = { ...prev };
      members.forEach((m) => {
        if (next[m.id]?.status === "success") {
          next[m.id] = {
            amount: m.approved_monthly_contribution,
            editReason: "",
            isEdited: false,
            status: "idle",
            message: "",
          };
        }
      });
      return next;
    });
    setGlobalMsg("");
  };

  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.file_number.toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q)
    );
  });

  const successCount = Object.values(postStates).filter(
    (s) => s.status === "success",
  ).length;
  const pendingCount = Object.values(postStates).filter(
    (s) => s.status === "idle",
  ).length;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="page-title">Post Monthly Savings</h1>
        <p className="page-subtitle">
          Each card shows the member's approved monthly contribution pre-filled.
          Click "Show Details" to see active loan and surety information.
        </p>
      </div>

      {/* Period selector */}
      <div className="card p-4 mb-6 bg-primary-50 border border-primary-100">
        <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-3">
          Posting Period (Islamic Calendar)
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label text-xs">Islamic Month</label>
            <select
              value={period.hijri_month}
              onChange={(e) =>
                setPeriod((p) => ({
                  ...p,
                  hijri_month: Number(e.target.value),
                }))
              }
              className="input w-48"
              aria-label="Hijri month"
              title="Hijri month"
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
              min="1400"
              max="1500"
              value={period.hijri_year}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, hijri_year: Number(e.target.value) }))
              }
              className="input w-28"
              aria-label="Hijri year"
              title="Hijri year"
            />
          </div>
          <div className="flex gap-2 ml-auto">
            {successCount > 0 && (
              <button
                onClick={resetSuccessful}
                className="btn-secondary text-sm"
              >
                Clear {successCount} posted
              </button>
            )}
            <button
              onClick={postAll}
              disabled={postAllPending || pendingCount === 0}
              className="btn-primary text-sm disabled:opacity-40"
            >
              {postAllPending
                ? "Posting all..."
                : `Post All (${pendingCount} pending)`}
            </button>
          </div>
        </div>
      </div>

      {globalMsg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          ✅ {globalMsg}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member..."
            className="input pl-9"
            aria-label="Search members"
            title="Search members"
          />
        </div>
        <p className="text-sm text-gray-400">
          {filtered.length} member{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <p className="text-4xl">👥</p>
          <p className="mt-2">No active members found.</p>
        </div>
      ) : (
        <>
          {detailsLoading && (
            <p className="text-xs text-gray-400 mb-2">
              Loading loan & surety data…
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((member) => (
              <MemberSavingsCard
                key={member.id}
                member={member}
                state={
                  postStates[member.id] ?? {
                    amount: member.approved_monthly_contribution,
                    editReason: "",
                    isEdited: false,
                    status: "idle",
                    message: "",
                  }
                }
                balance={balances[member.id]}
                activeLoan={activeLoansMap[member.id]}
                onChange={(updates) => updateMemberState(member.id, updates)}
                onPost={() => postForMember(member)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
