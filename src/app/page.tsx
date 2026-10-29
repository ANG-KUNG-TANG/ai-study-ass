"use client";

import {
  ArrowDown,
  ArrowRight,
  Check,
  FileText,
  Layers3,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect } from "react";

import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PublicHeader } from "@/components/public/PublicHeader";
import { StudyArtwork } from "@/components/public/StudyArtwork";
import { StudyDemo } from "@/components/public/StudyDemo";
import { useLanguage } from "@/context/LanguageContext";

export default function RootPage() {
  const { t } = useLanguage();

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(
      "[data-scroll-reveal]",
    );

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;

          element.classList.remove("opacity-0", "translate-y-5");
          element.classList.add("opacity-100", "translate-y-0");

          observer.unobserve(element);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    elements.forEach((element) => {
      element.classList.add("opacity-0", "translate-y-5");
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToDemo = useCallback(() => {
    const element = document.getElementById("try-demo");
    if (!element) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    element.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return (
    <main className="min-h-dvh overflow-x-clip bg-paper text-ink">
      <PublicHeader />

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto grid w-full max-w-[1440px] lg:min-h-[min(780px,calc(100dvh-72px))] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="flex items-center px-5 py-12 sm:px-10 sm:py-14 lg:px-12 lg:py-16 xl:px-16">
            <div className="w-full max-w-[500px]">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-coral">
                <span className="h-2 w-2 rounded-full bg-coral" />
                {t("home.kicker")}
              </span>

              <h1 className="mt-5 max-w-[470px] text-[clamp(2rem,3.2vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.04em] text-ink">
                {t("about.getStartedTitle")}
              </h1>

              <p className="mt-5 max-w-[460px] text-[14px] leading-7 text-ink-soft sm:text-[15px]">
                {t("about.getStartedDescription")}
              </p>

              <div className="mt-7 max-w-[420px] space-y-3">
                <Link
                  href="/auth/register"
                  className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-yellow px-6 text-sm font-semibold text-ink shadow-sm transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:brightness-[0.97] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                >
                  {t("about.startStudying")}
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </Link>

                <GoogleAuthButton />

                <div
                  className="flex items-center gap-3 py-1"
                  aria-hidden="true"
                >
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    {t("common.or")}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <Link
                  href="/auth/login"
                  className="flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-paper-raised px-6 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink/30 hover:bg-line-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                >
                  {t("login.submit")}
                </Link>
              </div>

              <p className="mt-5 flex items-center gap-2 text-[11px] leading-5 text-ink-soft">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
                  <Check size={12} strokeWidth={2.5} />
                </span>
                {t("auth.editorial.sourceDescription")}
              </p>

              <button
                type="button"
                onClick={scrollToDemo}
                className="group mt-6 inline-flex items-center gap-2 rounded-full text-sm font-medium text-ink-soft transition-colors duration-200 hover:text-coral focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
              >
                <span>Try the interactive demo</span>
                <ArrowDown
                  size={15}
                  className="transition-transform duration-300 group-hover:translate-y-1"
                />
              </button>
            </div>
          </div>

          <div className="relative min-h-[390px] overflow-hidden bg-yellow-soft/25 sm:min-h-[440px]">
            <StudyArtwork />
          </div>
        </div>
      </section>

      {/* Soft visual transition into the demo */}
      <div
        className="relative h-16 overflow-hidden bg-paper"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-soft/35 via-paper to-paper" />
        <div className="absolute left-1/2 top-0 h-px w-[min(84%,720px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-yellow/70 to-transparent" />
        <div className="absolute left-1/2 top-5 h-8 w-36 -translate-x-1/2 rounded-full bg-yellow/10 blur-2xl" />
      </div>

      {/* Interactive demo */}
      <section id="try-demo" className="scroll-mt-5 bg-paper pb-16 sm:pb-20">
        <div
          data-scroll-reveal
          className="mx-auto max-w-[1120px] px-5 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none sm:px-8 lg:px-10"
        >
          <div className="mx-auto max-w-[620px] text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-coral/15 bg-coral/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-coral">
              <Sparkles size={12} />
              Explore before signing up
            </span>

            <h2 className="mt-4 text-[clamp(1.5rem,2.5vw,2rem)] font-semibold leading-tight tracking-[-0.035em] text-ink">
              See how studying can feel different.
            </h2>

            <p className="mx-auto mt-3 max-w-[540px] text-[13px] leading-6 text-ink-soft sm:text-sm sm:leading-7">
              Explore a sample summary, reveal flashcards, and answer a quick
              quiz. Everything in this demo runs in your browser without an
              account.
            </p>
          </div>

          <div className="relative mx-auto mt-8 max-w-[820px]">
            <div
              className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-yellow-soft/40 blur-xl"
              aria-hidden="true"
            />

            <div className="relative rounded-2xl border border-line bg-paper-raised p-3 shadow-[0_12px_40px_-28px_rgba(60,45,20,0.25)] sm:rounded-3xl sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-line px-1 pb-3 sm:px-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-soft text-ink">
                    <FileText size={16} />
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">
                      Your sample study note
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-faint">
                      Summary · Flashcards · Quiz
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-medium text-sage">
                  Interactive demo
                </span>
              </div>

              <StudyDemo />
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] leading-5 text-ink-faint">
            A small preview of your learning workspace.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-yellow-soft/15">
        <div
          data-scroll-reveal
          className="mx-auto max-w-[1120px] px-5 py-14 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none sm:px-8 sm:py-16 lg:px-10"
        >
          <div className="max-w-[560px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-coral">
              A simpler study workflow
            </span>

            <h2 className="mt-3 text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-tight tracking-[-0.035em]">
              From study material to understanding.
            </h2>

            <p className="mt-3 max-w-[480px] text-sm leading-6 text-ink-soft">
              Turn your notes into useful study tools, then practice at your own
              pace.
            </p>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-line bg-paper-raised p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-yellow hover:shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-soft text-ink">
                <FileText size={19} />
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-coral">
                01 / Add
              </p>
              <h3 className="mt-1.5 text-sm font-semibold">
                Bring your materials
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-ink-soft">
                Keep your notes and study documents together in one place.
              </p>
            </article>

            <article className="rounded-2xl border border-line bg-paper-raised p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-yellow hover:shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral/10 text-coral">
                <Sparkles size={19} />
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-coral">
                02 / Transform
              </p>
              <h3 className="mt-1.5 text-sm font-semibold">
                Make ideas clearer
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-ink-soft">
                Create summaries, explanations, and practice questions.
              </p>
            </article>

            <article className="rounded-2xl border border-line bg-paper-raised p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-yellow hover:shadow-sm">
              <div className="flex h-10 w-full items-center justify-center rounded-xl bg-sage-soft text-sage">
                <Layers3 size={19} />
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.13em] text-coral">
                03 / Practice
              </p>
              <h3 className="mt-1.5 text-sm font-semibold">
                Build lasting knowledge
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-ink-soft">
                Review flashcards and quizzes to check your understanding.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="bg-paper">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-5 px-5 py-12 sm:px-8 sm:py-14 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="max-w-[560px]">
            <h2 className="text-xl font-semibold leading-snug tracking-[-0.03em] sm:text-2xl">
              Ready to make your next study session count?
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Create an account to start organizing your learning.
            </p>
          </div>

          <Link
            href="/auth/register"
            className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-yellow px-5 text-sm font-semibold text-ink transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
          >
            {t("about.startStudying")}
            <ArrowRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </div>
      </section>

      <footer className="bg-paper">
        <div className="mx-auto max-w-[1120px] px-5 py-8 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none sm:px-8 sm:py-10 lg:px-10">
          <span>{t("common.brand")}</span>
          <span>Learn at your own pace.</span>
        </div>
      </footer>
    </main>
  );
}
