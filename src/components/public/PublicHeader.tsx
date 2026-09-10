"use client";

import Link from "next/link";
import Image from "next/image";

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
          <Image
            src="/studymind-icon.svg"
            alt="AI Study Assistant"
            width={40}
            height={40}
            unoptimized
            className="shrink-0 rounded-[9px] transition-transform group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
          <span className="text-[17px] font-bold tracking-[-0.035em] sm:text-[19px]">
            {t("common.brand")}
          </span>
        </Link>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
