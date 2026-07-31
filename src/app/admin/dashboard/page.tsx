"use client";

import { useEffect, useState } from "react";
import { Users, FileText, HelpCircle, Sparkles } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import * as adminService from "@/services/admin.service";

interface OverviewStats {
  totalUsers: number;
  totalNotes: number;
  totalQuizzes: number;
}

export default function AdminDashboardPage() {
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  useEffect(() => {
    adminService
      .getOverviewStats()
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setIsLoadingOverview(false));
  }, []);

  // Real: totalUsers, totalNotes, totalQuizzes from /api/admin/overview.
  // Mock: AI spend (needs cost-per-token tracking that doesn't exist yet).
  const stats = [
    {
      value: isLoadingOverview ? "—" : overview?.totalUsers ?? "—",
      label: "Total users",
      icon: Users,
      tone: "violet" as const,
    },
    {
      value: isLoadingOverview ? "—" : overview?.totalNotes ?? "—",
      label: "Notes uploaded",
      icon: FileText,
      tone: "coral" as const,
    },
    {
      value: isLoadingOverview ? "—" : overview?.totalQuizzes ?? "—",
      label: "Quizzes generated",
      icon: HelpCircle,
      tone: "sage" as const,
    },
    {
      value: "$412",
      label: "AI spend this month (mock)",
      icon: Sparkles,
      tone: "slate" as const,
    },
  ];

  // ---- Bar chart (last 7 days) — MOCK: needs a request/event log ----
  const barData = [
    { day: "Mon", height: 52 },
    { day: "Tue", height: 68 },
    { day: "Wed", height: 44 },
    { day: "Thu", height: 80 },
    { day: "Fri", height: 95 },
    { day: "Sat", height: 61 },
    { day: "Sun", height: 38 },
  ];

  // ---- Activity feed — MOCK: needs a request/event log ----
  const activities = [
    { dotColor: "bg-sage", text: <><strong>maria.santos@upenn.edu</strong> uploaded a new note</>, time: "2 min ago" },
    { dotColor: "bg-coral", text: <><strong>Rate limit</strong> hit on /api/quiz/generate from IP 44.192.x.x</>, time: "18 min ago" },
    { dotColor: "bg-violet", text: <><strong>j.oduya@gmail.com</strong> generated a flashcard deck (22 cards)</>, time: "32 min ago" },
    { dotColor: "bg-sage", text: <><strong>New signup</strong> — thabo.m@wits.ac.za</>, time: "1 hr ago" },
    { dotColor: "bg-coral", text: <><strong>AIError</strong> — Gemini timeout on chat request, fell back to OpenAI</>, time: "2 hrs ago" },
  ];

  // ---- System status — MOCK: needs live provider ping / health aggregation ----
  const systemStatus = [
    { label: "MongoDB Atlas", value: "18ms", status: "healthy" },
    { label: "OpenAI API", value: "640ms avg", status: "healthy" },
    { label: "Gemini API", value: "510ms avg", status: "degraded" },
    { label: "Rate limiter", value: "3 hits / 15min", status: "healthy" },
    { label: "Uptime", value: "99.97% · 30d", status: "healthy" },
  ];

  return (
    <>
      <Topbar
        eyebrow="Wednesday, July 1"
        title="System overview"
        search={{ value: search, onChange: setSearch, placeholder: "Search users, notes…" }}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} value={stat.value} label={stat.label} icon={stat.icon} tone={stat.tone} />
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-[14.5px] font-semibold">Requests — last 7 days</h3>
            <span className="font-mono text-[11px] text-ink-faint">total 24,110 (mock)</span>
          </div>
          <div className="flex h-[140px] items-end gap-2 pt-4">
            {barData.map((item) => {
              const isPeak = item.height === 95;
              return (
                <div key={item.day} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-t-sm ${isPeak ? "bg-coral" : "bg-violet"} transition-all`}
                    style={{ height: `${item.height}%`, minHeight: "4px" }}
                  />
                  <span className="font-mono text-[10px] text-ink-faint">{item.day}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-serif text-[14.5px] font-semibold">Generation split (mock)</h3>
          <div className="flex items-center gap-5">
            <div
              className="h-[108px] w-[108px] flex-shrink-0 rounded-full"
              style={{ background: "conic-gradient(#6C63B0 0% 62%, #4C7A5A 62% 90%, #E85D46 90% 100%)" }}
            >
              <div className="relative h-full w-full">
                <div className="absolute inset-4 rounded-full bg-paper-raised" />
              </div>
            </div>
            <div className="flex flex-col gap-2 text-[12.5px]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet" /> Summaries
                <span className="ml-auto font-mono text-[11.5px] text-ink-soft">62%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sage" /> Quizzes
                <span className="ml-auto font-mono text-[11.5px] text-ink-soft">28%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-coral" /> Chat
                <span className="ml-auto font-mono text-[11.5px] text-ink-soft">10%</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-[14.5px] font-semibold">Recent activity (mock)</h3>
            <button className="font-mono text-[11px] text-ink-soft hover:text-ink">View log</button>
          </div>
          <div className="flex flex-col gap-4">
            {activities.map((item, idx) => (
              <div key={idx} className="flex gap-3">
                <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.dotColor}`} />
                <div>
                  <p className="text-[12.5px] leading-relaxed">{item.text}</p>
                  <span className="font-mono text-[10.5px] text-ink-faint">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-serif text-[14.5px] font-semibold">System status (mock)</h3>
          <div className="flex flex-col gap-2.5">
            {systemStatus.map((item) => {
              const isDegraded = item.status === "degraded";
              const dotColor = isDegraded ? "bg-yellow" : "bg-sage";
              return (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`relative h-2 w-2 rounded-full ${dotColor}`} />
                    <span className="text-[12.5px] font-medium">{item.label}</span>
                  </div>
                  <span className="font-mono text-[11.5px] text-ink-soft">{item.value}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}