"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, HelpCircle, Activity } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { getHealth } from "@/services/health.service";
import type { HealthCheck } from "@/types/health";

function StatusIcon({ ok }: { ok: boolean | undefined }) {
  if (ok === true) return <CheckCircle2 size={16} className="text-[#4C7A5A]" />;
  if (ok === false) return <XCircle size={16} className="text-[#E85D46]" />;
  return <HelpCircle size={16} className="text-[#B3A98F]" />;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  // Mock additional stats (could come from a separate endpoint)
  const stats = [
    { value: "18ms", label: "MongoDB avg query time", icon: Activity },
    { value: "99.97%", label: "Uptime (30 days)", icon: Activity },
    { value: "7", label: "Errors — last 24h", icon: Activity },
    { value: "312MB", label: "Memory usage", icon: Activity },
  ];

  return (
    <>
      <Topbar eyebrow="System" title="Health & infrastructure" />

      {isLoading && <p className="text-[13px] text-[#726B5C]">Checking system health…</p>}
      {error && <p className="text-[13px] text-[#E85D46]">{error}</p>}

      {health && (
        <>
          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} value={stat.value} label={stat.label} icon={stat.icon} />
            ))}
          </div>

          {/* Detailed checks */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 font-serif text-[14.5px] font-semibold">Recent errors</h3>
              <div className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#E85D46]" />
                  <div>
                    <p className="text-[12.5px]"><strong>AIError (502)</strong> — Gemini request timed out after 12s</p>
                    <span className="font-mono text-[10.5px] text-[#B3A98F]">14 min ago</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#E85D46]" />
                  <div>
                    <p className="text-[12.5px]"><strong>ValidationError (422)</strong> — quiz options array length &lt; 2</p>
                    <span className="font-mono text-[10.5px] text-[#B3A98F]">51 min ago</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#FFCE3E]" />
                  <div>
                    <p className="text-[12.5px]"><strong>RateLimitError (429)</strong> — IP 44.192.x.x exceeded 20 req/min</p>
                    <span className="font-mono text-[10.5px] text-[#B3A98F]">1 hr ago</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="mb-4 font-serif text-[14.5px] font-semibold">Service checklist</h3>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "Database connection pool", status: "healthy" },
                  { label: "Auth / JWT service", status: "healthy" },
                  { label: "Upload & parser pipeline", status: "healthy" },
                  { label: "Gemini adapter", status: "degraded" },
                  { label: "Rate limiter (Redis)", status: "healthy" },
                ].map((item) => {
                  const isDegraded = item.status === "degraded";
                  return (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#EFE8D6] px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`relative h-2 w-2 rounded-full ${isDegraded ? "bg-[#FFCE3E]" : "bg-[#4C7A5A]"}`} />
                        <span className="text-[12.5px] font-medium">{item.label}</span>
                      </div>
                      <span className="font-mono text-[11.5px] text-[#726B5C]">{item.status}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Raw payload toggle (optional) */}
          <details className="mt-6">
            <summary className="cursor-pointer text-[12px] text-[#B3A98F]">Raw response</summary>
            <pre className="mt-2 overflow-x-auto rounded-2xl border border-[#E6DDC8] bg-white p-4 text-[11px] text-[#726B5C]">
              {JSON.stringify(health, null, 2)}
            </pre>
          </details>
        </>
      )}
    </>
  );
}