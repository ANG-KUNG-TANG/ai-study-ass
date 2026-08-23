import {
  CircleHelp,
  FileText,
  Layers,
  Lightbulb,
  MessageCircle,
} from "lucide-react";
import type { ReactNode } from "react";

const primaryFeatures = [
  {
    label: "Smart summaries",
    icon: FileText,
    iconStyle: "bg-coral-soft text-coral",
  },
  {
    label: "Instant flashcards",
    icon: Layers,
    iconStyle: "bg-sage-soft text-sage",
  },
  {
    label: "Practice quizzes",
    icon: CircleHelp,
    iconStyle: "bg-violet-soft text-violet",
  },
] as const;

const secondaryFeatures = [
  {
    label: "Clear explanations",
    icon: Lightbulb,
    iconStyle: "bg-yellow-soft text-yellow",
  },
  {
    label: "AI chat",
    icon: MessageCircle,
    iconStyle: "bg-coral-soft text-coral",
  },
] as const;

function BrandMark() {
  return (
    <div className="flex items-center gap-3.5">
      <div className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-ink shadow-[0_6px_16px_rgba(34,31,26,0.12)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 text-paper"
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
        <span className="absolute bottom-[6px] left-[12px] h-[2px] w-[18px] rounded-full bg-yellow" />
      </div>

      <span className="font-serif text-[24px] font-semibold tracking-[-0.02em] text-ink">
        AI Study Assistant
      </span>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="min-h-screen px-5 py-6 sm:px-8 lg:px-10 lg:py-8 xl:px-14"
      style={{
        backgroundImage:
          "radial-gradient(circle, #EFE8D6 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        backgroundColor: "#FAF6EC",
      }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1260px] lg:grid-cols-[minmax(0,1.05fr)_1px_minmax(380px,0.78fr)] lg:gap-10 xl:gap-14">
        <section className="hidden min-w-0 flex-col justify-center lg:flex">
          <BrandMark />

          <div className="mt-12 max-w-[580px] xl:mt-14">
            <h1 className="font-serif text-[clamp(2.75rem,3.5vw,3.75rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-ink">
              Turn confusion into clarity—in one click.
            </h1>
            <p className="mt-5 max-w-[540px] text-[16px] leading-7 text-ink-soft">
              Upload your notes and let AI create summaries, flashcards,
              quizzes, and clear explanations in seconds.
            </p>
          </div>

          <div className="mt-8 max-w-[580px]">
            <div className="grid grid-cols-3 gap-3">
              {primaryFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="flex min-h-[140px] flex-col items-center justify-center rounded-[16px] border border-line bg-paper-raised/90 px-3 text-center shadow-[0_7px_20px_rgba(34,31,26,0.04)]"
                  >
                    <span
                      className={`mb-4 flex h-[58px] w-[58px] items-center justify-center rounded-full ${feature.iconStyle}`}
                    >
                      <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-semibold text-ink">
                      {feature.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid max-w-[500px] grid-cols-2 gap-3 pl-7">
              {secondaryFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="flex min-h-[66px] items-center gap-3 rounded-[14px] border border-line bg-paper-raised/90 px-4 shadow-[0_7px_20px_rgba(34,31,26,0.035)]"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${feature.iconStyle}`}
                    >
                      <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-semibold text-ink">
                      {feature.label}
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

        <section className="flex min-w-0 items-center justify-center py-4 lg:py-6">
          <div className="w-full max-w-[420px]">
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
