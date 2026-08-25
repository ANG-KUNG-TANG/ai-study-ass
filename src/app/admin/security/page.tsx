"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Topbar } from "@/components/layout/Topbar";
import { getAdminSecurity } from "@/services/admin.service";
import type { SecurityReport } from "@/types/admin";

export default function AdminSecurityPage() {
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setReport(await getAdminSecurity(windowMinutes));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Security report is unavailable.");
    }
  }, [windowMinutes]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <Topbar eyebrow="Admin · Security" title="Security monitoring" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="text-[12px] text-ink-soft">Analysis window <select value={windowMinutes} onChange={(event) => setWindowMinutes(Number(event.target.value))} className="ml-2 rounded-lg border border-line bg-transparent px-2 py-1.5"><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={360}>6 hours</option><option value={1440}>24 hours</option></select></label>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px]"><RefreshCw size={14} /> Refresh</button>
      </div>
      {error && <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">{error}</div>}
      {report && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Events scanned", report.scannedEvents], ["Critical", report.summary.critical], ["High", report.summary.high], ["Medium", report.summary.medium]].map(([label, value]) => <AdminPanel key={label}><p className="text-[10px] text-ink-faint">{label}</p><p className="mt-2 font-serif text-2xl font-semibold">{value}</p></AdminPanel>)}</div>
          <AdminPanel className="p-0">
            {report.signals.length ? report.signals.map((signal) => (
              <div key={`${signal.type}:${signal.firstSeen}:${signal.actorId ?? signal.ip ?? "system"}`} className="flex gap-3 border-b border-line-soft p-4 last:border-0">
                <ShieldAlert size={17} className={signal.severity === "critical" ? "text-coral" : signal.severity === "high" ? "text-amber-500" : "text-violet"} />
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[13px] font-medium">{signal.title}</h2><span className="rounded-full bg-line-soft px-2 py-0.5 font-mono text-[9px] uppercase">{signal.severity}</span></div><p className="mt-1 text-[11px] text-ink-soft">{signal.description}</p><p className="mt-2 text-[10px] text-ink-faint">Count {signal.count} · {signal.actorEmail ?? signal.ip ?? "System"} · Last seen {new Date(signal.lastSeen).toLocaleString()}</p></div>
              </div>
            )) : <div className="p-12 text-center text-[12px] text-ink-faint">No security signals were detected in this window.</div>}
          </AdminPanel>
        </div>
      )}
    </>
  );
}
