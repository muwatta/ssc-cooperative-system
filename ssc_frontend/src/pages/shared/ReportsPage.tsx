import { useEffect, useMemo, useState } from "react";
import { membersApi } from "@/api/services";
import type { MemberProfile, SchoolBranch, MembershipStatus } from "@/types";

export default function ReportsPage() {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await membersApi.list();
        setMembers(response.data.results);
      } catch {
        setError("Unable to load report data.");
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  const summary = useMemo(() => {
    const statusCounts = {
      active: 0,
      pending: 0,
      inactive: 0,
      exited: 0,
    } as Record<MembershipStatus, number>;
    const branchCounts = {
      primary: 0,
      college: 0,
      other: 0,
    } as Record<SchoolBranch, number>;
    let totalContribution = 0;
    let eligibleCount = 0;

    members.forEach((member) => {
      statusCounts[member.membership_status] += 1;
      branchCounts[member.school_branch] += 1;
      totalContribution += Number(member.approved_monthly_contribution || 0);
      if (member.is_loan_eligible) eligibleCount += 1;
    });

    return {
      statusCounts,
      branchCounts,
      averageContribution: members.length
        ? totalContribution / members.length
        : 0,
      eligibleCount,
    };
  }, [members]);

  return (
    <div className="card p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-gray-500">
          Live summary reports based on member data and contribution status.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading report data...</div>
      ) : error ? (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-4">
          {error}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Members Loaded</p>
              <p className="text-3xl font-semibold mt-2">{members.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Loan-Eligible Members</p>
              <p className="text-3xl font-semibold mt-2">
                {summary.eligibleCount}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Average Contribution</p>
              <p className="text-3xl font-semibold mt-2">
                ₦
                {summary.averageContribution.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Membership Status
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>Active: {summary.statusCounts.active}</li>
                <li>Pending: {summary.statusCounts.pending}</li>
                <li>Inactive: {summary.statusCounts.inactive}</li>
                <li>Exited: {summary.statusCounts.exited}</li>
              </ul>
            </div>
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Branch Distribution
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>Primary: {summary.branchCounts.primary}</li>
                <li>College: {summary.branchCounts.college}</li>
                <li>Other: {summary.branchCounts.other}</li>
              </ul>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-sm text-gray-500">
                  <th className="px-4 py-3">File No.</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Contribution</th>
                  <th className="px-4 py-3">Eligible for Loan</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {member.file_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {member.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                      {member.membership_status}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                      {member.school_branch}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      ₦{member.approved_monthly_contribution}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {member.is_loan_eligible ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
