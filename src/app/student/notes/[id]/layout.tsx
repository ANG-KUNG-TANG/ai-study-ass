"use client";
import { use } from "react";
import { NoteProvider, useNoteContext } from "@/context/NoteContext";
import { NoteTabs } from "@/components/notes/NoteTabs";
import { useLanguage } from "@/context/LanguageContext";

function NoteLayoutInner({ noteId, children }: { noteId: string; children: React.ReactNode }) {
  const { note, isLoading, error } = useNoteContext();
  const { t } = useLanguage();

  if (isLoading) return <p className="text-[13px] text-ink-soft">{t("note.loading")}</p>;
  if (error || !note) return <p className="text-[13px] text-coral">{error ?? t("note.notFound")}</p>;

  return (
    <>
      <header className="mb-5 border-b border-line pb-5">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-coral">
          {t("document.eyebrow", { type: note.fileType.toUpperCase() })}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[25px] font-semibold tracking-[-0.015em] text-ink">{note.title}</h1>
            <p className="mt-1 text-[12px] text-ink-soft">{t("document.description")}</p>
          </div>
          <span className="rounded-full border border-line bg-sage-soft px-2.5 py-1 text-[10px] font-semibold text-sage">{t("document.sourceReady")}</span>
        </div>
      </header>
      <NoteTabs noteId={noteId} />
      {children}
    </>
  );
}

export default function NoteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <NoteProvider noteId={id}>
      <NoteLayoutInner noteId={id}>{children}</NoteLayoutInner>
    </NoteProvider>
  );
}
