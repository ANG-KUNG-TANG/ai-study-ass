"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  BrainCircuit,
  FileCheck2,
  Layers3,
  MessageCircleQuestion,
  Route,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

interface AboutAppPageProps {
  variant: "student" | "admin";
}

interface FeatureItem {
  title: TranslationKey;
  description: TranslationKey;
  icon: LucideIcon;
}

const FEATURES: FeatureItem[] = [
  {
    title: "about.feature.summaryTitle",
    description: "about.feature.summaryDescription",
    icon: FileCheck2,
  },
  {
    title: "about.feature.quizTitle",
    description: "about.feature.quizDescription",
    icon: BookOpenCheck,
  },
  {
    title: "about.feature.flashcardsTitle",
    description: "about.feature.flashcardsDescription",
    icon: Layers3,
  },
  {
    title: "about.feature.knowledgeTitle",
    description: "about.feature.knowledgeDescription",
    icon: Route,
  },
  {
    title: "about.feature.chatTitle",
    description: "about.feature.chatDescription",
    icon: MessageCircleQuestion,
  },
];

export function AboutAppPage({ variant }: AboutAppPageProps) {
  const { t } = useLanguage();

  return (
    <>
      <Topbar
        eyebrow={t("about.eyebrow")}
        title={t("about.title")}
        actions={(
          <span className="rounded-full border border-line bg-paper-raised px-3 py-1.5 font-mono text-[10px] font-semibold text-ink-soft">
            {t("about.version", { version: "0.1.0" })}
          </span>
        )}
      />

      <p className="-mt-4 max-w-3xl text-[13px] leading-6 text-ink-soft">
        {t("about.description")}
      </p>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-soft" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-paper-raised">
              <Sparkles size={19} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-serif text-[20px] font-semibold text-ink">
              {t("about.purposeTitle")}
            </h2>
            <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">
              {t("about.purposeDescription")}
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <BrainCircuit size={20} strokeWidth={1.7} className="text-ink-soft" />
            <h2 className="font-serif text-[20px] font-semibold text-ink">
              {t("about.workflowTitle")}
            </h2>
          </div>

          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [Upload, "about.workflow.uploadTitle", "about.workflow.uploadDescription"],
              [BrainCircuit, "about.workflow.analyseTitle", "about.workflow.analyseDescription"],
              [BookOpenCheck, "about.workflow.studyTitle", "about.workflow.studyDescription"],
            ].map(([Icon, title, description], index) => {
              const StepIcon = Icon as LucideIcon;
              return (
                <li key={title as string} className="rounded-xl border border-line bg-paper px-3.5 py-4">
                  <div className="flex items-center justify-between">
                    <StepIcon size={17} strokeWidth={1.7} className="text-ink-soft" />
                    <span className="font-mono text-[10px] text-ink-faint">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[12.5px] font-semibold text-ink">
                    {t(title as TranslationKey)}
                  </h3>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-ink-soft">
                    {t(description as TranslationKey)}
                  </p>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <section className="mt-7">
        <h2 className="font-serif text-[20px] font-semibold text-ink">
          {t("about.featuresTitle")}
        </h2>
        <p className="mt-1 text-[12.5px] text-ink-soft">
          {t("about.featuresDescription")}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="h-full">
              <feature.icon size={19} strokeWidth={1.7} className="text-ink-soft" />
              <h3 className="mt-4 text-[13px] font-semibold text-ink">
                {t(feature.title)}
              </h3>
              <p className="mt-1.5 text-[11.5px] leading-5 text-ink-soft">
                {t(feature.description)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-7 border-sage/25 bg-sage-soft/40">
        <div className="flex gap-3">
          <ShieldCheck size={20} strokeWidth={1.7} className="mt-0.5 shrink-0 text-sage" />
          <div>
            <h2 className="font-serif text-[18px] font-semibold text-ink">
              {t("about.reliabilityTitle")}
            </h2>
            <p className="mt-1.5 max-w-4xl text-[12px] leading-6 text-ink-soft">
              {t("about.reliabilityDescription")}
            </p>
            {variant === "admin" && (
              <p className="mt-2 max-w-4xl text-[12px] leading-6 text-ink-soft">
                {t("about.adminDescription")}
              </p>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
