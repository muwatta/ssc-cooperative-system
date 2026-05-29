import React, { useState } from "react";
import { membersApi } from "@/api/services";

export default function LegacyImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    setSummary(null);
  };

  const doPreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await membersApi.importLegacy(file, true);
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
      const res = await membersApi.importLegacy(file, false);
      setSummary(res.data);
      setPreview(null);
    } catch (err: any) {
      setSummary({ error: err?.response?.data || String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Legacy CSV Import</h2>
      <div className="mb-4">
        <input type="file" accept="text/csv" onChange={handleFile} />
      </div>

      <div className="space-x-2 mb-4">
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
