"use client";

import { useState } from "react";
import { useContracts } from "../../hooks/useContracts";
import { useToast } from "../../components/toast";
import { useAccount } from "wagmi";

interface Record {
  ipfsCID: string;
  dataHash: string;
  recordType: string;
  createdBy: string;
  createdAt: bigint;
}

interface Props {
  record: Record;
  patientDID: string;
  onClose: () => void;
}

export default function ViewRecord({ record, patientDID, onClose }: Props) {
  const { contracts } = useContracts();
  const toast = useToast();
  const [aesKey, setAesKey] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"text" | "binary">("text");
  const [loading, setLoading] = useState(false);
  const { address } = useAccount();

  async function handleFetch() {
    if (!aesKey.trim()) return;

    setLoading(true);
    const toastId = toast.pending("Fetching from IPFS...");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/records/${patientDID}?callerAddress=${address}&aesKey=${aesKey}&cid=${record.ipfsCID}`,
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Fetch failed");
      }

      const data = await res.json();
      const matched = data.records?.find(
        (r: any) => r.ipfsCID === record.ipfsCID,
      );

      if (!matched) throw new Error("Record not found");
      if (!matched.isValid)
        throw new Error("File integrity check failed — hash mismatch");

      // Thử decode base64 về text
      try {
        const text = atob(matched.fileBase64);
        setContent(text);
        setFileType("text");
      } catch {
        setContent(matched.fileBase64);
        setFileType("binary");
      }

      toast.success("File loaded successfully", toastId);
    } catch (err: any) {
      toast.error(err.message, toastId);
    } finally {
      setLoading(false);
    }
  }

  async function getAddress(): Promise<string> {
    if (!contracts) throw new Error("Wallet not connected");
    const contract = await contracts.getRecordRegistry();
    const signer = await (contract.runner as any)?.getAddress?.();
    return signer;
  }

  function handleDownload() {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `record-${record.ipfsCID.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-200">View Record</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {record.ipfsCID}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg">
            ✕
          </button>
        </div>

        {!content ? (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Enter the AES key to decrypt this file. The key was returned when
              the record was uploaded.
            </p>
            <input
              type="text"
              value={aesKey}
              onChange={(e) => setAesKey(e.target.value)}
              placeholder="AES key (hex)"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono mb-4"
            />
            <button
              onClick={handleFetch}
              disabled={loading || !aesKey.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm uppercase tracking-widest py-3 rounded-lg transition-colors">
              {loading ? "Decrypting..." : "Decrypt & View"}
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-auto bg-slate-800 rounded-lg p-4 mb-4">
              {fileType === "text" ? (
                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">
                  {content}
                </pre>
              ) : (
                <p className="text-sm text-slate-400">
                  Binary file — use download button
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setContent(null)}
                className="flex-1 border border-slate-700 text-slate-400 hover:text-slate-200 text-sm py-2 rounded-lg transition-colors">
                Use different key
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm py-2 rounded-lg transition-colors">
                Download
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
