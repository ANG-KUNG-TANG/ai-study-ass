"use client";

import { formatDistanceToNow } from "date-fns";
import { FileText, File, FileSpreadsheet, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";

interface NoteCardProps {
  note: {
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
    fileType?: string;
    quizCount?: number;
    flashcardCount?: number;
    status?: "ready" | "processing";
  };
  onDelete?: (id: string) => void;
}

function getFileIcon(fileType: string = "pdf") {
  const type = fileType.toLowerCase();
  if (type.includes("pdf")) return { icon: FileText, bg: "bg-coral-soft text-coral" };
  if (type.includes("doc")) return { icon: File, bg: "bg-slate-soft text-slate" };
  return { icon: FileSpreadsheet, bg: "bg-violet-soft text-violet" };
}

export function NoteCard({ note, onDelete }: NoteCardProps) {
  const { icon: FileIcon, bg } = getFileIcon(note.fileType);
  const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true });

  return (
    <Card
      className="group cursor-pointer transition hover:-translate-y-1 hover:shadow-lg"
      onClick={() => window.location.assign(`/student/notes/${note.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
          <Icon icon={FileIcon} size={16} />
        </div>
        <span className="font-mono text-[10.5px] text-ink-faint">{timeAgo}</span>
      </div>

      <h4 className="mt-3 font-serif text-[15px] font-semibold leading-snug text-ink">{note.title}</h4>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft line-clamp-2">
        {note.summary || "No summary yet"}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {note.status === "ready" && <Chip tone="sage" className="text-[10px]">Summary ready</Chip>}
        {note.status === "processing" && <Chip tone="neutral" className="text-[10px]">Processing…</Chip>}
        {note.quizCount && note.quizCount > 0 && (
          <Chip tone="violet" className="text-[10px]">Quiz: {note.quizCount}</Chip>
        )}
        {note.flashcardCount && note.flashcardCount > 0 && (
          <Chip tone="yellow" className="text-[10px]">Cards: {note.flashcardCount}</Chip>
        )}
      </div>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this note?")) onDelete(note.id);
          }}
          className="absolute right-3 top-3 rounded-md p-1 text-ink-faint opacity-0 transition hover:bg-coral-soft hover:text-coral group-hover:opacity-100"
        >
          <MoreVertical size={15} strokeWidth={1.8} />
        </button>
      )}
    </Card>
  );
}