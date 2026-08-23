"use client";

import {
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { Topbar } from "@/components/layout/Topbar";
import { getAdminActivity } from "@/services/admin.service";
import type { AdminActivityItem } from "@/types/admin";
import type { PaginationMeta } from "@/types/pagination";

const PAGE_SIZE = 25;

interface ActivityPage {
  data: AdminActivityItem[];
  meta: PaginationMeta;
}

function formatAction(action: string): string {
  return action
    .replace(/^admin\./, "")
    .replaceAll("_", " ");
}

function activityText(item: AdminActivityItem): string {
  if (
    typeof item.text === "string" &&
    item.text.trim()
  ) {
    return item.text;
  }

  return `${item.actorEmail ?? "System"} ${formatAction(item.action)}`;
}

function activityTone(action: string): string {
  if (
    action.includes("error") ||
    action.includes("failed") ||
    action.includes("deleted") ||
    action.includes("banned") ||
    action.includes("rate_limit")
  ) {
    return "bg-coral";
  }

  if (
    action.includes("created") ||
    action.includes("generated") ||
    action.includes("registered") ||
    action.includes("uploaded") ||
    action.includes("verified")
  ) {
    return "bg-sage";
  }

  return "bg-violet";
}

function formatTarget(item: AdminActivityItem): string {
  const metadataTarget = item.metadata?.targetEmail;

  if (
    typeof metadataTarget === "string" &&
    metadataTarget.trim()
  ) {
    return metadataTarget;
  }

  if (item.targetType && item.targetId) {
    return `${item.targetType} · ${item.targetId}`;
  }

  return item.targetType ?? item.targetId ?? "—";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

export default function AdminActivityPage() {
  const [page, setPage] = useState(1);
  const [activity, setActivity] =
    useState<ActivityPage | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async (requestedPage: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getAdminActivity({
        page: requestedPage,
        limit: PAGE_SIZE,
      });

      setActivity(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Activity could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(page);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load, page]);

  return (
    <>
      <Topbar eyebrow="Admin" title="Activity log" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-ink-faint">
            Review security, account, content, and AI audit events.
          </p>

          {activity && (
            <p className="mt-1 font-mono text-[10px] text-ink-faint">
              {activity.meta.total.toLocaleString()} events retained
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => void load(page)}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] text-ink-soft hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={isLoading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">
          {error}
        </div>
      )}

      <AdminPanel className="overflow-hidden p-0">
        {isLoading && !activity ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-12 animate-pulse rounded-lg bg-line-soft"
              />
            ))}
          </div>
        ) : activity?.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 text-right font-medium">Time</th>
                </tr>
              </thead>

              <tbody>
                {activity.data.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-line-soft last:border-0"
                  >
                    <td className="max-w-[360px] px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <span
                          className={[
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            activityTone(item.action),
                          ].join(" ")}
                        />
                        <p className="leading-5 text-ink">
                          {activityText(item)}
                        </p>
                      </div>
                    </td>

                    <td className="max-w-[220px] truncate px-4 py-3.5 text-ink-soft">
                      {item.actorEmail ?? "System"}
                    </td>

                    <td className="max-w-[260px] truncate px-4 py-3.5 text-ink-soft">
                      {formatTarget(item)}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-line-soft px-2.5 py-1 font-mono text-[9.5px] text-ink-soft">
                        {formatAction(item.action)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-[10px] text-ink-faint">
                      {formatTimestamp(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <History size={24} className="mb-3 text-ink-faint" />
            <p className="text-[13px] font-medium text-ink">
              No activity recorded
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">
              New audit events will appear here.
            </p>
          </div>
        )}
      </AdminPanel>

      {activity && activity.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-[12px] text-ink-soft">
          <button
            type="button"
            disabled={isLoading || !activity.meta.hasPrev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <span className="font-mono text-[10px]">
            Page {activity.meta.page} of {activity.meta.totalPages}
          </span>

          <button
            type="button"
            disabled={isLoading || !activity.meta.hasNext}
            onClick={() => setPage((current) => current + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
