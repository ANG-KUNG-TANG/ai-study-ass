"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { noteTabItems } from "./note-tabs-config";

export function NoteTabs({ noteId }: { noteId: string }) {
  const pathname = usePathname();
  const tabs = noteTabItems(noteId);

  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              isActive ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <tab.icon size={15} strokeWidth={1.6} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}