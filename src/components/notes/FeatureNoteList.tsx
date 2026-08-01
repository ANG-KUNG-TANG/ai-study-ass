"use client";

import { useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { useNotes } from "@/hooks/useNotes";

type Feature = "summary" | "quiz" | "flashcards" | "chat";

const FEATURE_CONFIG: Record<
  Feature,
  {
    eyebrow: string;
    title: string;
    description: string;
    emptyMessage: string;
    routeSegment: string;
    badge: string;
    badgeClass: string;
  }
> = {
  summary: {
    eyebrow: "Study",
    title: "All summaries",
    description: "Open generated study notes",
    emptyMessage: "No notes yet — upload a document to generate summaries.",
    routeSegment: "summary",
    badge: "Summary",
    badgeClass: "bg-[#FFF1C2] text-[#221F1A]",
  },
  quiz: {
    eyebrow: "Practice",
    title: "All quizzes",
    description: "Generate and take a quiz",
    emptyMessage: "No notes yet — upload a document to generate quizzes.",
    routeSegment: "quiz",
    badge: "Quiz",
    badgeClass: "bg-[#E7E4F5] text-[#6C63B0]",
  },
  flashcards: {
    eyebrow: "Practice",
    title: "All flashcards",
    description: "Generate and review flashcards",
    emptyMessage: "No notes yet — upload a document to generate flashcards.",
    routeSegment: "flashcard",
    badge: "Flashcards",
    badgeClass: "bg-[#FFF1C2] text-[#221F1A]",
  },
  chat: {
    eyebrow: "AI",
    title: "Chat with your notes",
    description: "Ask questions about this document",
    emptyMessage: "No notes yet — upload a document to start a chat.",
    routeSegment: "chat",
    badge: "Chat",
    badgeClass: "bg-[#E7E4F5] text-[#6C63B0]",
  },
};

export function FeatureNoteList({ feature }: { feature: Feature }) {
  const config = FEATURE_CONFIG[feature];
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { notes, meta, isLoading, error } = useNotes({
    limit: 20,
    page,
    search: search || undefined,
  });

  return (
    <>
      <Topbar
        eyebrow={config.eyebrow}
        title={config.title}
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Search notes…",
        }}
      />

      {isLoading && (
        <p className="text-[13px] text-ink-soft">Loading notes…</p>
      )}

      {error && (
        <p className="text-[13px] text-coral">{error}</p>
      )}

      {!isLoading && !error && notes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E6DDC8] bg-white p-8 text-center">
          <p className="text-[13px] text-ink-soft">
            {config.emptyMessage}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <Link
            key={note.id}
            href={`/student/notes/${note.id}/${config.routeSegment}`}
          >
            <Card className="cursor-pointer transition hover:-translate-y-1 hover:shadow-lg">
              <h3 className="font-serif text-[15px] font-semibold">
                {note.title}
              </h3>

              <p className="mt-1 text-[13px] text-ink-soft">
                {config.description}
              </p>

              <div className="mt-3">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] ${config.badgeClass}`}
                >
                  {config.badge}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-[12px] text-ink-soft">
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={!meta.hasPrev}
            className="disabled:opacity-30"
          >
            Previous
          </button>

          <span>
            Page {meta.page} of {meta.totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={!meta.hasNext}
            className="disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
