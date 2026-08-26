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
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-5 py-4 sm:px-7">
          <BrandMark />
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] items-start gap-7 px-5 py-8 sm:px-7 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.72fr)] lg:gap-10 lg:py-12">
        <section className="hidden min-w-0 border-y border-line bg-yellow-soft/40 px-8 py-9 lg:block xl:px-10 xl:py-10">
          <span className="editorial-kicker">{t("auth.editorial.kicker")}</span>
          <h1 className="mt-4 max-w-[520px] font-serif text-[clamp(2.3rem,3.25vw,3.35rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-ink">
            {t("auth.hero.title")}
          </h1>
          <p className="mt-4 max-w-[500px] text-[13.5px] leading-6 text-ink-soft">
            {t("auth.hero.description")}
          </p>

          <div className="mt-7 max-w-[520px] border-y border-line">
            <div className="flex items-start gap-3 border-b border-line py-3.5">
              <FileText className="mt-0.5 text-coral" size={17} strokeWidth={1.7} />
              <div>
                <strong className="text-[12.5px] font-semibold text-ink">{t("auth.editorial.sourceTitle")}</strong>
                <p className="mt-0.5 text-[11.5px] leading-5 text-ink-soft">{t("auth.editorial.sourceDescription")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-line py-3.5">
              <CheckCircle2 className="mt-0.5 text-sage" size={17} strokeWidth={1.7} />
              <div>
                <strong className="text-[12.5px] font-semibold text-ink">{t("auth.editorial.practiceTitle")}</strong>
                <p className="mt-0.5 text-[11.5px] leading-5 text-ink-soft">{t("auth.editorial.practiceDescription")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3.5">
              <MessageSquareText className="mt-0.5 text-violet" size={17} strokeWidth={1.7} />
              <div>
                <strong className="text-[12.5px] font-semibold text-ink">{t("auth.editorial.chatTitle")}</strong>
                <p className="mt-0.5 text-[11.5px] leading-5 text-ink-soft">{t("auth.editorial.chatDescription")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full max-w-[460px] justify-self-center rounded-[10px] border border-line border-t-[3px] border-t-yellow bg-paper-raised px-6 py-7 sm:px-8 sm:py-8 lg:justify-self-end">
          <div className="w-full">{children}</div>
        </section>
      </div>
    </main>
  );
}
