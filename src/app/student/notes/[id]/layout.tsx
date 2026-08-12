"use client";

import { use, type ReactNode } from "react";

import { NoteProvider, useNoteContext } from "@/context/NoteContext";

import { NoteTabs } from "@/components/notes/NoteTabs";
import { StudyGenerationProgress } from "@/components/notes/StudyGenerationProgress";

// ─── Inner layout ──────────────────────────────────────────────────────────────

function NoteLayoutInner({
  noteId,
  children,
}: {
  noteId: string;
  children: ReactNode;
}) {
  const { note, isLoading, error } = useNoteContext();

  if (isLoading) {
    return <p className="text-[13px] text-ink-soft">Loading note…</p>;
  }

  if (error || !note) {
    return (
      <p className="text-[13px] text-coral">{error ?? "Note not found"}</p>
    );
  }

  return (
    <>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-coral">
        {note.fileType.toUpperCase()}
      </div>

      <h1 className="mb-5 font-serif text-[24px] font-semibold">
        {note.title}
      </h1>

      <NoteTabs noteId={noteId} />

      <StudyGenerationProgress noteId={noteId} />

      {children}
    </>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────────

export default function NoteLayout({
  children,
  params,
}: {
  children: ReactNode;

  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = use(params);

  return (
    <NoteProvider noteId={id}>
      <NoteLayoutInner noteId={id}>{children}</NoteLayoutInner>
    </NoteProvider>
  );
}
