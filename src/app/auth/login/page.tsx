"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

import { AuthPageMark } from "@/components/auth/AuthPageMark";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { ApiClientError } from "@/lib/api";

const OAUTH_ERROR_KEYS: Record<string, TranslationKey> = {
  access_denied: "login.oauth.accessDenied",
  account_link_required: "login.oauth.accountLinkRequired",
  invalid_state: "login.oauth.invalidState",
  not_configured: "login.oauth.notConfigured",
  rate_limited: "login.oauth.rateLimited",
  failed: "login.oauth.failed",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [oauthErrorDismissed, setOauthErrorDismissed] = useState(false);
  const oauthErrorCode = searchParams.get("oauth_error");
  const oauthError =
    !oauthErrorDismissed && oauthErrorCode
      ? t(OAUTH_ERROR_KEYS[oauthErrorCode] ?? OAUTH_ERROR_KEYS.failed)
      : "";
  const displayedError = error || oauthError;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNeedsVerification(false);
    setOauthErrorDismissed(true);
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/student/dashboard");
    } catch (unknownError: unknown) {
      setNeedsVerification(
        unknownError instanceof ApiClientError &&
          unknownError.code === "EMAIL_NOT_VERIFIED",
      );
      setError(
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : t("login.invalidCredentials"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <AuthPageMark />

        <h1 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
          {t("login.title")}
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          {t("login.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-[13px] font-medium text-ink">
            {t("common.email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-[46px] w-full rounded-[8px] border border-line bg-paper-raised px-4 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-[13px] font-medium text-ink">
            {t("common.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-[46px] w-full rounded-[8px] border border-line bg-paper-raised px-4 pr-12 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-3.5 flex items-center text-ink-faint transition-colors hover:text-ink-soft"
              aria-label={
                showPassword
                  ? t("common.hidePassword")
                  : t("common.showPassword")
              }
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {displayedError && (
          <div className="rounded-xl bg-coral-soft px-4 py-3 text-[13px] text-coral">
            <p>{displayedError}</p>
            {needsVerification && (
              <Link
                href={`/auth/verify-email?email=${encodeURIComponent(email)}`}
                className="mt-2 inline-block font-semibold underline underline-offset-2"
              >
                {t("login.resendVerification")}
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 text-[12px]">
          <label className="flex items-center gap-2.5 text-ink-soft">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line accent-yellow"
            />
            {t("login.remember")}
          </label>
          <Link
            href="/auth/forgot-password"
            className="font-medium text-coral hover:underline"
          >
            {t("login.forgot")}
          </Link>
        </div>

        <Button
          type="submit"
          variant="yellow"
          className="h-[46px] w-full rounded-[8px] text-[13px] font-semibold"
          disabled={isLoading}
        >
          {isLoading ? t("login.submitting") : t("login.submit")}
          {!isLoading && <ArrowRight size={18} strokeWidth={1.8} />}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12px] font-medium text-ink-soft">
          {t("common.or")}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleAuthButton />

      <p className="mt-5 text-center text-[13px] text-ink-soft">
        {t("login.noAccount")} {" "}
        <Link
          href="/auth/register"
          className="font-semibold text-ink hover:underline"
        >
          {t("login.signup")}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[460px]" aria-hidden="true" />}>
      <LoginContent />
    </Suspense>
  );
}
