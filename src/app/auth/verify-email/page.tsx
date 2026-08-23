"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/context/LanguageContext";
import { verifyEmail } from "@/services/auth.service";

type VerificationState = "verifying" | "verified" | "error";

function VerifyEmailContent() {
  const { t } = useLanguage();
  const token = useSearchParams().get("token");
  const [state, setState] = useState<VerificationState>(
    token ? "verifying" : "error",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let active = true;

    void verifyEmail(token)
      .then((result) => {
        if (!active) return;
        setState("verified");
        setMessage(result.message || null);
      })
      .catch((unknownError: unknown) => {
        if (!active) return;
        setState("error");
        setMessage(
          unknownError instanceof Error && unknownError.message
            ? unknownError.message
            : null,
        );
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <Card className="w-full max-w-[420px] text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-line-soft">
        {state === "verifying" && (
          <LoaderCircle className="animate-spin text-ink-soft" size={24} />
        )}
        {state === "verified" && <CheckCircle2 className="text-green-700" size={24} />}
        {state === "error" && <XCircle className="text-coral" size={24} />}
      </div>

      <h1 className="mt-4 font-serif text-[22px] font-semibold">
        {state === "verifying"
          ? t("verify.title.verifying")
          : state === "verified"
            ? t("verify.title.verified")
            : t("verify.title.failed")}
      </h1>

      <p className="mt-2 text-[13px] leading-6 text-ink-soft">
        {message ??
          (state === "verifying"
            ? t("verify.confirming")
            : state === "verified"
              ? t("verify.success")
              : token
                ? t("verify.invalid")
                : t("verify.missingToken"))}
      </p>

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
