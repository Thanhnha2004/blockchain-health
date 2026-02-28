"use client";

import { useState } from "react";
import { useDID } from "../../hooks/useDID";
import { useAccount } from "wagmi";

interface Props {
  onRegistered: (did: string) => void;
}

export default function OnboardingPage({ onRegistered }: Props) {
  const { address } = useAccount();
  const { registerDID, loading, error } = useDID();

  const [publicKey, setPublicKey] = useState("");
  const [serviceEndpoint, setServiceEndpoint] = useState("");
  const [txHash, setTxHash] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const did = await registerDID(publicKey, serviceEndpoint);
      setTxHash(did);
      onRegistered(did);
    } catch {}
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-emerald-400 mb-2 tracking-tight">
          Register your identity
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Your DID (Decentralized Identifier) is your permanent identity
          on-chain. This is a one-time setup.
        </p>
      </div>

      {/* Address badge */}
      <div className="mb-6 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg">
        <p className="text-xs text-slate-500 mb-1">Wallet address</p>
        <p className="text-sm text-slate-300 font-mono break-all">{address}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">
            RSA Public Key
          </label>
          <textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="base64EncodedRSAPublicKey=="
            rows={3}
            required
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <p className="mt-1 text-xs text-slate-600">
            Used to encrypt data shared with you
          </p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">
            Service Endpoint
          </label>
          <input
            type="url"
            value={serviceEndpoint}
            onChange={(e) => setServiceEndpoint(e.target.value)}
            placeholder="https://your-backend.com/health"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
          <p className="mt-1 text-xs text-slate-600">
            Backend URL where your off-chain data lives
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-lg transition-colors">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              Registering...
            </>
          ) : (
            "Register DID"
          )}
        </button>
      </form>
    </div>
  );
}
