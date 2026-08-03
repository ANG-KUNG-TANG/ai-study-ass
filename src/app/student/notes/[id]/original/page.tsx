"use client";

import {
  Check,
  Copy,
  FileText,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import {
  Card,
} from "@/components/ui/Card";
import {
  useNoteContext,
} from "@/context/NoteContext";

export default function OriginalTextPage() {
  const {
    note,
  } = useNoteContext();

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const content =
    note?.content?.trim() ??
    "";

  const wordCount =
    useMemo(
      () =>
        content
          ? content
              .split(
                /\s+/,
              )
              .filter(
                Boolean,
              ).length
          : 0,
      [
        content,
      ],
    );

  if (
    !note
  ) {
    return null;
  }

  async function copyText() {
    if (
      !content
    ) {
      return;
    }

    await navigator.clipboard.writeText(
      content,
    );

    setCopied(
      true,
    );

    window.setTimeout(
      () =>
        setCopied(
          false,
        ),
      1_500,
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <FileText
                size={14}
                aria-hidden="true"
              />

              Source document
            </div>

            <h2 className="mt-2 font-serif text-[19px] font-semibold">
              Original extracted text
            </h2>

            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              This is the text extracted from the uploaded document before
              study-note generation.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void copyText()
            }
            disabled={
              !content
            }
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-ink-soft transition hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? (
              <Check
                size={14}
                aria-hidden="true"
              />
            ) : (
              <Copy
                size={14}
                aria-hidden="true"
              />
            )}

            {copied
              ? "Copied"
              : "Copy text"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 text-[11px] text-ink-faint">
          <span>
            {wordCount.toLocaleString()} words
          </span>

          <span aria-hidden="true">
            ·
          </span>

          <span>
            {content.length.toLocaleString()} characters
          </span>
        </div>
      </Card>

      {content ? (
        <Card className="max-h-[70vh] overflow-y-auto">
          <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-6 text-ink-soft">
            {content}
          </pre>
        </Card>
      ) : (
        <Card className="flex min-h-[220px] flex-col items-center justify-center text-center">
          <FileText
            size={24}
            className="text-ink-faint"
            aria-hidden="true"
          />

          <h3 className="mt-3 font-serif text-[16px] font-semibold">
            No extracted text available
          </h3>

          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
            This note does not contain stored source text. Re-upload or
            reprocess the document to restore it.
          </p>
        </Card>
      )}
    </div>
  );
}
