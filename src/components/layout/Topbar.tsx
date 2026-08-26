import { ReactNode } from "react";

interface TopbarProps {
  eyebrow?: string;
  title: string;
  description?: string;
  search?: {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  actions?: ReactNode;
}

export function Topbar({ eyebrow, title, description, search, actions }: TopbarProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-coral">{eyebrow}</div>
        )}
        <h1 className="font-serif text-[27px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-5 text-ink-soft">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {search && (
          <div className="flex w-full max-w-[260px] items-center gap-2 border-b border-line bg-transparent px-1 py-2 sm:w-[260px]">
            <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px] flex-shrink-0 text-ink-faint">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? "Search…"}
              className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint outline-none"
            />
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}
