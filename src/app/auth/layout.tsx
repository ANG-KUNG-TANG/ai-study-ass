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

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-[13px] bg-ink shadow-[0_7px_18px_rgba(34,31,26,0.14)] ${
          compact ? "h-12 w-12" : "h-[50px] w-[50px]"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-6 w-6 text-paper"
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
        <span className="absolute bottom-[7px] left-[14px] h-[3px] w-5 rounded-full bg-yellow" />
      </div>

      {!compact && (
        <span className="font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          AI Study Assistant
        </span>
      )}
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="min-h-screen px-5 py-8 sm:px-8 lg:px-12 lg:py-10 xl:px-20"
      style={{
        backgroundImage:
          "radial-gradient(circle, #EFE8D6 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        backgroundColor: "#FAF6EC",
      }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1440px] lg:grid-cols-[minmax(0,1.15fr)_1px_minmax(420px,0.85fr)] lg:gap-14 xl:gap-20">
        <section className="hidden min-w-0 flex-col justify-center lg:flex">
          <BrandMark />

          <div className="mt-16 max-w-[650px] xl:mt-20">
            <h1 className="font-serif text-[clamp(3.25rem,4.5vw,5rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-ink">
              Turn confusion into clarity—in one click.
            </h1>
            <p className="mt-8 max-w-[600px] text-[18px] leading-8 text-ink-soft">
              Upload your notes and let AI create summaries, flashcards,
              quizzes, and clear explanations in seconds.
            </p>
          </div>

          <div className="mt-12 max-w-[650px]">
            <div className="grid grid-cols-3 gap-3">
              {primaryFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="flex min-h-[178px] flex-col items-center justify-center rounded-[18px] border border-line bg-paper-raised/90 px-4 text-center shadow-[0_8px_24px_rgba(34,31,26,0.045)]"
                  >
                    <span
                      className={`mb-5 flex h-[74px] w-[74px] items-center justify-center rounded-full ${feature.iconStyle}`}
                    >
                      <Icon size={34} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-[15px] font-semibold text-ink">
                      {feature.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid max-w-[540px] grid-cols-2 gap-4 pl-10">
              {secondaryFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="flex min-h-[80px] items-center gap-4 rounded-[16px] border border-line bg-paper-raised/90 px-5 shadow-[0_8px_24px_rgba(34,31,26,0.04)]"
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${feature.iconStyle}`}
                    >
                      <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-[14px] font-semibold text-ink">
                      {feature.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div
          className="my-8 hidden w-px bg-line lg:block"
          aria-hidden="true"
        />

        <section className="flex min-w-0 items-center justify-center py-6 lg:py-10">
          <div className="w-full max-w-[500px]">
            <div className="mb-10 flex justify-center lg:hidden">
              <BrandMark />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
