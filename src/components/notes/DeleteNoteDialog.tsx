"use client";

import { LoaderCircle, Trash2, X } from "lucide-react";

interface DeleteNoteDialogProps {
  open: boolean;
  title: string;
  isDeleting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteNoteDialog({
  open,
  title,
  isDeleting = false,
  error,
  onCancel,
  onConfirm,
}: DeleteNoteDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/45 px-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-note-title"
        aria-describedby="delete-note-description"
        className="w-full max-w-md rounded-2xl border border-line bg-paper-raised p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral-soft text-coral">
            <Trash2 size={18} strokeWidth={1.8} />
          </div>

          <button
            type="button"
            aria-label="Close delete dialog"
            disabled={isDeleting}
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <h2
          id="delete-note-title"
          className="mt-4 font-serif text-[19px] font-semibold text-ink"
        >
          Delete this paper?
        </h2>

        <p
          id="delete-note-description"
          className="mt-2 text-[13px] leading-5 text-ink-soft"
        >
          <span className="font-medium text-ink">“{title}”</span> will be
          permanently deleted together with its summary, quiz, flashcards,
          chat, knowledge and generated study data.
        </p>

        <p className="mt-2 text-[12px] text-coral">
          This action cannot be undone.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-coral/20 bg-coral-soft px-3 py-2 text-[12px] text-coral"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-lg border border-line bg-paper-raised px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-lg bg-coral px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <LoaderCircle
                  className="animate-spin"
                  size={15}
                  strokeWidth={1.8}
                />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={15} strokeWidth={1.8} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
