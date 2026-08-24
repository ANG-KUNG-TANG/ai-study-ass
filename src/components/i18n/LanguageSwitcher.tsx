"use client";

import { Languages } from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  compact = false,
  className = "",
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLanguage();
  const nextLocale = locale === "en" ? "my" : "en";
  const nextLanguage =
    nextLocale === "en" ? t("common.english") : t("common.myanmar");

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setLocale(nextLocale)}
        title={nextLanguage}
        aria-label={nextLanguage}
        className={`flex h-9 w-9 items-center justify-center rounded-[9px] text-ink-soft transition-colors hover:bg-line-soft hover:text-ink ${className}`}
      >
        <Languages size={17} strokeWidth={1.7} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-[10px] border border-line bg-paper-raised/80 p-1 shadow-[0_3px_12px_rgba(34,31,26,0.04)] ${className}`}
      role="group"
      aria-label={t("common.language")}
    >
      <Languages
        size={15}
        strokeWidth={1.7}
        className="ml-1.5 text-ink-soft"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-[7px] px-2 py-1 text-[11px] font-semibold transition-colors ${
          locale === "en"
            ? "bg-ink text-paper-raised"
            : "text-ink-soft hover:text-ink"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("my")}
        aria-pressed={locale === "my"}
        className={`rounded-[7px] px-2 py-1 text-[11px] font-semibold transition-colors ${
          locale === "my"
            ? "bg-ink text-paper-raised"
            : "text-ink-soft hover:text-ink"
        }`}
      >
        မြန်မာ
      </button>
    </div>
  );
}
