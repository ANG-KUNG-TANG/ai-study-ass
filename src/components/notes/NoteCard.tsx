"use client";

import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  File,
  FileSpreadsheet,
  Trash2,
  LoaderCircle,
} from "lucide-react";
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
  isDeleting?: boolean;
}

function getFileIcon(fileType: string = "pdf") {
  const type = fileType.toLowerCase();

  if (type.includes("pdf")) {
    return {
      icon: FileText,
      bg: "bg-coral-soft text-coral",
    };
  }

  if (type.includes("doc")) {
    return {
      icon: File,
      bg: "bg-slate-soft text-slate",
    };
  }

  return {
    icon: FileSpreadsheet,
    bg: "bg-violet-soft text-violet",
  };
}

export function NoteCard({
  note,
  onDelete,
  isDeleting = false,
}: NoteCardProps) {
  const { icon: FileIcon, bg } = getFileIcon(note.fileType);
  const timeAgo = formatDistanceToNow(new Date(note.createdAt), {
    addSuffix: true,
  });

  return (
    <Card
      className="group relative cursor-pointer transition hover:-translate-y-1 hover:shadow-lg"
      onClick={() => {
        if (!isDeleting) {
          window.location.assign(`/student/notes/${note.id}`);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}
        >
          <Icon icon={FileIcon} size={16} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10.5px] text-ink-faint">
            {timeAgo}
          </span>

          {onDelete && (
            <button
              type="button"
              title={`Delete ${note.title}`}
              aria-label={`Delete ${note.title}`}
              disabled={isDeleting}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(note.id);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-coral-soft hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? (
                <LoaderCircle
                  className="animate-spin"
                  size={15}
                  strokeWidth={1.8}
                />
              ) : (
                <Trash2 size={15} strokeWidth={1.8} />
              )}
            </button>
          )}
        </div>
      </div>

      <h4 className="mt-3 font-serif text-[15px] font-semibold leading-snug text-ink">
        {note.title}
      </h4>

      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
        {note.summary || "No summary yet"}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {note.status === "ready" && (
          <Chip tone="sage" className="text-[10px]">
            Summary ready
          </Chip>
        )}

        {note.status === "processing" && (
          <Chip tone="neutral" className="text-[10px]">
            Processing…
          </Chip>
        )}

        {note.quizCount && note.quizCount > 0 && (
          <Chip tone="violet" className="text-[10px]">
            Quiz: {note.quizCount}
          </Chip>
        )}

        {note.flashcardCount && note.flashcardCount > 0 && (
          <Chip tone="yellow" className="text-[10px]">
            Cards: {note.flashcardCount}
          </Chip>
        )}
      </div>
    </Card>
  );
}
