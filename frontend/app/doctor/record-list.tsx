"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useContracts } from "../../hooks/useContracts";
import { useAccess } from "../../hooks/useAccess";

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
  note: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

interface Props {
  patientDID: string;
}

export default function RecordList({ patientDID }: Props) {
  const { address } = useAccount();
  const { contracts } = useContracts();
  const { hasAccess } = useAccess();

  const [records, setRecords] = useState<Record[]>([]);
  const [access, setAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contracts || !address) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1. Check quyền trước
        const canAccess = await hasAccess(patientDID, address!);
        setAccess(canAccess);

        if (!canAccess) return;

        // 2. Nếu có quyền → lấy records
        const contract = await contracts!.getRecordRegistry();
        const result = await contract.getRecords(patientDID);
        setRecords([...result]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [contracts, address, patientDID]);

  if (loading) return <Skeleton />;

  // Không có quyền
  if (access === false)
    return (
      <div className="px-5 py-6 bg-red-950/50 border border-red-800 rounded-lg">
        <p className="text-red-400 font-bold text-sm mb-1">Access Denied</p>
        <p className="text-red-500/70 text-xs">
          You do not have permission to view this patient's records. Ask the
          patient to grant you access first.
        </p>
      </div>
    );

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
        <p className="text-zinc-500 text-sm">No records found</p>
      </div>
    );

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-4">{records.length} record(s)</p>
      <div className="flex flex-col gap-3">
        {records.map((record, i) => {
          const colorClass = TYPE_COLORS[record.recordType] ?? TYPE_COLORS.note;
          const date = new Date(Number(record.createdAt) * 1000);

          return (
            <div
              key={i}
              className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-medium uppercase tracking-wider ${colorClass}`}>
                  {record.recordType}
                </span>
                <span className="text-xs text-zinc-500">
                  {date.toLocaleDateString()} {date.toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mb-1">IPFS CID</p>
              <p className="text-sm text-zinc-300 font-mono truncate">
                {record.ipfsCID}
              </p>
              <p className="text-xs text-zinc-500 mt-2 mb-1">Created by</p>
              <p className="text-xs text-zinc-400 font-mono truncate">
                {record.createdBy}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="border border-zinc-800 rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-zinc-800 rounded w-20 mb-3" />
          <div className="h-3 bg-zinc-800 rounded w-full mb-2" />
          <div className="h-3 bg-zinc-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
