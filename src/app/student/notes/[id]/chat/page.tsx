"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { useNotes } from "@/hooks/useNotes";

export default function ChatLandingPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { notes, meta, isLoading, error } = useNotes({
    limit: 20,
    page,
    search: search || undefined,
  });
  const router = useRouter();

  return (
    <>
      <Topbar
        eyebrow="AI"
        title="Chat with your notes"
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Search notes…" }}
      />

      {isLoading && <p className="text-[13px] text-[#726B5C]">Loading notes…</p>}
      {error && <p className="text-[13px] text-[#E85D46]">{error}</p>}

      {!isLoading && !error && notes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E6DDC8] bg-white p-8 text-center">
          <p className="text-[13px] text-[#726B5C]">No notes yet – upload one to start a chat.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <Card
            key={note.id}
            className="cursor-pointer transition hover:-translate-y-1 hover:shadow-lg"
            onClick={() => router.push(`/student/notes/${note.id}/chat`)}
          >
            <h3 className="font-serif text-[15px] font-semibold">{note.title}</h3>
            <p className="mt-1 text-[13px] text-[#726B5C]">Ask questions about this note</p>
            <div className="mt-3">
              <span className="rounded-full bg-[#E7E4F5] px-3 py-1 text-[11px] text-[#6C63B0]">
                Chat
              </span>
            </div>
          </Card>
        ))}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-[12px] text-[#726B5C]">
          <button onClick={() => setPage((p) => p - 1)} disabled={!meta.hasPrev} className="disabled:opacity-30">
            Prev
          </button>
          <span>Page {meta.page} of {meta.totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={!meta.hasNext} className="disabled:opacity-30">
            Next
          </button>
        </div>
      )}
    </>
  );
}