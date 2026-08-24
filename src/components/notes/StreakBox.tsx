"use client";

import { useLanguage } from "@/context/LanguageContext";

interface StreakBoxProps {
  days: number;
  message: string;
}

export function StreakBox({ days, message }: StreakBoxProps) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-yellow-line bg-yellow-soft px-3.5 py-3.5">
      <div className="mb-1 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path
            d="M12 2c1 4-4 5-4 9a4 4 0 0 0 8 0c0-1.5-1-2-1-3.5 2 1 3 3.5 3 5.5a6 6 0 0 1-12 0C6 8 9 6 12 2z"
            fill="#E85D46"
          />
        </svg>
        <strong className="text-[13px]">
          {t("sidebar.streakTitle", { days })}
        </strong>
      </div>
      <p className="text-[11.5px] leading-snug text-ink-soft">{message}</p>
    </div>
  );
}
