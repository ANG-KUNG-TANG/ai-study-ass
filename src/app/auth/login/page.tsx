"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

import { AuthPageMark } from "@/components/auth/AuthPageMark";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  account_link_required:
    "This email already uses password sign-in. Log in with your password.",
  invalid_state: "Google sign-in expired. Please try again.",
  not_configured: "Google sign-in is not configured yet.",
  rate_limited: "Too many sign-in attempts. Please wait and try again.",
  failed: "Google sign-in could not be completed. Please try again.",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthErrorDismissed, setOauthErrorDismissed] = useState(false);
  const oauthErrorCode = searchParams.get("oauth_error");
  const oauthError =
    !oauthErrorDismissed && oauthErrorCode
      ? (OAUTH_ERROR_MESSAGES[oauthErrorCode] ?? OAUTH_ERROR_MESSAGES.failed)
      : "";
  const displayedError = error || oauthError;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setOauthErrorDismissed(true);
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/student/dashboard");
    } catch (unknownError: unknown) {
      setError(
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : "Invalid email or password.",
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
          Welcome back
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          Continue your learning journey.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-[13px] font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-[46px] w-full rounded-[13px] border border-line bg-paper-raised/45 px-4 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-[13px] font-medium text-ink">
            Password
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
              className="h-[46px] w-full rounded-[13px] border border-line bg-paper-raised/45 px-4 pr-12 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-3.5 flex items-center text-ink-faint transition-colors hover:text-ink-soft"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {displayedError && (
          <p className="rounded-xl bg-coral-soft px-4 py-3 text-[13px] text-coral">
            {displayedError}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 text-[12px]">
          <label className="flex items-center gap-2.5 text-ink-soft">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line accent-yellow"
            />
            Remember me
          </label>
          <Link
            href="/auth/forgot-password"
            className="font-medium text-coral hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="yellow"
          className="h-[46px] w-full rounded-[13px] text-[13px] font-semibold shadow-[0_6px_16px_rgba(255,206,62,0.16)]"
          disabled={isLoading}
        >
          {isLoading ? "Logging in…" : "Log in"}
          {!isLoading && <ArrowRight size={18} strokeWidth={1.8} />}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12px] font-medium text-ink-soft">OR</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleAuthButton />

      <p className="mt-5 text-center text-[13px] text-ink-soft">
        Don’t have an account?{" "}
        <Link
          href="/auth/register"
          className="font-semibold text-ink hover:underline"
        >
          Sign up
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
