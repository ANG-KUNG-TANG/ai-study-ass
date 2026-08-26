"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, MailCheck, XCircle } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/context/LanguageContext";
import { resendVerification, verifyEmail } from "@/services/auth.service";

type VerificationState = "waiting" | "verifying" | "verified" | "error";

function VerifyEmailContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailFromRegistration = searchParams.get("email") ?? "";
  const [state, setState] = useState<VerificationState>(
    token ? "verifying" : "waiting",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState(emailFromRegistration);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!token) return;

    let active = true;

    void verifyEmail(token)
      .then((result) => {
        if (!active) return;
        setState("verified");
        setMessage(result.message || null);
      })
      .catch(() => {
        if (!active) return;
        setState("error");
        setMessage(null);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resending || cooldown > 0) return;

    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      await resendVerification(email);
      setResendSuccess(true);
      setCooldown(30);
    } catch (unknownError: unknown) {
      setResendError(
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : t("verify.resendFailed"),
      );
    } finally {
      setResending(false);
    }
  }

  const title =
    state === "verifying"
      ? t("verify.title.verifying")
      : state === "verified"
        ? t("verify.title.verified")
        : state === "error"
          ? t("verify.title.failed")
          : t("verify.title.waiting");

  const description =
    message ??
    (state === "verifying"
      ? t("verify.confirming")
      : state === "verified"
        ? t("verify.success")
        : state === "error"
          ? t("verify.invalid")
          : emailFromRegistration
            ? t("verify.waiting", { email: emailFromRegistration })
            : t("verify.enterEmail"));

  return (
    <Card className="w-full max-w-[420px] rounded-none border-0 bg-transparent p-0 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-line-soft">
        {state === "verifying" && (
          <LoaderCircle className="animate-spin text-ink-soft" size={24} />
        )}
        {state === "verified" && <CheckCircle2 className="text-green-700" size={24} />}
        {state === "error" && <XCircle className="text-coral" size={24} />}
        {state === "waiting" && <MailCheck className="text-sage" size={24} />}
      </div>

      <h1 className="mt-4 font-serif text-[22px] font-semibold">
        {title}
      </h1>

      <p className="mt-2 text-[13px] leading-6 text-ink-soft" aria-live="polite">
        {description}
      </p>

      {(state === "waiting" || state === "error") && (
        <form onSubmit={handleResend} className="mt-6 space-y-3 text-left">
          <Input
            id="verification-email"
            label={t("common.email")}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          {resendSuccess && (
            <p className="rounded-[8px] bg-sage-soft px-3 py-2 text-[12px] text-sage" aria-live="polite">
              {t("verify.resendSuccess")}
            </p>
          )}
          {resendError && (
            <p className="rounded-[8px] bg-coral-soft px-3 py-2 text-[12px] text-coral" role="alert">
              {resendError}
            </p>
          )}

          <Button
            type="submit"
            variant="yellow"
            disabled={resending || cooldown > 0}
            className="w-full"
          >
            {resending
              ? t("verify.resending")
              : cooldown > 0
                ? t("verify.resendCooldown", { seconds: cooldown })
                : t("verify.resend")}
          </Button>
        </form>
      )}

      {state !== "verifying" && (
        <Link
          href="/auth/login"
          className="mt-6 inline-block text-[13px] font-medium text-ink hover:underline"
        >
          {t("verify.continue")}
        </Link>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <p className="text-[13px] text-ink-soft">{t("common.loading")}</p>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
