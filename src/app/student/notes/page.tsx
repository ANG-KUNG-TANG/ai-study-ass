"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Upload, CheckCircle, TrendingUp, Repeat, FilePlus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { NoteCard } from "@/components/notes/NoteCard";
import { UploadZone } from "@/components/notes/UploadZone";
import { useNotes } from "@/hooks/useNotes";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { notes, meta, isLoading, error, refetch } = useNotes({ limit: 3, sortBy: "createdAt" });

  const mostRecentNote = notes[0] ?? null;

  return (
    <>
      <Topbar
        title={`Welcome back${user?.name ? `, ${user.name}` : ""}`}
        search={{ value: search, onChange: setSearch, placeholder: "Search notes…" }}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard value={meta?.total ?? "—"} label="Notes uploaded" icon={Upload} tone="violet" delta="+12%" deltaType="up" />
        <StatCard value="—" label="Quizzes completed" icon={CheckCircle} tone="coral" delta="+8%" deltaType="up" />
        <StatCard value="—" label="Average quiz score" icon={TrendingUp} tone="sage" delta="+21%" deltaType="up" />
        <StatCard value="—" label="Cards reviewed" icon={Repeat} tone="slate" delta="−3%" deltaType="down" />
      </div>

      <UploadZone onUploaded={() => refetch()} />

      {mostRecentNote && (
        <div className="relative mb-8 overflow-hidden rounded-card bg-ink p-6 text-paper-raised shadow-sm transition hover:shadow-md">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow/10 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-yellow">
                Continue studying
              </div>
              <h3 className="font-serif text-[18px] font-semibold">{mostRecentNote.title}</h3>
              <p className="mt-1 text-[13px] text-ink-invert-soft">
                {mostRecentNote.summary
                  ? "You finished the summary. Quiz and flashcards are ready."
                  : "We're processing your note – come back soon."}
              </p>
            </div>
            <Link href={`/student/notes/${mostRecentNote.id}`}>
              <button className="group flex items-center rounded-md bg-yellow px-4 py-2 text-[13px] font-medium text-ink hover:brightness-95">
                Continue
                <ArrowRight className="ml-1 transition group-hover:translate-x-1" size={16} strokeWidth={1.8} />
              </button>
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-[17px] font-semibold text-ink">Recent notes</h2>
        <Link href="/student/notes" className="text-[13px] font-medium text-ink-soft hover:text-ink">
          View all
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-card border border-line bg-paper-raised p-4">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-lg bg-line-soft" />
                <div className="h-3 w-16 rounded bg-line-soft" />
              </div>
              <div className="mt-3 h-5 w-3/4 rounded bg-line-soft" />
              <div className="mt-2 h-4 w-1/2 rounded bg-line-soft" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-16 rounded-full bg-line-soft" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[13px] text-coral">{error}</p>}

      {!isLoading && !error && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-line bg-paper-raised p-12 text-center">
          <div className="mb-4 text-ink-faint">
            <FilePlus size={48} strokeWidth={1.5} />
          </div>
          <h3 className="font-serif text-lg font-semibold text-ink">No notes yet</h3>
          <p className="mt-1 text-sm text-ink-soft">Upload your first PDF or DOCX above to start learning.</p>
        </div>
      )}

      {!isLoading && !error && notes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={{
                ...note,
                summary: note.summary ?? undefined,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}