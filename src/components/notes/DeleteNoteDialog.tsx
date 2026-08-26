"use client";

import { LoaderCircle, Trash2, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

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
  const { t } = useLanguage();

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
        className="w-full max-w-md rounded-[10px] border border-line bg-paper-raised p-5 shadow-[0_18px_60px_rgba(34,31,26,0.16)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-coral-soft text-coral">
            <Trash2 size={18} strokeWidth={1.8} />
          </div>

          <button
            type="button"
            aria-label={t("note.deleteDialog.close")}
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
          {t("note.deleteDialog.title")}
        </h2>

        <p
          id="delete-note-description"
          className="mt-2 text-[13px] leading-5 text-ink-soft"
        >
          {t("note.deleteDialog.description", { title })}
        </p>

        <p className="mt-2 text-[12px] text-coral">
          {t("note.deleteDialog.warning")}
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-[8px] border border-coral/20 bg-coral-soft px-3 py-2 text-[12px] text-coral"
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
            {t("common.cancel")}
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
                {t("common.deleting")}
              </>
            ) : (
              <>
                <Trash2 size={15} strokeWidth={1.8} />
                {t("common.delete")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
