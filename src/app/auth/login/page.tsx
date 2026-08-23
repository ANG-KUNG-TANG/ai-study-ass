"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

import { AuthPageMark } from "@/components/auth/AuthPageMark";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
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

        {error && (
          <p className="rounded-xl bg-coral-soft px-4 py-3 text-[13px] text-coral">
            {error}
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

      <button
        type="button"
        className="flex h-[46px] w-full items-center justify-center gap-3 rounded-[13px] border border-line bg-paper-raised/55 px-4 text-[13px] font-medium text-ink transition-colors hover:bg-paper-raised"
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
        Continue with Google
      </button>

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
