"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { apiFetch } from "@/lib/api";

interface AdminNoteView {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  ownerEmail: string;
  status: "Indexed" | "Processing" | "Unknown";
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminContentPage() {
  const [notes, setNotes] = useState<AdminNoteView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "processing">("all");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch<AdminNoteView[]>("/admin/content?limit=50")
      .then((data) => { if (!cancelled) setNotes(data); })
      .catch((err) => { if (!cancelled) setError(err.message ?? "Failed to load content"); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = filter === "processing" ? notes.filter((n) => n.status === "Processing") : notes;
  const processingCount = notes.filter((n) => n.status === "Processing").length;

  return (
    <>
      <Topbar eyebrow="Manage" title="Content" />
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-medium ${
            filter === "all" ? "bg-ink text-paper-raised" : "border border-line text-ink-soft hover:border-ink-faint"
          }`}
        >
          All notes
        </button>
        <button
          onClick={() => setFilter("processing")}
          className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-medium ${
            filter === "processing" ? "bg-ink text-paper-raised" : "border border-line text-ink-soft hover:border-ink-faint"
          }`}
        >
          Processing · {processingCount}
        </button>
      </div>

      {error && <p className="mb-4 text-[13px] text-coral">{error}</p>}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-line-soft text-[10.5px] uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3 text-left font-semibold">Note</th>
              <th className="px-4 py-3 text-left font-semibold">Owner</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Size</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-soft">Loading…</td></tr>
            )}
            {!isLoading && visible.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-soft">No notes found.</td></tr>
            )}
            {!isLoading && visible.map((note) => {
              const statusTone = note.status === "Indexed" ? "sage" : note.status === "Processing" ? "yellow" : "neutral";
              const fileIcon = note.fileType === "pdf" ? "bg-coral-soft text-coral" : "bg-slate-soft text-slate";
              return (
                <tr key={note.id} className="border-b border-line-soft last:border-0 hover:bg-paper">
                  <td className="px-4 py-3 font-medium">{note.title}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-ink-soft">{note.ownerEmail}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${fileIcon}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {note.fileType.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-ink-soft">{formatSize(note.fileSize)}</td>
                  <td className="px-4 py-3">
                    <Chip tone={statusTone as any}>{note.status}</Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}