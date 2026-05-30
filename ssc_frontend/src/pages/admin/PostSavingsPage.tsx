import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { membersApi, savingsApi } from "@/api/services";
import type { MemberSummary } from "@/types";

interface FormData {
  amount: number;
  hijri_month: number;
  hijri_year: number;
}

interface CsvMappingState {
  showModal: boolean;
  csvData: string[];
  columnMapOptions: string[];
  selectedColumn: string;
}

export default function PostSavingsPage() {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [csvMapping, setCsvMapping] = useState<CsvMappingState>({
    showModal: false,
    csvData: [],
    columnMapOptions: ["file_number", "full_name", "email_address"],
    selectedColumn: "file_number",
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      hijri_month: 1,
      hijri_year: new Date().getFullYear(),
    },
  });

  // Fixed useEffect with cleanup and proper state management
  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      try {
        setLoading(true);
        setIsError(false);
        setServerMessage(null);

        const response = await membersApi.summary();
        if (isMounted) {
          setMembers(response.data.results);
        }
      } catch {
        if (isMounted) {
          setServerMessage("Unable to load members for savings posting.");
          setIsError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleMembers = members.filter((m) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      m.file_number.toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q)
    );
  });

  const onSubmit = async (data: FormData) => {
    if (selectedMemberIds.length === 0) {
      setServerMessage(
        "Please select at least one member to post savings for.",
      );
      setIsError(true);
      return;
    }

    setServerMessage(null);
    setIsError(false);

    try {
      await savingsApi.postSavings({
        member_ids: selectedMemberIds,
        amount: data.amount,
        hijri_month: data.hijri_month,
        hijri_year: data.hijri_year,
      });
      setServerMessage(
        selectedMemberIds.length > 1
          ? "Savings entry posted successfully for selected members."
          : "Savings entry posted successfully.",
      );
      reset({
        amount: 0,
        hijri_month: data.hijri_month,
        hijri_year: data.hijri_year,
      });
      setSelectedMemberIds([]);
    } catch {
      setServerMessage("Failed to post savings. Please try again.");
      setIsError(true);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMemberIds(visibleMembers.map((m) => m.id));
    } else {
      setSelectedMemberIds([]);
    }
  };

  const handleCsvUpload = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        setServerMessage("CSV file is empty.");
        setIsError(true);
        return;
      }

      setCsvMapping({
        showModal: true,
        csvData: lines,
        columnMapOptions: ["file_number", "full_name", "email_address"],
        selectedColumn: "file_number",
      });
    };
    reader.readAsText(file);
  };

  const handleCsvMappingConfirm = () => {
    const { csvData, selectedColumn } = csvMapping;
    const matchedIds: number[] = [];

    if (selectedColumn === "file_number") {
      const lookup = new Map(
        members.map((m) => [m.file_number.toLowerCase(), m.id]),
      );
      for (const line of csvData) {
        const key = line.toLowerCase();
        if (lookup.has(key)) matchedIds.push(lookup.get(key)!);
      }
    } else if (selectedColumn === "full_name") {
      const lookup = new Map(
        members.map((m) => [m.full_name.toLowerCase(), m.id]),
      );
      for (const line of csvData) {
        const key = line.toLowerCase();
        if (lookup.has(key)) matchedIds.push(lookup.get(key)!);
      }
    }

    if (matchedIds.length === 0) {
      setServerMessage(`No matching members found using "${selectedColumn}".`);
      setIsError(true);
    } else {
      setSelectedMemberIds(
        Array.from(new Set([...selectedMemberIds, ...matchedIds])),
      );
      setServerMessage(
        `${matchedIds.length} members selected from CSV (${selectedColumn}).`,
      );
      setIsError(false);
    }

    setCsvMapping({ ...csvMapping, showModal: false, csvData: [] });
  };

  return (
    <div className="card p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Post Savings</h1>
        <p className="text-sm text-gray-500">
          Record an ordinary savings payment for a member.
        </p>
      </div>

      {serverMessage && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            isError
              ? "bg-danger-50 text-danger-700 border border-danger-200"
              : "bg-success-50 text-success-700 border border-success-200"
          }`}
        >
          {serverMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            placeholder="Search by file number or name"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input flex-1"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                visibleMembers.length > 0 &&
                visibleMembers.every((m) => selectedMemberIds.includes(m.id))
              }
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            <span className="text-sm">Select visible</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) =>
                handleCsvUpload(e.target.files ? e.target.files[0] : null)
              }
              className="hidden"
            />
            <button type="button" className="btn-ghost">
              Upload CSV
            </button>
          </label>
        </div>
        <div>
          <label htmlFor="member-select" className="label">
            Member(s)
          </label>
          <select
            id="member-select"
            multiple
            value={selectedMemberIds.map(String)}
            onChange={(event) =>
              setSelectedMemberIds(
                Array.from(event.target.selectedOptions, (option) =>
                  Number(option.value),
                ),
              )
            }
            className="input h-40"
            disabled={loading}
          >
            {loading ? (
              <option disabled>Loading members...</option>
            ) : (
              visibleMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.file_number} — {member.full_name}
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Hold Ctrl (Windows) or Cmd (Mac) to select multiple members.
          </p>
          {!loading && members.length === 0 && (
            <p className="field-error">No members found</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Amount</label>
            <input
              {...register("amount", {
                required: "Amount is required",
                valueAsNumber: true,
                min: { value: 0.01, message: "Amount must be positive" },
              })}
              type="number"
              step="0.01"
              inputMode="decimal"
              min={0.01}
              className="input"
              disabled={loading}
            />
            {errors.amount && (
              <p className="field-error">{errors.amount.message}</p>
            )}
          </div>
          <div>
            <label className="label">Hijri Month</label>
            <input
              {...register("hijri_month", {
                required: "Hijri month is required",
                valueAsNumber: true,
                min: { value: 1, message: "Month must be between 1 and 12" },
                max: { value: 12, message: "Month must be between 1 and 12" },
              })}
              type="number"
              min={1}
              max={12}
              className="input"
              disabled={loading}
            />
            {errors.hijri_month && (
              <p className="field-error">{errors.hijri_month.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Hijri Year</label>
            <input
              {...register("hijri_year", {
                required: "Hijri year is required",
                valueAsNumber: true,
                min: { value: 1, message: "Please enter a valid year" },
              })}
              type="number"
              className="input"
              disabled={loading}
            />
            {errors.hijri_year && (
              <p className="field-error">{errors.hijri_year.message}</p>
            )}
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="btn-primary w-full py-2.5"
            >
              {isSubmitting ? "Posting..." : "Post Savings"}
            </button>
          </div>
        </div>
      </form>

      {csvMapping.showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Map CSV Column</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select which column in your CSV contains member identifiers:
            </p>
            <select
              value={csvMapping.selectedColumn}
              onChange={(e) =>
                setCsvMapping({ ...csvMapping, selectedColumn: e.target.value })
              }
              className="input w-full mb-4"
              aria-label="Select CSV column to map"
              title="Select CSV column to map"
            >
              <option value="file_number">File Number</option>
              <option value="full_name">Full Name</option>
            </select>
            <p className="text-xs text-gray-500 mb-4">
              {csvMapping.csvData.length} rows will be matched.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCsvMappingConfirm}
                className="btn-primary flex-1"
              >
                Confirm
              </button>
              <button
                onClick={() =>
                  setCsvMapping({
                    ...csvMapping,
                    showModal: false,
                    csvData: [],
                  })
                }
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-gray-600 mt-6 text-center">Loading members...</div>
      )}
    </div>
  );
}
