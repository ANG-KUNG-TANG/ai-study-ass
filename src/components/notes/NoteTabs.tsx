"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { noteTabItems } from "./note-tabs-config";
import { useLanguage } from "@/context/LanguageContext";

export function NoteTabs({ noteId }: { noteId: string }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const tabs = noteTabItems(noteId);

  return (
    <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line px-1" aria-label="Document study tools">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              isActive ? "border-coral text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <tab.icon size={15} strokeWidth={1.6} />
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
