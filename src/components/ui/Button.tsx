import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "dark" | "yellow" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  dark: "bg-ink text-paper hover:opacity-90",
  yellow: "bg-yellow text-ink hover:brightness-95",
  outline: "bg-transparent text-ink border border-line hover:bg-line-soft",
  ghost: "bg-transparent text-ink-soft hover:bg-line-soft",
};

export function Button({ variant = "dark", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-card px-4 py-2.5 text-[13px] font-medium font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}