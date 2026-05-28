import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { membersApi } from "@/api/services";
import type { MemberProfile } from "@/types";

export default function MembersListPage() {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await membersApi.list();
        setMembers(response.data.results);
      } catch {
        setError("Unable to load members. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">All Members</h1>
          <p className="text-sm text-gray-500">
            Browse all member profiles and review eligibility details.
          </p>
        </div>
        <Link to="/members/add" className="btn-secondary">
          + Add Member
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading members...</div>
      ) : error ? (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-4">
          {error}
        </div>
      ) : members.length === 0 ? (
        <div className="text-gray-600">No members found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-sm text-gray-500">
                <th className="px-4 py-3">File Number</th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <Link
                      to={`/members/${member.id}`}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {member.file_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {member.full_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {member.staff_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                    {member.school_branch}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {member.designation}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`badge ${member.membership_status === "active" ? "badge-success" : "badge-gray"}`}
                    >
                      {member.membership_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
