"use client";

import {
  CircleHelp,
  FileText,
  Layers3,
  Lightbulb,
  MessageSquareText,
  StickyNote,
} from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

const features: Array<{
  icon: typeof FileText;
  label: TranslationKey;
  iconClass: string;
  surfaceClass: string;
}> = [
  {
    icon: FileText,
    label: "auth.feature.summaries",
    iconClass: "text-coral",
    surfaceClass: "bg-coral-soft",
  },
  {
    icon: Layers3,
    label: "auth.feature.flashcards",
    iconClass: "text-sage",
    surfaceClass: "bg-sage-soft",
  },
  {
    icon: CircleHelp,
    label: "auth.feature.quizzes",
    iconClass: "text-violet",
    surfaceClass: "bg-violet-soft",
  },
  {
    icon: Lightbulb,
    label: "auth.feature.explanations",
    iconClass: "text-yellow-700",
    surfaceClass: "bg-yellow-soft",
  },
  {
    icon: MessageSquareText,
    label: "auth.feature.chat",
    iconClass: "text-coral",
    surfaceClass: "bg-coral-soft",
  },
  {
    icon: StickyNote,
    label: "auth.feature.notes",
    iconClass: "text-sage",
    surfaceClass: "bg-sage-soft",
  },
];

export function StudyArtwork() {
  const { t } = useLanguage();

  return (
    <section className="relative hidden min-h-full overflow-hidden border-l border-line bg-yellow-soft/30 lg:flex lg:items-center">
      {/* Subtle background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#E6DDC8_1px,transparent_1px)] [background-size:26px_26px]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-[760px] px-7 py-10 xl:px-10 2xl:px-12">
        {/* Heading */}
        <div className="max-w-[600px]">
          <h2 className="text-[clamp(2rem,3vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-ink">
            {t("auth.hero.title")}
          </h2>

          <p className="mt-4 max-w-[560px] text-sm leading-6 text-ink-soft">
            {t("auth.hero.description")}
          </p>
        </div>

        {/* Feature cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-3">
          {features.map(({ icon: Icon, label, iconClass, surfaceClass }) => (
            <article
              key={label}
              className="flex min-h-[104px] flex-col justify-between rounded-xl border border-line bg-paper-raised/95 p-4 transition-colors duration-200 hover:border-yellow"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${surfaceClass} ${iconClass}`}
              >
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              </span>

              <strong className="mt-3 text-xs font-semibold leading-5 tracking-tight text-ink">
                {t(label)}
              </strong>
            </article>
          ))}
        </div>

        {/* Small decorative footer */}
        <div className="mt-5 flex items-center gap-2 text-[11px] text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-sage" />
          <span>{t("home.learningLoop")}</span>
        </div>
      </div>
    </section>
  );
}
