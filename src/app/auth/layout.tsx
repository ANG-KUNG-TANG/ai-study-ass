"use client";

import {
  BookOpen,
  CheckCircle2,
  FileText,
  MessageSquareText,
} from "lucide-react";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

function BrandMark() {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-paper">
        <BookOpen size={18} strokeWidth={1.7} aria-hidden="true" />
        <span className="absolute bottom-1.5 left-2.5 h-0.5 w-4 bg-yellow" />
      </div>
      <span className="font-serif text-[20px] font-semibold tracking-[-0.02em] text-ink">
        {t("common.brand")}
      </span>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();

  return (
    <main className="min-h-dvh bg-paper px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between border-b border-line pb-4">
        <BrandMark />
        <LanguageSwitcher />
      </div>

      <div className="mx-auto grid min-h-[calc(100dvh-6rem)] w-full max-w-[1180px] lg:grid-cols-[minmax(0,1.08fr)_minmax(350px,0.72fr)]">
        <section className="hidden min-w-0 flex-col justify-center border-r border-line bg-yellow-soft/35 px-10 py-12 lg:flex xl:px-14">
          <span className="editorial-kicker">{t("auth.editorial.kicker")}</span>
          <h1 className="mt-4 max-w-[600px] font-serif text-[clamp(2.55rem,4vw,4.15rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
            {t("auth.hero.title")}
          </h1>
          <p className="mt-5 max-w-[560px] text-[15px] leading-7 text-ink-soft">
            {t("auth.hero.description")}
          </p>

          <div className="mt-9 max-w-[560px] border-y border-line">
            <div className="flex items-center gap-4 border-b border-line py-4">
              <FileText className="text-coral" size={19} strokeWidth={1.7} />
              <div>
                <strong className="text-[13px] font-semibold text-ink">{t("auth.editorial.sourceTitle")}</strong>
                <p className="mt-0.5 text-[12px] text-ink-soft">{t("auth.editorial.sourceDescription")}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 border-b border-line py-4">
              <CheckCircle2 className="text-sage" size={19} strokeWidth={1.7} />
              <div>
                <strong className="text-[13px] font-semibold text-ink">{t("auth.editorial.practiceTitle")}</strong>
                <p className="mt-0.5 text-[12px] text-ink-soft">{t("auth.editorial.practiceDescription")}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 py-4">
              <MessageSquareText className="text-violet" size={19} strokeWidth={1.7} />
              <div>
                <strong className="text-[13px] font-semibold text-ink">{t("auth.editorial.chatTitle")}</strong>
                <p className="mt-0.5 text-[12px] text-ink-soft">{t("auth.editorial.chatDescription")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 items-center justify-center bg-paper-raised px-2 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-[390px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
