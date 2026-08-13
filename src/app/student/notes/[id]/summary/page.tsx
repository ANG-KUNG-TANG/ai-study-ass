"use client";

import { useNoteContext } from "@/context/NoteContext";
import { parseSummary } from "@/lib/parse-summary";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";

export default function SummaryPage() {
  const { note } = useNoteContext();

  if (!note) return null;

  const parsed = note.summary ? parseSummary(note.summary) : null;

  return (
    <div className="space-y-5">
      {!parsed && (
        <Card className="flex min-h-[260px] flex-col items-center justify-center text-center">
          <h3 className="font-serif text-[16px] font-semibold">
            Study notes are not available yet
          </h3>

          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
            Study materials are generated automatically. Use
            &quot;Regenerate all study materials&quot; in the generation
            status panel if generation needs to be retried.
          </p>
        </Card>
      )}

      {parsed && (
        <Card>
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Generated study notes
            </p>

            <h3 className="mt-1 font-serif text-[18px] font-semibold">
              {note.title}
            </h3>
          </div>

          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Overview
          </h4>

          <p className="whitespace-pre-wrap text-[13px] leading-7 text-ink-soft">
            {parsed.prose}
          </p>

          {parsed.keyPoints.length > 0 && (
            <section className="mt-6">
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Key points
              </h4>

              <ul className="space-y-2">
                {parsed.keyPoints.map((point, index) => (
                  <li
                    key={`${point}-${index}`}
                    className="flex gap-3 text-[13px] leading-relaxed text-ink-soft"
                  >
                    <span>{index + 1}.</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {parsed.importantConcepts.length > 0 && (
            <section className="mt-6">
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Important concepts
              </h4>

              <div className="flex flex-wrap gap-1.5">
                {parsed.importantConcepts.map((concept) => (
                  <Chip key={concept} tone="violet">
                    {concept}
                  </Chip>
                ))}
              </div>
            </section>
          )}
        </Card>
      )}
    </div>
  );
}
