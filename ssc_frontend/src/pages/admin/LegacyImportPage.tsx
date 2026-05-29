import React, { useState, useEffect } from "react";
import { membersApi } from "@/api/services";

export default function LegacyImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [staffIdTemplate, setStaffIdTemplate] = useState<string>("S{seq:04d}");
  const [startSeq, setStartSeq] = useState<number | undefined>(9000);
  const [createRegistry, setCreateRegistry] = useState<boolean>(true);
  const [downloadErrors, setDownloadErrors] = useState<boolean>(false);

  useEffect(() => {
    if (!file) {
      setHeaders([]);
      return;
    }
    // read first line to extract headers
    const fr = new FileReader();
    fr.onload = () => {
      const text = String(fr.result || "");
      const firstLine = text.split(/\r?\n/)[0] || "";
      const cols = firstLine
        .split(",")
        .map((c) => c.replace(/^"|"$/g, "").trim());
      setHeaders(cols);
    };
    fr.readAsText(file.slice(0, 10240));
  }, [file]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    setSummary(null);
    setMapping({});
  };

  const handleMapChange = (target: string, col: string) => {
    setMapping((m) => ({ ...m, [target]: col }));
  };

  const doPreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await membersApi.importLegacy(file, true, {
        field_map: mapping,
        staff_id_template: staffIdTemplate,
        create_registry: createRegistry,
        start_seq: startSeq,
        download_errors: downloadErrors,
      });
      // server returns JSON unless download_errors requested
      setPreview(res.data.preview || null);
      setSummary(res.data);
    } catch (err: any) {
      setSummary({ error: err?.response?.data || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const doImport = async () => {
    if (!file) return;
    if (!confirm("This will create member records. Proceed?")) return;
    setLoading(true);
    try {
      const res = await membersApi.importLegacy(file, false, {
        field_map: mapping,
        staff_id_template: staffIdTemplate,
        create_registry: createRegistry,
        start_seq: startSeq,
        download_errors: downloadErrors,
      });

      if (downloadErrors && res.data instanceof Blob) {
        // trigger download
        const url = window.URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = "import-errors.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        setSummary(res.data);
        setPreview(null);
      }
    } catch (err: any) {
      setSummary({ error: err?.response?.data || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const targetFields = [
    "full_name",
    "phone_primary",
    "phone_secondary",
    "date_of_birth",
    "school_branch",
    "designation",
    "date_joined_school",
    "file_number",
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Legacy CSV Import</h2>

      {/* File upload - Line 112 */}
      <div className="mb-4">
        <label
          htmlFor="csv-file"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          CSV File
        </label>
        <input
          id="csv-file"
          type="file"
          accept="text/csv"
          onChange={handleFile}
          aria-label="Select CSV file for legacy import"
          title="Select CSV file for legacy import"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          Upload CSV file with member data (max 10MB)
        </p>
      </div>

      {headers.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Column mapping</h3>
          <p className="text-sm text-gray-600 mb-3">
            Map CSV columns to member fields.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {targetFields.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <label
                  htmlFor={`map-${t}`}
                  className="w-40 text-sm font-medium text-gray-700"
                >
                  {t.replace(/_/g, " ")}
                </label>
                <select
                  id={`map-${t}`}
                  value={mapping[t] || ""}
                  onChange={(e) => handleMapChange(t, e.target.value)}
                  className="flex-1 input"
                  aria-label={`Map CSV column to ${t}`}
                  title={`Map CSV column to ${t}`}
                >
                  <option value="">— select —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff ID template input - Line 141 */}
      <div className="mb-4">
        <label
          htmlFor="staff-id-template"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Staff ID template
        </label>
        <input
          id="staff-id-template"
          type="text"
          value={staffIdTemplate}
          onChange={(e) => setStaffIdTemplate(e.target.value)}
          className="input w-full md:w-96"
          aria-label="Staff ID template format"
          title="Staff ID template format"
        />
        <p className="text-sm text-gray-500 mt-1">
          Use {"{seq:04d}"} placeholder for sequence, e.g. S{"{seq:04d}"}
        </p>
      </div>

      {/* Create registry checkbox */}
      <div className="mb-4">
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={createRegistry}
            onChange={(e) => setCreateRegistry(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            aria-label="Create Staff ID Registry entries"
          />
          <span className="ml-2 text-sm text-gray-700">
            Create StaffIDRegistry entries for generated IDs
          </span>
        </label>
      </div>

      {/* Start sequence input - Line 154 */}
      <div className="mb-4">
        <label
          htmlFor="start-sequence"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Start sequence
        </label>
        <input
          id="start-sequence"
          type="number"
          value={startSeq}
          onChange={(e) => setStartSeq(Number(e.target.value))}
          className="input w-40"
          aria-label="Start sequence number for file numbers"
          title="Start sequence number for file numbers"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={downloadErrors}
            onChange={(e) => setDownloadErrors(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            aria-label="Download errors CSV if present"
          />
          <span className="ml-2 text-sm text-gray-700">
            Download errors CSV if present
          </span>
        </label>

        <button
          className="btn-primary btn-sm"
          onClick={doPreview}
          disabled={!file || loading}
          aria-label="Preview import (dry run)"
        >
          Preview (dry run)
        </button>

        <button
          className="btn-danger btn-sm"
          onClick={doImport}
          disabled={!file || loading}
          aria-label="Import CSV and create records"
        >
          Import (create records)
        </button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Processing...</p>
        </div>
      )}

      {preview && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium mb-2">Preview (first rows)</h3>
          <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}

      {summary && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium mb-2">Summary</h3>
          <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
            {JSON.stringify(summary, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
