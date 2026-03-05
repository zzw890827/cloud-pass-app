"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { ImportResult } from "@/types";

export default function ImportPage() {
  const { user } = useAuth();
  const [fileContent, setFileContent] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string);
      setResult(null);
      setError("");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = JSON.parse(fileContent);
      const res = await api.importData(data);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  if (!user?.is_admin) {
    return <p className="text-red-500 mt-10">Admin access required.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Questions</h1>

      <Card className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select JSON file
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {fileContent && (
          <div>
            <p className="text-sm text-gray-500 mb-2">
              Preview ({fileContent.length} characters)
            </p>
            <pre className="bg-gray-50 border rounded-lg p-3 text-xs overflow-auto max-h-40">
              {fileContent.slice(0, 500)}
              {fileContent.length > 500 && "..."}
            </pre>
          </div>
        )}

        <Button onClick={handleImport} disabled={!fileContent || loading}>
          {loading ? "Importing..." : "Import"}
        </Button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              Import complete: {result.questions_imported} imported, {result.questions_skipped} skipped
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
