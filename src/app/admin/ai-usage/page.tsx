"use client";

import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { AlertTriangle } from "lucide-react";

export default function AdminAiUsagePage() {
  // Mock data
  const providers = [
    {
      name: "OpenAI",
      logo: "AI",
      bg: "bg-[#10A37F]",
      status: "Operational",
      statusColor: "text-[#4C7A5A]",
      metrics: [
        { label: "Requests today", value: "4,812" },
        { label: "Tokens used", value: "2.1M" },
        { label: "Avg latency", value: "640ms" },
        { label: "Spend today", value: "$18.40" },
        { label: "Retries (rate limit)", value: "22" },
      ],
    },
    {
      name: "Gemini",
      logo: "G",
      bg: "bg-[#4285F4]",
      status: "Degraded",
      statusColor: "text-[#E85D46]",
      metrics: [
        { label: "Requests today", value: "3,090" },
        { label: "Tokens used", value: "1.4M" },
        { label: "Avg latency", value: "510ms" },
        { label: "Spend today", value: "$9.10" },
        { label: "Timeouts", value: "131" },
      ],
    },
  ];

  return (
    <>
      <Topbar
        eyebrow="System"
        title="AI usage & cost"
        actions={
          <button className="rounded-md border border-[#E6DDC8] px-3 py-1.5 text-[12px] font-medium text-[#726B5C] hover:bg-[#EFE8D6]">
            Export CSV
          </button>
        }
      />

      {/* Alert */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#F0C4B8] bg-[#FBE1DB] px-4 py-3">
        <AlertTriangle size={18} className="text-[#E85D46]" />
        <p className="text-[12.5px]">
          <strong>Gemini error rate is up 4.2%</strong> in the last hour — mostly timeouts. Chat requests are falling back to OpenAI automatically.
        </p>
      </div>

      {/* Provider cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.name}>
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${provider.bg}`}>
                <span className="font-mono text-[13px] font-bold">{provider.logo}</span>
              </div>
              <div>
                <h3 className="font-serif text-[14.5px] font-semibold">{provider.name}</h3>
                <span className={`flex items-center gap-1.5 font-mono text-[10px] ${provider.statusColor}`}>
                  <span className={`relative inline-block h-1.5 w-1.5 rounded-full ${provider.status === "Operational" ? "bg-[#4C7A5A]" : "bg-[#E85D46]"}`} />
                  {provider.status}
                </span>
              </div>
            </div>
            {provider.metrics.map((m) => (
              <div key={m.label} className="flex justify-between border-t border-[#EFE8D6] py-2 text-[12.5px]">
                <span className="text-[#726B5C]">{m.label}</span>
                <span className="font-mono font-semibold">{m.value}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>

      {/* Spend chart (mock) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-[14.5px] font-semibold">Spend — last 7 days</h3>
            <span className="font-mono text-[11px] text-[#B3A98F]">total $412</span>
          </div>
          <div className="flex h-[120px] items-end gap-2">
            {[40, 58, 35, 70, 88, 52, 30].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-sm bg-[#4C7A5A]" style={{ height: `${h}%`, minHeight: "4px" }} />
                <span className="font-mono text-[10px] text-[#B3A98F]">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 font-serif text-[14.5px] font-semibold">Requests by route</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#6C63B0]" />
              <span className="text-[12.5px]">/api/summary</span>
              <span className="ml-auto font-mono text-[11.5px] text-[#726B5C]">3,102</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#4C7A5A]" />
              <span className="text-[12.5px]">/api/quiz/generate</span>
              <span className="ml-auto font-mono text-[11.5px] text-[#726B5C]">2,540</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#E85D46]" />
              <span className="text-[12.5px]">/api/chat</span>
              <span className="ml-auto font-mono text-[11.5px] text-[#726B5C]">1,880</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#5E7A96]" />
              <span className="text-[12.5px]">/api/flashcards/generate</span>
              <span className="ml-auto font-mono text-[11.5px] text-[#726B5C]">1,204</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}