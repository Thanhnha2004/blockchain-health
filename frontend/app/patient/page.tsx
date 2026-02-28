"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useDID } from "../../hooks/useDID";
import { useContracts } from "../../hooks/useContracts";
import OnboardingPage from "./onboarding";
import DashboardPage from "./dashboard";
import GrantAccessPage from "./grant-access";
import AuditLogPage from "./audit-log";

type Tab = "dashboard" | "grant" | "audit";

export default function PatientApp() {
  const { address, isConnected } = useAccount();
  const { contracts, isConnected: contractsReady } = useContracts();
  const { getMyDID } = useDID();
  const [myDID, setMyDID] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [checking, setChecking] = useState(false);

  // page.tsx
  useEffect(() => {
    if (!isConnected || !address || !contractsReady || !contracts) {
      setMyDID(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    getMyDID()
      .then((did) => {
        setMyDID(did);
      })
      .catch((e) => {
        setMyDID(null);
      })
      .finally(() => setChecking(false));
  }, [isConnected, address, contractsReady, contracts]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-bold tracking-widest uppercase text-emerald-400">
            MedChain
          </span>
          <span className="text-slate-600 text-xs">/ Patient Portal</span>
        </div>
        <ConnectButton />
      </header>

      {/* Body */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {!isConnected ? (
          <NotConnected />
        ) : checking ? (
          <Loading />
        ) : myDID === null ? (
          <OnboardingPage onRegistered={setMyDID} />
        ) : (
          <>
            {/* Tabs */}
            <nav className="flex gap-1 mb-8 border border-slate-800 rounded-lg p-1 w-fit">
              {(["dashboard", "grant", "audit"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-xs uppercase tracking-widest rounded transition-all ${
                    tab === t
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}>
                  {t === "dashboard"
                    ? "Records"
                    : t === "grant"
                    ? "Access"
                    : "Audit"}
                </button>
              ))}
            </nav>

            {tab === "dashboard" && <DashboardPage patientDID={myDID} />}
            {tab === "grant" && <GrantAccessPage patientDID={myDID} />}
            {tab === "audit" && <AuditLogPage patientDID={myDID} />}
          </>
        )}
      </main>
    </div>
  );
}

function NotConnected() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="text-4xl">🔒</div>
      <p className="text-slate-400 text-sm tracking-wide">
        Connect your wallet to continue
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
