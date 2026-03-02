"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { hardhat } from "wagmi/chains";

const SUPPORTED_CHAIN_ID = hardhat.id; // 31337 local, đổi thành sepolia.id khi deploy

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [hasMetaMask, setHasMetaMask] = useState(true);

  useEffect(() => {
    setHasMetaMask(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  // MetaMask chưa cài
  if (!hasMetaMask)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full border border-slate-700 rounded-xl p-6 text-center">
          <div className="text-4xl mb-4">🦊</div>
          <h2 className="text-lg font-bold text-slate-200 mb-2">
            MetaMask Required
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            Install MetaMask to use this application.
          </p>
          <a
            href="https://metamask.io/download"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-lg transition-colors">
            Install MetaMask
          </a>
        </div>
      </div>
    );

  // Sai network
  if (isConnected && chainId !== SUPPORTED_CHAIN_ID)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full border border-amber-800 rounded-xl p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-slate-200 mb-2">
            Wrong Network
          </h2>
          <p className="text-slate-400 text-sm mb-1">
            You are connected to chain ID{" "}
            <span className="text-amber-400 font-mono">{chainId}</span>.
          </p>
          <p className="text-slate-400 text-sm mb-5">
            Please switch to{" "}
            <span className="text-emerald-400 font-mono">
              {SUPPORTED_CHAIN_ID === 31337
                ? "Hardhat Local (31337)"
                : "Sepolia (11155111)"}
            </span>
            .
          </p>
          <button
            onClick={() => switchChain({ chainId: SUPPORTED_CHAIN_ID })}
            disabled={isPending}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-lg transition-colors">
            {isPending ? "Switching..." : "Switch Network"}
          </button>
        </div>
      </div>
    );

  return <>{children}</>;
}
