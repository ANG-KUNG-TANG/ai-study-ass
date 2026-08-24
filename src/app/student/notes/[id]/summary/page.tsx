"use client";

import { useCallback, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useNoteContext } from "@/context/NoteContext";
import { useSummary } from "@/hooks/useSummary";
import { parseSummary } from "@/lib/parse-summary";
import type {
  ParsedSummaryListItem,
  ParsedSummarySection,
} from "@/lib/parse-summary";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/context/LanguageContext";

export default function SummaryPage() {
  const { t } = useLanguage();
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
          <RefreshCw
            aria-hidden="true"
            size={24}
            className={isGenerating ? "mb-3 animate-spin" : "mb-3"}
          />
          <h3 className="font-serif text-[16px] font-semibold">
            {isGenerating ? t("summary.generating") : t("summary.unavailable")}
          </h3>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
            {isGenerating
              ? t("summary.generatingDescription")
              : t("summary.retryDescription")}
          </p>
          {!isGenerating && (
            <Button className="mt-4" onClick={() => void handleGenerate(false)}>
              {t("summary.generate")}
            </Button>
          )}
        </Card>
      )}

      {parsed && (
        <Card>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {t("summary.generated")}
              </p>
              <h3 className="mt-1 font-serif text-[18px] font-semibold">
                {parsed.title ?? note.title}
              </h3>
            </div>
            <button
              type="button"
              aria-label={t("summary.regenerate")}
              onClick={() => void handleGenerate(true)}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-ink disabled:opacity-50"
            >
              {isGenerating ? t("summary.regenerating") : t("summary.regenerate")}
            </button>
          </div>

          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{t("summary.overview")}</h4>
          <p className="whitespace-pre-wrap text-[13px] leading-7 text-ink-soft">{parsed.prose}</p>

          {parsed.keyPoints.length > 0 && (
            <section className="mt-6">
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{t("summary.keyPoints")}</h4>
              <ol className="list-decimal space-y-2 pl-5 marker:text-ink-faint">
                {parsed.keyPoints.map((point, index) => (
                  <li
                    key={`${point}-${index}`}
                    className="pl-1 text-[13px] leading-relaxed text-ink-soft"
                  >
                    {point}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {parsed.importantConcepts.length > 0 && (
            <section className="mt-6">
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{t("summary.concepts")}</h4>
              <ul className="flex flex-wrap gap-1.5">
                {parsed.importantConcepts.map((concept) => (
                  <li key={concept}>
                    <Chip tone="violet">{concept}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {parsed.sections.map((section, index) => (
            <SummarySection
              key={`${section.heading}-${index}`}
              section={section}
            />
          ))}
        </Card>
      )}

      {error && <Card className="border-coral/30"><p className="text-[13px] text-coral">{error}</p></Card>}

    </div>
  );
}

function SummarySection({
  section,
}: {
  section: ParsedSummarySection;
}) {
  return (
    <section className="mt-7 border-t border-line pt-6">
      <h4 className="font-serif text-[17px] font-semibold text-ink">
        {section.heading}
      </h4>

      {section.paragraphs.map((paragraph, index) => (
        <p
          key={`${paragraph}-${index}`}
          className="mt-3 whitespace-pre-wrap text-[13px] leading-7 text-ink-soft"
        >
          {paragraph}
        </p>
      ))}

      {section.items.length > 0 && (
        <SummaryList items={section.items} className="mt-3 text-[13px]" />
      )}

      {section.subsections.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {section.subsections.map((subsection, index) => (
            <article
              key={`${subsection.heading}-${index}`}
              className="rounded-xl border border-line bg-paper p-4"
            >
              <h5 className="font-serif text-[15px] font-semibold text-ink">
                {subsection.heading}
              </h5>

              {subsection.paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={`${paragraph}-${paragraphIndex}`}
                  className="mt-2 text-[12.5px] leading-6 text-ink-soft"
                >
                  {paragraph}
                </p>
              ))}

              {subsection.items.length > 0 && (
                <SummaryList
                  items={subsection.items}
                  className="mt-2 text-[12.5px]"
                />
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryList({
  items,
  className,
}: {
  items: ParsedSummaryListItem[];
  className: string;
}) {
  return (
    <ul className={`${className} space-y-1.5 pl-5 leading-6 text-ink-soft`}>
      {items.map((item, index) => (
        <li
          key={`${item.text}-${index}`}
          className="list-disc pl-1 marker:text-ink-faint"
        >
          {item.text}
          {item.children.length > 0 && (
            <ul className="mt-1 space-y-1 pl-5">
              {item.children.map((child, childIndex) => (
                <li
                  key={`${child}-${childIndex}`}
                  className="list-[circle] pl-1 marker:text-ink-faint"
                >
                  {child}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
