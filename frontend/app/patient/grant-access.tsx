"use client";

import { useState } from "react";
import { useAccess } from "../../hooks/useAccess";

const DATA_TYPE_OPTIONS = ["lab", "imaging", "prescription", "note"];

interface Props {
  patientDID: string;
}

export default function GrantAccessPage({ patientDID }: Props) {
  const { grantAccess, revokeAccess, loading, error } = useAccess();

  const [doctorAddress, setDoctorAddress] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["lab"]);
  const [revokeAddress, setRevokeAddress] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    try {
      await grantAccess(
        patientDID,
        doctorAddress,
        durationHours,
        selectedTypes,
      );
      setSuccessMsg(`Access granted to ${doctorAddress.slice(0, 10)}...`);
      setDoctorAddress("");
    } catch {}
  }

  async function handleRevoke(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    try {
      await revokeAccess(patientDID, revokeAddress);
      setSuccessMsg(`Access revoked from ${revokeAddress.slice(0, 10)}...`);
      setRevokeAddress("");
    } catch {}
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      {/* Grant */}
      <section>
        <h2 className="text-lg font-bold text-slate-200 mb-1">Grant Access</h2>
        <p className="text-xs text-slate-500 mb-5">
          Allow a doctor to view your records
        </p>

        <form onSubmit={handleGrant} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">
              Doctor Address
            </label>
            <input
              type="text"
              value={doctorAddress}
              onChange={(e) => setDoctorAddress(e.target.value)}
              placeholder="0x..."
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">
              Duration
            </label>
            <div className="flex gap-2">
              {[1, 24, 72, 168].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDurationHours(h)}
                  className={`flex-1 py-2 text-xs rounded border transition-all ${
                    durationHours === h
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}>
                  {h < 24 ? `${h}h` : `${h / 24}d`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">
              Data Types
            </label>
            <div className="flex gap-2 flex-wrap">
              {DATA_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`px-3 py-1.5 text-xs rounded border transition-all capitalize ${
                    selectedTypes.includes(type)
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
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

          {successMsg && (
            <div className="px-4 py-3 bg-emerald-950 border border-emerald-800 rounded-lg text-sm text-emerald-400">
              ✓ {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || selectedTypes.length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-lg transition-colors">
            {loading ? "Processing..." : "Grant Access"}
          </button>
        </form>
      </section>

      <hr className="border-slate-800" />

      {/* Revoke */}
      <section>
        <h2 className="text-lg font-bold text-slate-200 mb-1">Revoke Access</h2>
        <p className="text-xs text-slate-500 mb-5">
          Immediately remove a doctor's access
        </p>

        <form onSubmit={handleRevoke} className="flex gap-3">
          <input
            type="text"
            value={revokeAddress}
            onChange={(e) => setRevokeAddress(e.target.value)}
            placeholder="Doctor address 0x..."
            required
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 font-mono"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-widest px-5 py-3 rounded-lg transition-colors whitespace-nowrap">
            Revoke
          </button>
        </form>
      </section>
    </div>
  );
}
