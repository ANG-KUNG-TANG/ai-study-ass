import { ReactNode } from "react";

type ChipTone = "yellow" | "coral" | "sage" | "violet" | "neutral";

interface ChipProps {
    tone?: ChipTone;
    children: ReactNode;
    className: string
}

const toneStyles: Record<ChipTone, string> = {
    yellow : "bg-yellow-soft text-ink",
    coral: "bg-coral-soft text-coral",
    sage: "bg-sage-soft text-sage",
    violet: "bg-violet-soft text-violet",
    neutral: "bg-violet-soft text-violet",
}

export function Chip({tone = "neutral", children, className=""}: ChipProps) {
    return (
        <span 
            className={`inline-flex items-center gap-1 roundef-full px-2.5 py-1 text-[11px] ${className}`}
        >
            {children}
        </span>
    )
}