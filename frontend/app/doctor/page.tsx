"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import SearchPatient from "./search-patient";
import RecordList from "./record-list";
import UploadRecord from "./upload-record";
import EmergencyAccess from "./emergency-access";

type Tab = "records" | "upload";

export default function DoctorApp() {
  const { isConnected } = useAccount();
  const [patientDID, setPatientDID] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("records");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-sm font-bold tracking-widest uppercase text-sky-400">
            MedChain
          </span>
          <span className="text-zinc-600 text-xs">/ Doctor Portal</span>
        </div>
        <ConnectButton />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {!isConnected ? (
          <NotConnected />
        ) : (
          <>
            {/* Search */}
            <SearchPatient onFound={setPatientDID} />

            {patientDID && (
              <div className="mt-8">
                {/* Patient DID badge */}
                <div className="mb-6 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Patient DID</p>
                    <p className="text-sm text-zinc-300 font-mono break-all">
                      {patientDID}
                    </p>
                  </div>
                  <button
                    onClick={() => setPatientDID(null)}
                    className="text-zinc-600 hover:text-zinc-400 text-xs ml-4">
                    ✕ Clear
                  </button>
                </div>
                {/* Tabs */}
                <nav className="flex gap-1 mb-6 border border-zinc-800 rounded-lg p-1 w-fit">
                  {(["records", "upload"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-2 text-xs uppercase tracking-widest rounded transition-all ${
                        tab === t
                          ? "bg-sky-500 text-zinc-950 font-bold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}>
                      {t === "records" ? "Records" : "Upload"}
                    </button>
                  ))}
                </nav>
                {tab === "records" && (
                  <>
                    <RecordList patientDID={patientDID} />
                    <div className="mt-6">
                      <EmergencyAccess patientDID={patientDID} />
                    </div>
                  </>
                )}{" "}
                {tab === "upload" && <UploadRecord patientDID={patientDID} />}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NotConnected() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="text-4xl">🩺</div>
      <p className="text-zinc-400 text-sm tracking-wide">
        Connect your wallet to continue
      </p>
    </div>
  );
}
