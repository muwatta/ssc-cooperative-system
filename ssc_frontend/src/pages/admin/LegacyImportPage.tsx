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
      const cols = firstLine.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
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
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Legacy CSV Import</h2>
      <div className="mb-4">
        <input type="file" accept="text/csv" onChange={handleFile} />
      </div>

      {headers.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium">Column mapping</h3>
          <p className="text-sm text-gray-600 mb-2">Map CSV columns to member fields.</p>
          <div className="grid grid-cols-2 gap-2">
            {targetFields.map((t) => (
              <label key={t} className="flex items-center space-x-2">
                <span className="w-40">{t}</span>
                <select
                  value={mapping[t] || ""}
                  onChange={(e) => handleMapChange(t, e.target.value)}
                  className="flex-1"
                >
                  <option value="">— select —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-1">Staff ID template</label>
        <input value={staffIdTemplate} onChange={(e) => setStaffIdTemplate(e.target.value)} className="input" />
        <p className="text-sm text-gray-500">Use {"{seq:04d}"} placeholder for sequence, e.g. S{'{seq:04d}'}</p>
      </div>

      <div className="mb-4">
        <label className="inline-flex items-center">
          <input type="checkbox" checked={createRegistry} onChange={(e) => setCreateRegistry(e.target.checked)} />
          <span className="ml-2">Create StaffIDRegistry entries for generated IDs</span>
        </label>
      </div>

      <div className="mb-4">
        <label className="block mb-1">Start sequence</label>
        <input type="number" value={startSeq} onChange={(e) => setStartSeq(Number(e.target.value))} className="input w-40" />
      </div>

      <div className="space-x-2 mb-4">
        <label className="inline-flex items-center mr-4">
          <input type="checkbox" checked={downloadErrors} onChange={(e) => setDownloadErrors(e.target.checked)} />
          <span className="ml-2">Download errors CSV if present</span>
        </label>
        <button className="btn-primary btn-sm" onClick={doPreview} disabled={!file || loading}>
          Preview (dry run)
        </button>
        <button className="btn-danger btn-sm" onClick={doImport} disabled={!file || loading}>
          Import (create records)
        </button>
      </div>

      {loading && <div>Processing...</div>}

      {preview && (
        <div className="mt-4">
          <h3 className="font-medium">Preview (first rows)</h3>
          <pre className="whitespace-pre-wrap mt-2 text-sm">{JSON.stringify(preview, null, 2)}</pre>
        </div>
      )}

      {summary && (
        <div className="mt-4">
          <h3 className="font-medium">Summary</h3>
          <pre className="whitespace-pre-wrap mt-2 text-sm">{JSON.stringify(summary, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
