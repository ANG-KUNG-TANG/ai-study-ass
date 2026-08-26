"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Layers3,
  MessageSquareText,
  Route,
} from "lucide-react";

import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

const capabilities = [
  [FileText, "about.feature.summaryTitle", "about.feature.summaryDescription"],
  [Route, "about.feature.knowledgeTitle", "about.feature.knowledgeDescription"],
  [Layers3, "about.feature.flashcardsTitle", "about.feature.flashcardsDescription"],
  [MessageSquareText, "about.feature.chatTitle", "about.feature.chatDescription"],
] as const;

export default function RootPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between border-b border-line px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-md bg-ink text-paper-raised">
            <BookOpen size={18} strokeWidth={1.7} aria-hidden="true" />
            <span className="absolute bottom-1.5 left-2.5 h-0.5 w-4 bg-yellow" />
          </span>
          <span className="font-serif text-[19px] font-semibold">{t("common.brand")}</span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/auth/login" className="hidden rounded-[8px] px-3 py-2 text-[12.5px] font-medium text-ink-soft hover:bg-line-soft hover:text-ink sm:inline-flex">
            {t("login.submit")}
          </Link>
          <Link href="/auth/register" className="inline-flex min-h-10 items-center rounded-[8px] bg-ink px-4 text-[12.5px] font-semibold text-paper-raised">
            {t("register.submit")}
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1240px] gap-10 border-b border-line px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-end lg:py-20">
        <div>
          <span className="editorial-kicker">{t("home.kicker")}</span>
          <h1 className="mt-4 max-w-[820px] font-serif text-[clamp(2.7rem,6vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
            {t("auth.hero.title")}
          </h1>
          <p className="mt-6 max-w-[680px] text-[15px] leading-7 text-ink-soft">
            {t("about.description")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/auth/register" className="group inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-yellow px-5 text-[13px] font-semibold text-ink">
              {t("about.startStudying")}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/auth/login" className="inline-flex min-h-11 items-center rounded-[8px] border border-line bg-paper-raised px-5 text-[13px] font-medium text-ink">
              {t("login.submit")}
            </Link>
          </div>
        </div>

        <aside className="border-l-2 border-coral pl-5">
          <strong className="text-[13px] font-semibold">{t("about.workflowTitle")}</strong>
          <ol className="mt-3 space-y-3 text-[12.5px] text-ink-soft">
            <li><span className="mr-2 font-mono text-coral">01</span>{t("about.workflow.uploadTitle")}</li>
            <li><span className="mr-2 font-mono text-coral">02</span>{t("about.workflow.analyseTitle")}</li>
            <li><span className="mr-2 font-mono text-coral">03</span>{t("about.workflow.studyTitle")}</li>
          </ol>
        </aside>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-5 py-12 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="editorial-kicker">{t("home.learningLoop")}</span>
            <h2 className="mt-1 font-serif text-[25px] font-semibold">{t("about.featuresTitle")}</h2>
          </div>
          <p className="max-w-xl text-[12.5px] leading-5 text-ink-soft">{t("about.featuresDescription")}</p>
        </div>

        <div className="mt-6 grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(([Icon, title, description], index) => (
            <article key={title} className="border-b border-line p-5 sm:border-r lg:border-b-0 lg:last:border-r-0">
              <div className="flex items-center justify-between">
                <Icon size={18} strokeWidth={1.7} className="text-coral" />
                <span className="font-mono text-[9.5px] text-ink-faint">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-[13px] font-semibold">{t(title)}</h3>
              <p className="mt-2 text-[11.5px] leading-5 text-ink-soft">{t(description)}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-6 text-[11.5px] text-ink-faint sm:px-8">
        <span>{t("common.brand")}</span>
        <Link href="/auth/login" className="text-ink-soft hover:text-ink">{t("about.getStartedTitle")}</Link>
      </footer>
    </main>
  );
}
