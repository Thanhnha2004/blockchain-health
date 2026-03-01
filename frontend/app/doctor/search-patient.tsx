"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useContracts } from "../../hooks/useContracts";

interface Props {
  onFound: (did: string) => void;
}

export default function SearchPatient({ onFound }: Props) {
  const { contracts } = useContracts();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = input.trim();
    if (!value) return;

    // Nếu nhập address ví → tìm DID của address đó
    if (ethers.isAddress(value)) {
      if (!contracts) return;
      setLoading(true);
      try {
        const contract = await contracts.getDIDRegistry();
        const did = await contract.getDIDByAddress(ethers.getAddress(value));

        if (did === ethers.ZeroHash) {
          setError("No DID registered for this address");
          return;
        }
        onFound(did);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Nếu nhập bytes32 DID trực tiếp
    if (value.startsWith("0x") && value.length === 66) {
      onFound(value);
      return;
    }

    setError("Enter a wallet address (0x...) or a DID (bytes32)");
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-200 mb-1">Search Patient</h2>
      <p className="text-xs text-zinc-500 mb-4">
        Enter patient wallet address or DID
      </p>

      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x... wallet address or DID"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500 font-mono"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-bold text-sm uppercase tracking-widest px-5 py-3 rounded-lg transition-colors whitespace-nowrap">
          {loading ? "..." : "Search"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
