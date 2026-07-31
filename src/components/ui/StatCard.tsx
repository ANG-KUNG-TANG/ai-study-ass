import { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

type StatTone = "violet" | "coral" | "sage" | "slate";

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  tone?: StatTone;
  delta?: string; // e.g., "+12%"
  deltaType?: "up" | "down";
}

const TONE_CLASSES: Record<StatTone, string> = {
  violet: "bg-violet-soft text-violet",
  coral: "bg-coral-soft text-coral",
  sage: "bg-sage-soft text-sage",
  slate: "bg-slate-soft text-slate",
};

export function StatCard({ value, label, icon, tone = "violet", delta, deltaType = "up" }: StatCardProps) {
  const deltaClasses = deltaType === "up" ? "bg-sage-soft text-sage" : "bg-coral-soft text-coral";

  return (
    <div className="rounded-card border border-line bg-paper-raised p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        {icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}>
            <Icon icon={icon} size={16} />
          </div>
        )}
        {delta && (
          <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${deltaClasses}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="mt-3 font-serif text-[26px] font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-[12px] text-ink-soft">{label}</div>
    </div>
  );
}