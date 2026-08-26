"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PublicHeader } from "@/components/public/PublicHeader";
import { StudyArtwork } from "@/components/public/StudyArtwork";
import { useLanguage } from "@/context/LanguageContext";

export default function RootPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <PublicHeader />

      <div className="mx-auto grid min-h-[calc(100dvh-72px)] w-full max-w-[1440px] border-x border-line lg:grid-cols-[minmax(480px,0.82fr)_minmax(0,1.18fr)]">
        <section className="flex items-center px-5 py-12 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-[540px]">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-coral">
              <span className="h-2 w-2 rounded-full bg-coral" />
              {t("home.kicker")}
            </span>

            <h1 className="mt-6 text-[clamp(3.35rem,6vw,6rem)] font-bold leading-[0.9] tracking-[-0.075em] text-ink">
              {t("auth.hero.title")}
            </h1>
            <p className="mt-7 max-w-[490px] text-[15px] leading-7 text-ink-soft sm:text-[16px]">
              {t("auth.hero.description")}
            </p>

            <div className="mt-8 max-w-[440px] space-y-3">
              <Link
                href="/auth/register"
                className="group flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-yellow px-6 text-[14px] font-bold text-ink transition-transform hover:-translate-y-0.5 hover:brightness-95"
              >
                {t("about.startStudying")}
                <ArrowRight
                  size={17}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              <GoogleAuthButton />

              <div className="flex items-center gap-3 py-1" aria-hidden="true">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  {t("common.or")}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <Link
                href="/auth/login"
                className="flex h-[50px] w-full items-center justify-center rounded-full border border-line bg-paper-raised px-6 text-[14px] font-semibold text-ink transition-colors hover:border-ink/40 hover:bg-line-soft"
              >
                {t("login.submit")}
              </Link>
            </div>

            <p className="mt-6 flex items-center gap-2 text-[11.5px] leading-5 text-ink-soft">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
                <Check size={12} strokeWidth={2.5} />
              </span>
              {t("auth.editorial.sourceDescription")}
            </p>
          </div>
        </section>

        <StudyArtwork />
      </div>
    </main>
  );
}
