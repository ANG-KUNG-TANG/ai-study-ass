"use client";

import Link from "next/link";
import { FileText, MessageSquare, Layers, HelpCircle } from "lucide-react";
import { useNoteContext } from "@/context/NoteContext";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { relativeTime } from "@/lib/relative-time";

export default function NoteOverviewPage() {
  const { note } = useNoteContext();

  if (!note) return null; // layout already renders the loading/error state

  const actions = [
    { href: `/student/notes/${note.id}/summary`, icon: FileText, label: "Summary", desc: "Read the AI-generated summary" },
    { href: `/student/notes/${note.id}/quiz`, icon: HelpCircle, label: "Quiz", desc: "Test yourself on this note" },
    { href: `/student/notes/${note.id}/flashcard`, icon: Layers, label: "Flashcards", desc: "Review with spaced repetition" },
    { href: `/student/notes/${note.id}/chat`, icon: MessageSquare, label: "Chat", desc: "Ask questions about this note" },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Card className="max-h-[600px] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-[15px] font-semibold">Original text</h3>
          <Chip tone="neutral">{note.fileType.toUpperCase()}</Chip>
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{note.content}</p>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <h3 className="mb-3 font-serif text-[15px] font-semibold">Details</h3>
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-ink-soft">Uploaded</span>
              <span>{relativeTime(note.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Summary</span>
              <span>{note.summary ? "Ready" : "Not generated yet"}</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="cursor-pointer transition hover:-translate-y-1 hover:shadow-lg">
                <action.icon size={18} strokeWidth={1.8} className="mb-2 text-ink-soft" />
                <h4 className="font-serif text-[13.5px] font-semibold">{action.label}</h4>
                <p className="mt-0.5 text-[11.5px] text-ink-faint">{action.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}