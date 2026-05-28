import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { membersApi, savingsApi } from "@/api/services";
import { PageHeader } from "@/components/common";
import type { MemberProfile, MemberBalance, SavingsLedgerEntry } from "@/types";

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [balance, setBalance] = useState<MemberBalance | null>(null);
  const [recentLedger, setRecentLedger] = useState<SavingsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const loadMember = async () => {
      try {
        const response = await membersApi.get(Number(id));
        setMember(response.data);
      } catch {
        setError("Unable to load member details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadMember();
  }, [id]);

  useEffect(() => {
    if (!member) return;
    const loadBalance = async () => {
      setBalanceLoading(true);
      try {
        const balanceResponse = await savingsApi.getBalance(member.id);
        setBalance(balanceResponse.data);

        const ledgerResponse = await savingsApi.getLedger(member.id, {
          page: 1,
        });
        setRecentLedger(ledgerResponse.data.results.slice(0, 5));
      } catch {
        // Silently handle balance fetch failures - not critical for viewing profile
      } finally {
        setBalanceLoading(false);
      }
    };

    loadBalance();
  }, [member]);

  if (loading) {
    return <div className="text-gray-600">Loading member...</div>;
  }

  if (error || !member) {
    return (
      <div className="card p-6">
        <PageHeader
          title="Member details"
          back={{ to: "/members", label: "Back to Members" }}
        />
        <div className="text-danger-700">{error || "Member not found."}</div>
      </div>
    );
  }

  const formatNaira = (value: string | number) => {
    const amount = Number(value);
    return Number.isNaN(amount)
      ? "₦0.00"
      : `₦${amount.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
  };

  return (
    <div className="card p-6 space-y-6">
      <PageHeader
        title={member.full_name}
        subtitle={`Profile details for ${member.staff_id}`}
        back={{ to: "/members", label: "Back to Members" }}
      />

      {/* Available Balance Section */}
      {balanceLoading ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-700">
            Loading balance information...
          </p>
        </div>
      ) : balance ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">
              Total Savings
            </p>
            <p className="text-2xl font-bold text-green-900 mt-2">
              {formatNaira(balance.total_savings)}
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-semibold text-orange-700">
              Committed (Surety)
            </p>
            <p className="text-2xl font-bold text-orange-900 mt-2">
              {formatNaira(balance.suretyship_committed)}
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-700">
              Available Balance
            </p>
            <p className="text-2xl font-bold text-blue-900 mt-2">
              {formatNaira(balance.available_balance)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Identity</h2>
          <p>
            <strong className="text-gray-600">File number:</strong>{" "}
            {member.file_number}
          </p>
          <p>
            <strong className="text-gray-600">Staff ID:</strong>{" "}
            {member.staff_id}
          </p>
          <p>
            <strong className="text-gray-600">Role:</strong> {member.role}
          </p>
          <p>
            <strong className="text-gray-600">Status:</strong>{" "}
            {member.membership_status}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">School</h2>
          <p>
            <strong className="text-gray-600">Branch:</strong>{" "}
            {member.school_branch}
          </p>
          <p>
            <strong className="text-gray-600">Designation:</strong>{" "}
            {member.designation}
          </p>
          <p>
            <strong className="text-gray-600">Joined:</strong>{" "}
            {member.date_joined_school}
          </p>
          <p>
            <strong className="text-gray-600">Monthly Income:</strong> ₦
            {member.monthly_income}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Contact</h2>
          <p>
            <strong className="text-gray-600">Primary phone:</strong>{" "}
            {member.phone_primary}
          </p>
          <p>
            <strong className="text-gray-600">Secondary phone:</strong>{" "}
            {member.phone_secondary || "—"}
          </p>
          <p>
            <strong className="text-gray-600">Email:</strong>{" "}
            {member.email_address || "—"}
          </p>
          <p>
            <strong className="text-gray-600">Address:</strong>{" "}
            {member.residential_address}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Origin</h2>
          <p>
            <strong className="text-gray-600">State of origin:</strong>{" "}
            {member.state_of_origin}
          </p>
          <p>
            <strong className="text-gray-600">LGA:</strong>{" "}
            {member.local_government_area}
          </p>
          <p>
            <strong className="text-gray-600">Gender:</strong> {member.gender}
          </p>
          <p>
            <strong className="text-gray-600">DOB:</strong>{" "}
            {member.date_of_birth}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Next of Kin
        </h2>
        <p>
          <strong className="text-gray-600">Name:</strong>{" "}
          {member.next_of_kin_name}
        </p>
        <p>
          <strong className="text-gray-600">Phone:</strong>{" "}
          {member.next_of_kin_phone}
        </p>
        <p>
          <strong className="text-gray-600">Relationship:</strong>{" "}
          {member.next_of_kin_relationship}
        </p>
        <p>
          <strong className="text-gray-600">Work place:</strong>{" "}
          {member.next_of_kin_place_of_work || "—"}
        </p>
        <p className="mt-3">
          <strong className="text-gray-600">Address:</strong>{" "}
          {member.next_of_kin_address}
        </p>
      </div>

      {/* Recent Activity Section */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Recent Activity (Savings Ledger)
        </h2>
        {recentLedger.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-gray-200 text-xs text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Hijri</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Debit</th>
                  <th className="px-2 py-2">Credit</th>
                  <th className="px-2 py-2">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentLedger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-gray-700">
                      {entry.gregorian_date}
                    </td>
                    <td className="px-2 py-2 text-gray-700">
                      {entry.hijri_display}
                    </td>
                    <td className="px-2 py-2 text-gray-700 capitalize">
                      {entry.entry_type.replace("_", " ")}
                    </td>
                    <td className="px-2 py-2 text-gray-700">
                      {entry.debit ? formatNaira(entry.debit) : "—"}
                    </td>
                    <td className="px-2 py-2 text-gray-700">
                      {entry.credit ? formatNaira(entry.credit) : "—"}
                    </td>
                    <td className="px-2 py-2 font-semibold text-blue-700">
                      {formatNaira(entry.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
