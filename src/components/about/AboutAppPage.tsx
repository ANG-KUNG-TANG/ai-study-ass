"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  BrainCircuit,
  FileCheck2,
  GitBranch,
  Layers3,
  MessageCircleQuestion,
  Route,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

interface AboutAppPageProps {
  variant: "student" | "admin";
}

const WORKFLOW = [
  ["about.workflow.uploadTitle", "about.workflow.uploadDescription", Upload],
  ["about.workflow.analyseTitle", "about.workflow.analyseDescription", BrainCircuit],
  ["about.workflow.studyTitle", "about.workflow.studyDescription", BookOpenCheck],
] as const;

const FEATURES = [
  ["about.feature.summaryTitle", "about.feature.summaryDescription", FileCheck2],
  ["about.feature.quizTitle", "about.feature.quizDescription", BookOpenCheck],
  ["about.feature.flashcardsTitle", "about.feature.flashcardsDescription", Layers3],
  ["about.feature.knowledgeTitle", "about.feature.knowledgeDescription", Route],
  ["about.feature.chatTitle", "about.feature.chatDescription", MessageCircleQuestion],
] as const;

const TECH_STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind CSS 4",
  "MongoDB + Mongoose",
  "Redis + BullMQ",
  "OpenAI + Gemini",
  "Docker",
];

export function AboutAppPage({ variant }: AboutAppPageProps) {
  const { t } = useLanguage();
  const workspaceHref = variant === "admin" ? "/admin/overview" : "/student/notes";
  const workspaceLabel = variant === "admin" ? t("about.openAdmin") : t("about.startStudying");

  return (
    <>
      <Topbar
        eyebrow={t("about.eyebrow")}
        title={t("about.title")}
        description={t("about.description")}
        actions={(
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sage-soft px-3 py-1.5 text-[10px] font-semibold text-sage">
              {t("about.statusBadge")}
            </span>
            <span className="rounded-full border border-line px-3 py-1.5 font-mono text-[10px] font-semibold text-ink-soft">
              {t("about.version", { version: "0.1.0" })}
            </span>
          </div>
        )}
      />

      <section className="grid gap-8 border-b border-line pb-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)] lg:items-end">
        <div>
          <span className="editorial-kicker">{t("about.whatTitle")}</span>
          <h2 className="mt-3 max-w-4xl font-serif text-[clamp(2rem,4vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">
            {t("about.whatTitle")}
          </h2>
          <p className="mt-4 max-w-3xl text-[14px] leading-7 text-ink-soft">
            {t("about.description")}
          </p>
        </div>

        <nav className="border-l-2 border-coral pl-4 text-[12px] leading-7 text-ink-soft" aria-label="About page sections">
          <strong className="block text-[12.5px] font-semibold text-ink">{t("about.title")}</strong>
          <a className="block hover:text-ink" href="#purpose">{t("about.problemTitle")}</a>
          <a className="block hover:text-ink" href="#features">{t("about.featuresTitle")}</a>
          <a className="block hover:text-ink" href="#workflow">{t("about.workflowTitle")}</a>
          <a className="block hover:text-ink" href="#technology">{t("about.techTitle")}</a>
          <a className="block hover:text-ink" href="#direction">{t("about.roadmapTitle")}</a>
        </nav>
      </section>

      <section id="purpose" className="grid border-b border-line lg:grid-cols-3">
        {[
          ["about.problemTitle", "about.problemDescription"],
          ["about.audienceTitle", "about.audienceDescription"],
          ["about.statusTitle", "about.statusDescription"],
        ].map(([title, description], index) => (
          <article key={title} className="border-b border-line px-0 py-6 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
            <span className="font-mono text-[10px] text-ink-faint">0{index + 1}</span>
            <h2 className="mt-3 font-serif text-[19px] font-semibold text-ink">{t(title as TranslationKey)}</h2>
            <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">{t(description as TranslationKey)}</p>
          </article>
        ))}
      </section>

      <section id="features" className="editorial-section py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="editorial-kicker">{t("about.capabilitiesKicker")}</span>
            <h2 className="mt-1 font-serif text-[23px] font-semibold text-ink">{t("about.featuresTitle")}</h2>
          </div>
          <p className="max-w-xl text-[12.5px] leading-5 text-ink-soft">{t("about.featuresDescription")}</p>
        </div>

        <div className="mt-5 grid border-y border-line sm:grid-cols-2 xl:grid-cols-5">
          {FEATURES.map(([title, description, Icon], index) => (
            <article key={title} className="border-b border-line p-4 sm:border-r xl:border-b-0 xl:last:border-r-0">
              <div className="flex items-center justify-between">
                <Icon size={18} strokeWidth={1.7} className="text-coral" aria-hidden="true" />
                <span className="font-mono text-[9.5px] text-ink-faint">0{index + 1}</span>
              </div>
              <h3 className="mt-4 text-[13px] font-semibold text-ink">{t(title)}</h3>
              <p className="mt-1.5 text-[11.5px] leading-5 text-ink-soft">{t(description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="grid gap-8 border-y border-line py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <span className="editorial-kicker">{t("about.processKicker")}</span>
          <h2 className="mt-1 font-serif text-[23px] font-semibold text-ink">{t("about.workflowTitle")}</h2>
          <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">{t("about.workflowDescription")}</p>
        </div>
        <ol className="border-y border-line">
          {WORKFLOW.map(([title, description, Icon], index) => (
            <li key={title} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-b border-line-soft py-4 last:border-b-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-mono text-[10px] text-paper-raised">0{index + 1}</span>
              <div>
                <div className="flex items-center gap-2"><Icon size={16} strokeWidth={1.7} className="text-coral" /><h3 className="text-[13px] font-semibold text-ink">{t(title)}</h3></div>
                <p className="mt-1 text-[12px] leading-5 text-ink-soft">{t(description)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="technology" className="grid gap-8 border-b border-line py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div>
          <span className="editorial-kicker">{t("about.implementationKicker")}</span>
          <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">{t("about.techTitle")}</h2>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-ink-soft">{t("about.techDescription")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TECH_STACK.map((technology) => (
              <span key={technology} className="rounded-full border border-line bg-paper-raised px-2.5 py-1.5 font-mono text-[10px] text-ink-soft">{technology}</span>
            ))}
          </div>
        </div>
        <aside className="border-l-[3px] border-sage bg-sage-soft/45 px-4 py-4">
          <ShieldCheck size={19} strokeWidth={1.7} className="text-sage" />
          <h3 className="mt-3 font-serif text-[18px] font-semibold text-ink">{t("about.reliabilityTitle")}</h3>
          <p className="mt-2 text-[12px] leading-6 text-ink-soft">{t("about.reliabilityDescription")}</p>
          {variant === "admin" ? <p className="mt-2 text-[12px] leading-6 text-ink-soft">{t("about.adminDescription")}</p> : null}
        </aside>
      </section>

      <section id="direction" className="grid border-b border-line lg:grid-cols-2">
        <article className="border-b border-line py-7 lg:border-b-0 lg:border-r lg:pr-8">
          <span className="editorial-kicker">{t("about.originTitle")}</span>
          <h2 className="mt-2 font-serif text-[21px] font-semibold text-ink">{t("about.originTitle")}</h2>
          <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">{t("about.originDescription")}</p>
        </article>
        <article className="py-7 lg:pl-8">
          <span className="editorial-kicker">{t("about.roadmapTitle")}</span>
          <h2 className="mt-2 font-serif text-[21px] font-semibold text-ink">{t("about.roadmapTitle")}</h2>
          <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">{t("about.roadmapDescription")}</p>
        </article>
      </section>

      <section className="mt-8 border-l-[3px] border-yellow bg-ink px-5 py-6 text-paper-raised sm:px-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="font-serif text-[21px] font-semibold">{t("about.getStartedTitle")}</h2>
            <p className="mt-2 text-[12px] leading-6 text-paper-raised/65">{t("about.getStartedDescription")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={workspaceHref} className="inline-flex items-center gap-2 rounded-[8px] bg-yellow px-4 py-2.5 text-[12px] font-semibold text-ink">
              {workspaceLabel}<ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
            </Link>
            <a href="https://github.com/ANG-KUNG-TANG/ai-study-ass" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-[8px] border border-paper-raised/20 px-4 py-2.5 text-[12px] font-semibold hover:bg-paper-raised/10">
              <GitBranch size={15} strokeWidth={1.8} aria-hidden="true" />{t("about.github")}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
