"use client";

import { useEffect, useState } from "react";
import { useAccess } from "../../hooks/useAccess";

interface LogEntry {
  actor: string;
  action: string;
  timestamp: bigint;
  patientDID: string;
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  VIEW: "text-blue-400 border-blue-500/40 bg-blue-500/10",
  GRANT: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  REVOKE: "text-red-400 border-red-500/40 bg-red-500/10",
  EMERGENCY: "text-purple-400 border-purple-500/40 bg-purple-500/10",
};

interface Props {
  patientDID: string;
}

export default function AuditLogPage({ patientDID }: Props) {
  const { getAuditLogs } = useAccess();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuditLogs(patientDID)
      .then((l) => setLogs([...l].reverse())) // mới nhất lên trên
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientDID]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error)
    return (
      <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">
        {error}
      </div>
    );

  if (logs.length === 0)
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <div className="text-3xl">📋</div>
        <p className="text-slate-500 text-sm">No activity yet</p>
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-200">
          Activity Log
          <span className="ml-2 text-xs text-slate-500 font-normal">
            {logs.length} events
          </span>
        </h2>
      </div>

      {/* Timeline */}
      <div className="relative flex flex-col gap-0">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800" />

        {logs.map((log, i) => {
          const style = ACTION_STYLES[log.action] ?? ACTION_STYLES.VIEW;
          const date = new Date(Number(log.timestamp) * 1000);

          return (
            <div key={i} className="flex gap-4 pb-6">
              {/* Dot */}
              <div className="relative z-10 mt-1 w-3.5 h-3.5 rounded-full border-2 border-slate-700 bg-slate-950 flex-shrink-0" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${style}`}>
                    {log.action}
                  </span>
                  <span className="text-xs text-slate-600">
                    {date.toLocaleDateString()} {date.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {log.actor}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
