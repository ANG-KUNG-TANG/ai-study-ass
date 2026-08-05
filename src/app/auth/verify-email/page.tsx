"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { verifyEmail } from "@/services/auth.service";

type VerificationState = "verifying" | "verified" | "error";

function VerifyEmailContent() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<VerificationState>(
    token ? "verifying" : "error",
  );
  const [message, setMessage] = useState(
    token
      ? "We’re confirming your email address."
      : "This verification link is missing its token.",
  );

  useEffect(() => {
    if (!token) return;

    let active = true;

    void verifyEmail(token)
      .then((result) => {
        if (!active) return;
        setState("verified");
        setMessage(result.message || "Your email address has been verified.");
      })
      .catch((unknownError: unknown) => {
        if (!active) return;
        setState("error");
        setMessage(
          unknownError instanceof Error && unknownError.message
            ? unknownError.message
            : "The verification link is invalid or has expired.",
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
          ? "Verifying your email"
          : state === "verified"
            ? "Email verified"
            : "Verification failed"}
      </h1>

      <p className="mt-2 text-[13px] leading-6 text-ink-soft">{message}</p>

      {state !== "verifying" && (
        <Link
          href="/auth/login"
          className="mt-6 inline-block text-[13px] font-medium text-ink hover:underline"
        >
          Continue to login
        </Link>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-ink-soft">Loading…</p>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
