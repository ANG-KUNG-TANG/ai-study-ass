"use client";

import { useCallback, useEffect, useRef } from "react";
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
  const attempted = useRef(false);

  const handleGenerate = useCallback(async (force: boolean) => {
    if (!note) return;
    const result = await generate(force);
    if (result) setNote({ ...note, summary: result.summary });
  }, [generate, note, setNote]);

  useEffect(() => {
    if (!note || note.summary || isGenerating || attempted.current) return;
    attempted.current = true;
    void handleGenerate(false);
  }, [handleGenerate, isGenerating, note]);

  if (!note) return null;
  const parsed = note.summary ? parseSummary(note.summary) : null;

  return (
    <div className="space-y-5">
      {!parsed && (
        <Card className="flex min-h-[260px] flex-col items-center justify-center text-center">
          <RefreshCw size={24} className={isGenerating ? "mb-3 animate-spin" : "mb-3"} />
          <h3 className="font-serif text-[16px] font-semibold">
            {isGenerating ? "Generating study notes" : "Study notes are not available"}
          </h3>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
            {isGenerating
              ? "The paper is being condensed into structured revision notes."
              : "Automatic generation did not complete. Try again."}
          </p>
          {!isGenerating && (
            <Button className="mt-4" onClick={() => void handleGenerate(false)}>
              Generate summary
            </Button>
          )}
        </Card>
      )}

      {parsed && (
        <Card>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Generated study notes
              </p>
              <h3 className="mt-1 font-serif text-[18px] font-semibold">{note.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerate(true)}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-ink disabled:opacity-50"
            >
              <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
              {isGenerating ? "Regenerating" : "Regenerate"}
            </button>
          </div>

          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Overview</h4>
          <p className="whitespace-pre-wrap text-[13px] leading-7 text-ink-soft">{parsed.prose}</p>

          {parsed.keyPoints.length > 0 && (
            <section className="mt-6">
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Key points</h4>
              <ul className="space-y-2">
                {parsed.keyPoints.map((point, index) => (
                  <li key={`${point}-${index}`} className="flex gap-3 text-[13px] leading-relaxed text-ink-soft">
                    <span>{index + 1}.</span><span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {parsed.importantConcepts.length > 0 && (
            <section className="mt-6">
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Important concepts</h4>
              <div className="flex flex-wrap gap-1.5">
                {parsed.importantConcepts.map((concept) => (
                  <Chip key={concept} tone="violet">{concept}</Chip>
                ))}
              </div>
            </section>
          )}
        </Card>
      )}

      {error && <Card className="border-coral/30"><p className="text-[13px] text-coral">{error}</p></Card>}

    </div>
  );
}
