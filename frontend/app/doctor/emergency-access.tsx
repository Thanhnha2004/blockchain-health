"use client";

import { useState } from "react";
import { useContracts } from "../../hooks/useContracts";

interface Props {
  patientDID: string;
}

export default function EmergencyAccess({ patientDID }: Props) {
  const { contracts } = useContracts();
  const [reason, setReason] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleEmergency() {
    if (!contracts || !reason.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const contract = await contracts.getAccessControl();
      const tx = await contract.grantEmergencyAccess(patientDID, reason);
      await tx.wait();
      setSuccess(true);
      setShowDialog(false);
      setReason("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success)
    return (
      <div className="px-4 py-3 bg-orange-950 border border-orange-800 rounded-lg text-sm text-orange-400">
        ⚡ Emergency access granted — expires in 24 hours
      </div>
    );

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="w-full border border-orange-700 hover:border-orange-500 text-orange-400 hover:text-orange-300 font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-lg transition-colors">
        ⚡ Request Emergency Access
      </button>

      {/* Confirm dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-orange-400 mb-1">
              Emergency Access
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              This will grant you immediate access for 24 hours and will be
              logged permanently on-chain. Use only in genuine medical
              emergencies.
            </p>

            <label className="block text-xs uppercase tracking-widest text-zinc-400 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Patient unconscious, requiring immediate access to medication history..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none mb-4"
            />

            {error && (
              <div className="px-3 py-2 bg-red-950 border border-red-800 rounded text-xs text-red-400 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDialog(false);
                  setReason("");
                }}
                className="flex-1 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm py-2 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleEmergency}
                disabled={loading || !reason.trim()}
                className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-widest py-2 rounded-lg transition-colors">
                {loading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
