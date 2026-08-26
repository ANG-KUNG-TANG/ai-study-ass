export function StudyArtwork() {
  return (
    <section
      className="relative hidden min-h-full overflow-hidden border-l border-line bg-yellow-soft/35 lg:flex lg:items-center lg:justify-center"
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,#E6DDC8_1px,transparent_1px),linear-gradient(to_bottom,#E6DDC8_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]" />

      <svg
        viewBox="0 0 720 720"
        className="relative z-10 w-[min(86%,720px)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M92 177C186 143 274 158 360 226V570C281 505 187 481 92 516V177Z"
          className="fill-paper/70 stroke-ink/25"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M628 177C534 143 446 158 360 226V570C439 505 533 481 628 516V177Z"
          className="fill-paper/70 stroke-ink/25"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M360 226V570"
          className="stroke-yellow"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M137 232C202 216 256 228 310 265"
          className="stroke-coral"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M137 284C202 268 256 280 310 317"
          className="stroke-sage"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M137 336C202 320 256 332 310 369"
          className="stroke-violet"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M410 273C462 238 514 226 582 238"
          className="stroke-ink/20"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M410 327C462 292 514 280 582 292"
          className="stroke-ink/20"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M410 381C462 346 514 334 582 346"
          className="stroke-ink/20"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="360" cy="118" r="35" className="fill-yellow" />
        <path
          d="M344 118L355 129L377 106"
          className="stroke-ink"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between border-t border-line pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
        <span>Read</span>
        <span className="h-1.5 w-1.5 rounded-full bg-coral" />
        <span>Understand</span>
        <span className="h-1.5 w-1.5 rounded-full bg-sage" />
        <span>Remember</span>
      </div>
    </section>
  );
}
