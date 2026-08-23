"use client";

import {
  CircleHelp,
  FileText,
  Layers,
  Lightbulb,
  MessageCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

const primaryFeatures: ReadonlyArray<{
  label: TranslationKey;
  icon: typeof FileText;
  iconStyle: string;
}> = [
  {
    label: "auth.feature.summaries",
    icon: FileText,
    iconStyle: "bg-coral-soft text-coral",
  },
  {
    label: "auth.feature.flashcards",
    icon: Layers,
    iconStyle: "bg-sage-soft text-sage",
  },
  {
    label: "auth.feature.quizzes",
    icon: CircleHelp,
    iconStyle: "bg-violet-soft text-violet",
  },
];

const secondaryFeatures: typeof primaryFeatures = [
  {
    label: "auth.feature.explanations",
    icon: Lightbulb,
    iconStyle: "bg-yellow-soft text-yellow",
  },
  {
    label: "auth.feature.chat",
    icon: MessageCircle,
    iconStyle: "bg-coral-soft text-coral",
  },
];

function BrandMark() {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-ink shadow-[0_5px_14px_rgba(34,31,26,0.11)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[18px] w-[18px] text-paper"
          aria-hidden="true"
        >
          <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M8 9h8M8 13h5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute bottom-[5px] left-[11px] h-[2px] w-4 rounded-full bg-yellow" />
      </div>

      <span className="font-serif text-[22px] font-semibold tracking-[-0.02em] text-ink">
        {t("common.brand")}
      </span>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();

  return (
    <main
      className="relative min-h-screen px-5 py-5 sm:px-8 lg:px-9 lg:py-7 xl:px-12"
      style={{
        backgroundImage:
          "radial-gradient(circle, #EFE8D6 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        backgroundColor: "#FAF6EC",
      }}
    >
      <LanguageSwitcher className="absolute right-5 top-5 z-10 sm:right-8 lg:right-9 lg:top-7 xl:right-12" />

      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-[1160px] lg:grid-cols-[minmax(0,1.04fr)_1px_minmax(360px,0.78fr)] lg:gap-8 xl:gap-12">
        <section className="hidden min-w-0 flex-col justify-center lg:flex">
          <BrandMark />

          <div className="mt-10 max-w-[530px] xl:mt-12">
            <h1 className="font-serif text-[clamp(2.5rem,3.15vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-ink">
              {t("auth.hero.title")}
            </h1>
            <p className="mt-4 max-w-[500px] text-[15px] leading-6 text-ink-soft">
              {t("auth.hero.description")}
            </p>
          </div>

          <div className="mt-7 max-w-[530px]">
            <div className="grid grid-cols-3 gap-3">
              {primaryFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="flex min-h-[126px] flex-col items-center justify-center rounded-[15px] border border-line bg-paper-raised/90 px-3 text-center shadow-[0_6px_18px_rgba(34,31,26,0.04)]"
                  >
                    <span
                      className={`mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full ${feature.iconStyle}`}
                    >
                      <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-semibold text-ink">
                      {t(feature.label)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid max-w-[460px] grid-cols-2 gap-3 pl-6">
              {secondaryFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="flex min-h-[60px] items-center gap-3 rounded-[13px] border border-line bg-paper-raised/90 px-3.5 shadow-[0_6px_18px_rgba(34,31,26,0.035)]"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${feature.iconStyle}`}
                    >
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-semibold text-ink">
                      {t(feature.label)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div
          className="my-5 hidden w-px bg-line lg:block"
          aria-hidden="true"
        />

        <section className="flex min-w-0 items-center justify-center py-3 lg:py-5">
          <div className="w-full max-w-[390px]">
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandMark />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
