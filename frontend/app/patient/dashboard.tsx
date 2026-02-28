"use client";

import { useEffect, useState } from "react";
import { useContracts } from "../../hooks/useContracts";

interface Record {
  ipfsCID: string;
  dataHash: string;
  recordType: string;
  createdBy: string;
  createdAt: bigint;
}

const TYPE_COLORS: Record<string, string> = {
  lab: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  imaging: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  prescription: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  note: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

interface Props {
  patientDID: string;
}

export default function DashboardPage({ patientDID }: Props) {
  const { contracts } = useContracts();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("patientDID:", patientDID);
    if (!contracts) {
      console.log("no contracts");
      return;
    }

    if (!contracts) return;

    contracts
      .getRecordRegistry()
      .then((c) => {
        console.log("contract address:", c.target);
        return c.getRecords(patientDID);
      })
      .then((r) => {
        console.log("records:", r);
        setRecords(r);
      })
      .catch((e) => {
        console.error("error:", e);
        setError(e.message);
      });

    contracts
      .getRecordRegistry()
      .then((c) => c.getRecords(patientDID))
      .then(setRecords)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contracts, patientDID]);

  if (loading) return <Skeleton />;

  if (error)
    return (
      <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">
        {error}
      </div>
    );

  if (records.length === 0)
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <div className="text-3xl">🗂️</div>
        <p className="text-slate-500 text-sm">No records yet</p>
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-200">
          Your Records
          <span className="ml-2 text-xs text-slate-500 font-normal">
            {records.length} total
          </span>
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {records.map((record, i) => (
          <RecordCard key={i} record={record} />
        ))}
      </div>
    </div>
  );
}

function RecordCard({ record }: { record: Record }) {
  const colorClass = TYPE_COLORS[record.recordType] ?? TYPE_COLORS.note;
  const date = new Date(Number(record.createdAt) * 1000);

  return (
    <div className="border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors bg-slate-900/50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded border font-medium uppercase tracking-wider ${colorClass}`}>
              {record.recordType}
            </span>
            <span className="text-xs text-slate-500">
              {date.toLocaleDateString()} {date.toLocaleTimeString()}
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-1">IPFS CID</p>
          <p className="text-sm text-slate-300 font-mono truncate">
            {record.ipfsCID}
          </p>

          <p className="text-xs text-slate-500 mt-2 mb-1">Created by</p>
          <p className="text-xs text-slate-400 font-mono truncate">
            {record.createdBy}
          </p>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="border border-slate-800 rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-slate-800 rounded w-24 mb-3" />
          <div className="h-3 bg-slate-800 rounded w-full mb-2" />
          <div className="h-3 bg-slate-800 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
