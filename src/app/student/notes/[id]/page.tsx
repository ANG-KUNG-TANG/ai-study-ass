"use client";
import { RefreshCw } from "lucide-react";
import { useNoteContext } from "@/context/NoteContext";
import { useSummary } from "@/hooks/useSummary";
import { parseSummary } from "@/lib/parse-summary";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";

export default function SummaryPage() {
  const { note, setNote } = useNoteContext();
  const { isGenerating, error, generate } = useSummary(note?.id ?? "");

  if (!note) return null; // layout already renders the loading/error state

  async function handleGenerate(force: boolean) {
    const result = await generate(force);
    if (result && note) setNote({ ...note, summary: result.summary });
  }

  const parsed = note.summary ? parseSummary(note.summary) : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Card className="max-h-[600px] overflow-y-auto">
        <h3 className="mb-3 font-serif text-[15px] font-semibold">Original text</h3>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{note.content}</p>
      </Card>

      <div>
        {!parsed && (
          <Card className="text-center">
            <p className="mb-4 text-[13px] text-ink-soft">No summary yet.</p>
            <Button onClick={() => handleGenerate(false)} disabled={isGenerating}>
              {isGenerating ? "Generating…" : "Generate summary"}
            </Button>
          </Card>
        )}

        {parsed && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-[15px] font-semibold">Summary</h3>
              <button
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                className="flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink disabled:opacity-50"
              >
                <RefreshCw size={13} strokeWidth={1.8} className={isGenerating ? "animate-spin" : ""} />
                Regenerate
              </button>
            </div>

            <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">{parsed.prose}</p>

            {parsed.keyPoints.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Key points
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {parsed.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-ink-soft">
                      <span className="text-ink-faint">·</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.importantConcepts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parsed.importantConcepts.map((c) => (
                  <Chip key={c} tone="violet" className="">{c}</Chip>
                ))}
              </div>
            )}
          </Card>
        )}

        {error && <p className="mt-3 text-[12px] text-coral">{error}</p>}
      </div>
    </div>
  );
}