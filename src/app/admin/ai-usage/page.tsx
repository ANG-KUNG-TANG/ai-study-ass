"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getAdminAIUsage } from "@/services/admin.service";
import type { AdminAIUsage } from "@/types/admin";

const emptyUsage: AdminAIUsage = {
  providers: [],
  monthlySpend: 0,
  requestsLastSevenDays: [],
  requestsByRoute: [],
};

export default function AdminAIUsagePage() {
  const [data, setData] = useState<AdminAIUsage>(emptyUsage);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAdminAIUsage()
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "AI usage is unavailable.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Topbar eyebrow="System" title="AI usage & cost" />

      {error && (
        <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">
          {error}
        </div>
      )}

      {data.warning && (
        <div className="mb-5 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">
          {data.warning}
        </div>
      )}

      <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.providers.map((provider) => (
          <AdminPanel key={provider.provider}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-[16px] font-semibold capitalize text-ink">
                {provider.provider}
              </h2>

              <span className="rounded-full bg-line-soft px-2.5 py-1 font-mono text-[10px] uppercase text-ink-soft">
                {provider.status}
              </span>
            </div>

            <div className="divide-y divide-line-soft">
              {[
                ["Requests today", provider.requestsToday.toLocaleString()],
                ["Tokens today", provider.tokensToday.toLocaleString()],
                ["Average latency", `${provider.averageLatencyMs}ms`],
                ["Spend today", `$${provider.spendToday.toFixed(2)}`],
                ["Failures today", provider.failuresToday.toLocaleString()],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between py-2.5 text-[12px]"
                >
                  <span className="text-ink-soft">{label}</span>

                  <span className="font-mono text-ink">{value}</span>
                </div>
              ))}
            </div>
          </AdminPanel>
        ))}

        {data.providers.length === 0 && (
          <AdminPanel className="md:col-span-2">
            <p className="py-8 text-center text-[12px] text-ink-faint">
              No AI usage metrics are available.
            </p>
          </AdminPanel>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminPanel>
          <h2 className="font-serif text-[16px] font-semibold text-ink">
            Monthly spend
          </h2>

          <p className="mt-5 font-serif text-4xl font-semibold text-ink">
            ${data.monthlySpend.toFixed(2)}
          </p>
        </AdminPanel>

        <AdminPanel>
          <h2 className="mb-4 font-serif text-[16px] font-semibold text-ink">
            Requests by route
          </h2>

          <div className="space-y-3">
            {data.requestsByRoute.map((item) => (
              <div
                key={item.route}
                className="flex items-center justify-between text-[12px]"
              >
                <span className="text-ink-soft">{item.route}</span>

                <span className="font-mono text-ink">
                  {item.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </AdminPanel>
      </section>
    </>
  );
}
