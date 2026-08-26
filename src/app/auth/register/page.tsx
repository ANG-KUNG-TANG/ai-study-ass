"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AuthPageMark } from "@/components/auth/AuthPageMark";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/context/LanguageContext";
import { register } from "@/services/auth.service";

export default function RegisterPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      setSuccess(result.message);
    } catch (unknownError: unknown) {
      setError(
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : t("register.failed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
        <h1 className="mb-2 text-[34px] font-bold tracking-[-0.045em]">
          {t("register.checkEmail")}
        </h1>
        <p className="mx-auto mb-5 max-w-[330px] text-[13px] leading-5 text-ink-soft">
          {success}
        </p>
        <p className="mx-auto mb-5 max-w-[330px] text-[12px] leading-5 text-ink-faint">
          {t("register.verificationSent", { email: form.email })}
        </p>
        <Link
          href={`/auth/verify-email?email=${encodeURIComponent(form.email)}`}
          className="mb-4 inline-flex h-11 items-center justify-center rounded-full bg-yellow px-5 text-[12.5px] font-semibold text-ink hover:brightness-95"
        >
          {t("register.verificationHelp")}
        </Link>
        <br />
        <Link
          href="/auth/login"
          className="text-[12.5px] font-medium text-ink hover:underline"
        >
          {t("register.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-left">
        <AuthPageMark />
        <h1 className="text-[36px] font-bold leading-[0.98] tracking-[-0.055em] text-ink sm:text-[42px]">
          {t("register.title")}
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-ink-soft">
          {t("register.subtitle")}
        </p>
      </div>

      <GoogleAuthButton label={t("auth.google.signup")} />

      <div className="my-4 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-medium text-ink-soft">
          {t("common.or")}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label={t("common.name")}
          placeholder={t("register.namePlaceholder")}
          autoComplete="name"
          className="h-[48px] rounded-[10px] bg-paper-raised px-4 text-[13px] focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <Input
          label={t("common.email")}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          className="h-[48px] rounded-[10px] bg-paper-raised px-4 text-[13px] focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <Input
          label={t("common.password")}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          className="h-[48px] rounded-[10px] bg-paper-raised px-4 text-[13px] focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        <p className="-mt-1 text-[10.5px] leading-4 text-ink-faint">
          {t("register.passwordHelp")}
        </p>
        <Input
          label={t("register.confirmPassword")}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          className="h-[48px] rounded-[10px] bg-paper-raised px-4 text-[13px] focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
          value={form.confirmPassword}
          onChange={(event) =>
            setForm({ ...form, confirmPassword: event.target.value })
          }
          required
        />

        {error && <p className="text-[12.5px] text-coral">{error}</p>}

        <Button
          type="submit"
          variant="yellow"
          disabled={isSubmitting}
          className="mt-1 h-[50px] w-full rounded-full text-[13px] font-bold"
        >
          {isSubmitting ? t("register.submitting") : t("register.submit")}
          {!isSubmitting && <ArrowRight size={18} strokeWidth={1.8} />}
        </Button>
      </form>

      <p className="mt-4 text-center text-[12.5px] text-ink-soft">
        {t("register.hasAccount")} {" "}
        <Link href="/auth/login" className="font-medium text-ink hover:underline">
          {t("register.login")}
        </Link>
      </p>
    </div>
  );
}
