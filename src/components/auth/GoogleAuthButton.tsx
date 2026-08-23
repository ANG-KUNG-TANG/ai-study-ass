"use client";

import { useLanguage } from "@/context/LanguageContext";

interface GoogleAuthButtonProps {
  label?: string;
}

export function GoogleAuthButton({
  label,
}: GoogleAuthButtonProps) {
  const { t } = useLanguage();

  return (
    <a
      href="/api/auth/google/start"
      className="flex h-[46px] w-full items-center justify-center gap-3 rounded-[13px] border border-line bg-paper-raised/55 px-4 text-[13px] font-medium text-ink transition-colors hover:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.52c-.9.6-2.05.96-3.4.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.6A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.4 13.88A6 6 0 0 1 6.08 12c0-.65.11-1.28.32-1.88v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.48l3.35-2.6Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.99c1.47 0 2.79.5 3.82 1.5l2.88-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.35 2.6C7.19 7.75 9.4 5.99 12 5.99Z"
        />
      </svg>
      {label ?? t("auth.google.continue")}
    </a>
  );
}
