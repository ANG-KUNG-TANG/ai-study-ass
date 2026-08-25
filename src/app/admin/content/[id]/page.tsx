"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ban, RefreshCw, RotateCcw, Square, Trash2 } from "lucide-react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Topbar } from "@/components/layout/Topbar";
import {
  cancelAdminContent,
  deleteAdminContent,
  getAdminContent,
  quarantineAdminContent,
  restoreAdminContent,
  retryAdminContent,
} from "@/services/admin.service";
import type { AdminContentDetail } from "@/types/admin";

function reason(prompt: string): string | null {
  const value = window.prompt(prompt)?.trim();
  return value && value.length >= 3 ? value : null;
}

export default function AdminContentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [data, setData] = useState<AdminContentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getAdminContent(id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Content could not be loaded.");
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(
    label: string,
    action: (reasonValue: string) => Promise<unknown>,
  ) {
    const reasonValue = reason(`Reason for ${label.toLowerCase()}:`);
    if (!reasonValue) return;
    setBusy(true);
    try {
      await action(reasonValue);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar eyebrow="Admin · Content" title={data?.note.title ?? "Content detail"} />
      {error && <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">{error}</div>}
      {!data ? (
        <AdminPanel><p className="py-8 text-center text-[12px] text-ink-faint">Loading content record…</p></AdminPanel>
      ) : (
        <div className="space-y-5">
          <AdminPanel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[12px] text-ink-soft">
                  {data.note.fileName} · {data.note.fileType.toUpperCase()} · {(data.note.fileSize / 1024).toFixed(1)} KB
                  {data.note.sourcePageCount ? ` · ${data.note.sourcePageCount} pages` : ""}
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">Owner: {data.owner?.email ?? "Deleted account"} · Created {new Date(data.note.createdAt).toLocaleString()}</p>
                <p className="mt-2 text-[12px]">
                  Admin state: <span className={data.note.adminStatus === "quarantined" ? "text-coral" : "text-sage"}>{data.note.adminStatus}</span>
                  {data.note.quarantineReason ? ` · ${data.note.quarantineReason}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => void run("retrying generation", (value) => retryAdminContent(id, value))} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] hover:bg-line-soft disabled:opacity-50"><RefreshCw size={14} /> Retry</button>
                <button disabled={busy} onClick={() => void run("cancelling generation", (value) => cancelAdminContent(id, value))} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] hover:bg-line-soft disabled:opacity-50"><Square size={14} /> Cancel queued</button>
                {data.note.adminStatus === "quarantined" ? (
                  <button disabled={busy} onClick={() => void run("restoring content", (value) => restoreAdminContent(id, value))} className="inline-flex items-center gap-2 rounded-lg border border-sage/30 px-3 py-2 text-[12px] text-sage disabled:opacity-50"><RotateCcw size={14} /> Restore</button>
                ) : (
                  <button disabled={busy} onClick={() => void run("quarantining content", (value) => quarantineAdminContent(id, value))} className="inline-flex items-center gap-2 rounded-lg border border-coral/30 px-3 py-2 text-[12px] text-coral disabled:opacity-50"><Ban size={14} /> Quarantine</button>
                )}
                <button
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm("Permanently delete this content and its generated material?")) return;
                    void run("deleting content", async (value) => {
                      await deleteAdminContent(id, value);
                      router.push("/admin/content");
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-coral px-3 py-2 text-[12px] text-white disabled:opacity-50"
                ><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          </AdminPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminPanel>
              <h2 className="font-serif text-[16px] font-semibold">Processing</h2>
              <dl className="mt-4 space-y-2 text-[12px]">
                <div className="flex justify-between"><dt className="text-ink-soft">Generation stage</dt><dd>{data.generation?.stage ?? "Not started"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Intelligence stage</dt><dd>{data.intelligence?.stage ?? "Not started"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Queue state</dt><dd>{data.queue?.state ?? "No retained job"}</dd></div>
                {data.queue?.failedReason && <div className="rounded-lg bg-coral-soft p-3 text-coral">{data.queue.failedReason}</div>}
              </dl>
              {data.generation?.features && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {Object.entries(data.generation.features).map(([name, feature]) => (
                    <div key={name} className="rounded-lg border border-line p-3 text-[11px]"><p className="font-medium">{name}</p><p className="mt-1 text-ink-faint">{feature.status}{feature.error ? ` · ${feature.error}` : ""}</p></div>
                  ))}
                </div>
              )}
            </AdminPanel>

            <AdminPanel>
              <h2 className="font-serif text-[16px] font-semibold">AI usage for this note</h2>
              <p className="mt-2 text-[12px] text-ink-soft">{data.aiUsage.length} retained provider event(s)</p>
              <div className="mt-4 max-h-56 space-y-2 overflow-auto">
                {data.aiUsage.map((item) => (
                  <div key={item.id} className="flex justify-between rounded-lg border border-line p-2 text-[10px]"><span>{item.usageLabel} · {item.provider}</span><span>{item.tokensUsed.toLocaleString()} tokens · ${item.estimatedCostUsd.toFixed(6)}</span></div>
                ))}
                {data.aiUsage.length === 0 && <p className="text-[11px] text-ink-faint">No AI-provider usage is associated with this note.</p>}
              </div>
            </AdminPanel>
          </div>

          <AdminPanel>
            <h2 className="font-serif text-[16px] font-semibold">Extracted context preview</h2>
            <p className="mt-1 text-[10px] text-ink-faint">The original upload is removed from temporary storage after ingestion; this is the retained extracted text.</p>
            <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-line-soft p-4 font-mono text-[11px] leading-5 text-ink-soft">{data.extractedTextPreview}</pre>
          </AdminPanel>
        </div>
      )}
    </>
  );
}
