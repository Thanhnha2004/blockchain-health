"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

const RECORD_TYPES = ["lab", "imaging", "prescription", "note"];

interface Props {
  patientDID: string;
}

export default function UploadRecord({ patientDID }: Props) {
  const { address } = useAccount();

  const [file, setFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState("lab");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    ipfsCID: string;
    txHash: string;
  } | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !address) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientDID", patientDID);
      formData.append("recordType", recordType);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/records`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const data = await res.json();
      setResult({ ipfsCID: data.ipfsCID, txHash: data.txHash });
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-bold text-zinc-200 mb-1">Upload Record</h2>
      <p className="text-xs text-zinc-500 mb-5">
        File will be encrypted and stored on IPFS. Metadata saved on-chain.
      </p>

      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        {/* File input */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-zinc-400 mb-2">
            File
          </label>
          <div
            className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center cursor-pointer hover:border-sky-600 transition-colors"
            onClick={() => document.getElementById("file-input")?.click()}>
            {file ? (
              <div>
                <p className="text-sm text-zinc-200">{file.name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-zinc-500 text-sm">Click to select file</p>
                <p className="text-zinc-600 text-xs mt-1">Max 100MB</p>
              </div>
            )}
            <input
              id="file-input"
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {/* Record type */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-zinc-400 mb-2">
            Record Type
          </label>
          <div className="flex gap-2">
            {RECORD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRecordType(type)}
                className={`flex-1 py-2 text-xs rounded border capitalize transition-all ${
                  recordType === type
                    ? "border-sky-500 bg-sky-500/10 text-sky-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="px-4 py-3 bg-emerald-950 border border-emerald-800 rounded-lg text-sm text-emerald-400">
            <p className="font-bold mb-1">✓ Upload successful</p>
            <p className="text-xs text-emerald-600 break-all">
              CID: {result.ipfsCID}
            </p>
            <p className="text-xs text-emerald-600 break-all mt-1">
              Tx: {result.txHash}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-lg transition-colors">
          {loading ? "Uploading..." : "Upload & Sign"}
        </button>
      </form>
    </div>
  );
}
