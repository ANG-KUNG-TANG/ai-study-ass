"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { AuthPageMark } from "@/components/auth/AuthPageMark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/context/LanguageContext";
import { forgotPassword } from "@/services/auth.service";

function ForgotPasswordContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (unknownError: unknown) {
      setError(
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : t("forgot.failed"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-sage-soft text-sage">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="font-serif text-[28px] font-semibold tracking-[-0.02em]">
          {t("forgot.checkInbox")}
        </h2>
        <p className="mx-auto mt-2 max-w-[330px] text-[13px] leading-5 text-ink-soft">
          {t("forgot.sent", { email })}
        </p>
        <Link
          href="/auth/login"
          className="mt-5 inline-block text-[12.5px] font-medium text-coral hover:underline"
        >
          ← {t("forgot.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <AuthPageMark />
        <h1 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
          {t("forgot.title")}
        </h1>
        <p className="mx-auto mt-1.5 max-w-[340px] text-[13px] leading-5 text-ink-soft">
          {t("forgot.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t("common.email")}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          className="h-[46px] rounded-[8px] bg-paper-raised px-4 text-[13px]"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {error && (
          <p className="rounded-xl bg-coral-soft px-4 py-3 text-[12px] text-coral">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="yellow"
          className="h-[46px] w-full rounded-[8px] text-[13px] font-semibold"
          disabled={isLoading}
        >
          {isLoading ? t("forgot.submitting") : t("forgot.submit")}
          {!isLoading && <ArrowRight size={16} strokeWidth={1.8} />}
        </Button>
      </form>

      <Link
        href="/auth/login"
        className="mt-5 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={14} />
        {t("forgot.backToLogin")}
      </Link>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[420px]" aria-hidden="true" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
