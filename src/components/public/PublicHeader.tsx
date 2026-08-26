"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

export function PublicHeader() {
  const { t } = useLanguage();

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="group flex items-center gap-3 text-ink"
          aria-label={t("common.brand")}
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-ink text-paper-raised transition-transform group-hover:-translate-y-0.5">
            <BookOpen size={19} strokeWidth={1.8} aria-hidden="true" />
            <span className="absolute bottom-1.5 h-0.5 w-4 bg-yellow" />
          </span>
          <span className="text-[17px] font-bold tracking-[-0.035em] sm:text-[19px]">
            {t("common.brand")}
          </span>
        </Link>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
