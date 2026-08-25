"use client";

import {
  Check,
  Download,
  LoaderCircle,
  NotebookPen,
  Plus,
  StickyNote as StickyNoteIcon,
  Trash2,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createStickyNote,
  deleteStickyNote,
  listStickyNotes,
} from "@/services/sticky-note.service";
import type { StickyNote } from "@/types/sticky-note";

const DRAFT_KEY = "ai-study-assistant:sticky-note-draft:v1";
const MAX_CONTENT_LENGTH = 10_000;
const RECENT_NOTE_LIMIT = 20;

type AssistantView = "compose" | "saved";

function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function slugFromContent(content: string): string {
  const slug = content
    .slice(0, 42)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "study-note";
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function noteAsText(note: StickyNote): string {
  const source = note.sourcePath ? `\nSource: ${note.sourcePath}` : "";
  return `${note.content}${source}\nSaved: ${new Date(note.createdAt).toLocaleString()}\n`;
}

export function FloatingStudyNoteAssistant() {
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AssistantView>("compose");
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  const remaining = MAX_CONTENT_LENGTH - draft.length;
  const showRemaining = remaining <= 1_000;

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setNotesError(null);

    try {
      setNotes(await listStickyNotes(RECENT_NOTE_LIMIT));
    } catch (err) {
      setNotesError(
        err instanceof Error ? err.message : "Could not load saved notes",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedDraft = window.localStorage.getItem(DRAFT_KEY);
    if (!storedDraft) return;

    const timer = window.setTimeout(() => {
      setDraft(storedDraft);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft) {
        window.localStorage.setItem(DRAFT_KEY, draft);
      } else {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!isOpen) return;

    const loadTimer = window.setTimeout(() => {
      void loadNotes();
    }, 0);

    const focusTimer = window.setTimeout(() => {
      if (view === "compose") textareaRef.current?.focus();
    }, 80);

    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, loadNotes, view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        return;
      }

      if (
        event.key.toLowerCase() === "n" &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();

        if (isOpen) {
          setIsOpen(false);
        } else {
          setView("compose");
          setMessage(null);
          setError(null);
          setIsOpen(true);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const exportText = useMemo(
    () =>
      notes
        .slice()
        .reverse()
        .map((note, index) => `# Quick note ${index + 1}\n${noteAsText(note)}`)
        .join("\n"),
    [notes],
  );

  function handleToggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setView("compose");
    setMessage(null);
    setError(null);
    setIsOpen(true);
  }

  function handleShowSavedNotes() {
    setView("saved");
    setMessage(null);
    setError(null);
  }

  function handleNewNote() {
    setView("compose");
    setMessage(null);
    setError(null);

    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function handleSave() {
    const content = draft.trim();
    if (!content || isSaving) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await createStickyNote({
        content,
        sourcePath: pathname,
      });

      setNotes((current) => [saved, ...current.filter((note) => note.id !== saved.id)].slice(0, RECENT_NOTE_LIMIT));
      setDraft("");
      window.localStorage.removeItem(DRAFT_KEY);
      setMessage("Note saved");
      setView("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this note");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;

    setDeletingId(id);
    setNotesError(null);

    try {
      await deleteStickyNote(id);
      setNotes((current) => current.filter((note) => note.id !== id));
    } catch (err) {
      setNotesError(
        err instanceof Error ? err.message : "Could not delete this note",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {isOpen ? (
        <section
          aria-label="Study note assistant"
          className="fixed bottom-20 right-3 z-50 flex max-h-[min(440px,calc(100dvh-6rem))] w-[min(320px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[20px] border border-line bg-paper-raised shadow-xl sm:right-5"
        >
          <header className="flex min-h-12 items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-yellow-soft text-ink">
                {view === "compose" ? (
                  <NotebookPen className="size-4" aria-hidden="true" />
                ) : (
                  <StickyNoteIcon className="size-4" aria-hidden="true" />
                )}
              </span>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-ink">
                  {view === "compose" ? "Quick note" : "Saved notes"}
                </h2>
                {message ? (
                  <p className="truncate text-[10px] font-medium text-sage">
                    ✓ {message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {view === "compose" ? (
                <button
                  type="button"
                  onClick={handleShowSavedNotes}
                  className="grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow"
                  aria-label="View saved notes"
                  title="Saved notes"
                >
                  <StickyNoteIcon className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNewNote}
                  className="grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow"
                  aria-label="Write a new note"
                  title="New note"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow"
                aria-label="Close study note assistant"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {view === "compose" ? (
            <div className="p-3">
              <label htmlFor="floating-study-note" className="sr-only">
                Quick study note
              </label>

              <textarea
                ref={textareaRef}
                id="floating-study-note"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_CONTENT_LENGTH}
                rows={4}
                placeholder="Write a note…"
                className="min-h-28 w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm leading-5 text-ink outline-none transition placeholder:text-ink-faint focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
              />

              {error ? (
                <p className="mt-2 text-xs leading-4 text-coral" aria-live="polite">
                  {error}
                </p>
              ) : null}

              <div className="mt-2.5 flex min-h-9 items-center justify-between gap-2">
                <span
                  className={`text-[10px] ${showRemaining ? (remaining < 250 ? "text-coral" : "text-ink-faint") : "invisible"}`}
                  aria-hidden={!showRemaining}
                >
                  {remaining.toLocaleString()} left
                </span>

                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!draft.trim() || isSaving}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow"
                >
                  {isSaving ? (
                    <LoaderCircle
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="size-3.5" aria-hidden="true" />
                  )}
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5">
                <span className="text-[10px] font-medium text-ink-faint">
                  {notes.length === 1 ? "1 note" : `${notes.length} notes`}
                </span>

                <button
                  type="button"
                  disabled={notes.length === 0}
                  onClick={() =>
                    downloadText(
                      `study-notes-${new Date().toISOString().slice(0, 10)}.txt`,
                      exportText,
                    )
                  }
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium text-ink-soft transition hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download all
                </button>
              </div>

              {notesError ? (
                <p className="px-3 pb-2 text-xs leading-4 text-coral" aria-live="polite">
                  {notesError}
                </p>
              ) : null}

              {isLoading ? (
                <div className="grid place-items-center px-3 py-8 text-ink-soft">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Loading saved notes</span>
                </div>
              ) : notes.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <StickyNoteIcon
                    className="mx-auto mb-2 size-5 text-ink-faint"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-ink-soft">No saved notes yet.</p>
                  <button
                    type="button"
                    onClick={handleNewNote}
                    className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-full bg-ink px-3 text-[11px] font-semibold text-white"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    New note
                  </button>
                </div>
              ) : (
                <ul className="space-y-1.5 px-2.5 pb-2.5">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-xl border border-line-soft bg-paper px-2.5 py-2"
                    >
                      <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-ink">
                        {note.content}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 text-[9px] leading-3 text-ink-faint">
                          <div>{formatCreatedAt(note.createdAt)}</div>
                          {note.sourcePath ? (
                            <div
                              className="max-w-44 truncate"
                              title={note.sourcePath}
                            >
                              {note.sourcePath}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              downloadText(
                                `${slugFromContent(note.content)}.txt`,
                                noteAsText(note),
                              )
                            }
                            className="grid size-7 place-items-center rounded-full text-ink-soft transition hover:bg-paper-raised hover:text-ink"
                            aria-label="Download this note"
                            title="Download note"
                          >
                            <Download className="size-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === note.id}
                            onClick={() => void handleDelete(note.id)}
                            className="grid size-7 place-items-center rounded-full text-ink-soft transition hover:bg-coral-soft hover:text-coral disabled:opacity-35"
                            aria-label="Delete this note"
                            title="Delete note"
                          >
                            {deletingId === note.id ? (
                              <LoaderCircle
                                className="size-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isOpen ? "Close quick study notes" : "Open quick study notes"}
        aria-expanded={isOpen}
        className="fixed bottom-4 right-3 z-50 grid size-12 place-items-center rounded-full border border-white/70 bg-ink/90 text-white shadow-[0_10px_28px_rgba(34,31,26,0.24)] backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow/40 sm:right-5"
      >
        <span
          className="absolute inset-1 rounded-full border border-white/15"
          aria-hidden="true"
        />
        <StickyNoteIcon className="relative size-4" aria-hidden="true" />
        {draft.trim() ? (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-paper bg-yellow"
            aria-label="Unsaved draft"
          />
        ) : null}
      </button>
    </>
  );
}
