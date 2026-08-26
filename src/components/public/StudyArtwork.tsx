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
      <div
        className="absolute inset-0 opacity-70 [background-image:radial-gradient(#E6DDC8_1.25px,transparent_1.25px)] [background-size:28px_28px]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full px-8 py-12 xl:px-12 2xl:px-16">
        <h2 className="max-w-[760px] text-[clamp(2.7rem,4.2vw,4.8rem)] font-bold leading-[0.93] tracking-[-0.07em] text-ink">
          {t("auth.hero.title")}
        </h2>
        <p className="mt-6 max-w-[690px] text-[14px] leading-7 text-ink-soft xl:text-[15px]">
          {t("auth.hero.description")}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-3 xl:gap-4">
          {features.map(({ icon: Icon, label, iconClass, surfaceClass }) => (
            <div
              key={label}
              className="flex min-h-[132px] flex-col justify-between rounded-[16px] border border-line bg-paper-raised/95 p-4 xl:min-h-[150px] xl:p-5"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full ${surfaceClass} ${iconClass}`}
              >
                <Icon size={21} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <strong className="mt-5 text-[12px] font-bold leading-5 tracking-[-0.02em] text-ink xl:text-[13px]">
                {t(label)}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
