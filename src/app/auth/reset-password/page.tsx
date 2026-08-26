"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import { AuthPageMark } from "@/components/auth/AuthPageMark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/context/LanguageContext";
import { resetPassword } from "@/services/auth.service";

function ResetPasswordForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <p className="text-[13px] text-coral">
        {t("reset.missingToken")}
      </p>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("reset.passwordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, password, confirmPassword);
      router.push("/auth/login");
    } catch (unknownError: unknown) {
      setError(
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : t("reset.failed"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-1">
      <div className="mb-7">
        <AuthPageMark />
        <h1 className="text-[38px] font-bold leading-[0.98] tracking-[-0.055em] text-ink sm:text-[44px]">
          {t("reset.title")}
        </h1>
        <p className="mt-3 text-[13px] leading-6 text-ink-soft">
          {t("reset.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label={t("reset.newPassword")}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-[50px] rounded-[10px] bg-paper-raised px-4 text-[13px] focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-[34px] text-ink-faint hover:text-ink-soft"
            aria-label={
              showPassword
                ? t("common.hidePassword")
                : t("common.showPassword")
            }
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <p className="-mt-2 text-[11px] text-ink-soft">{t("register.passwordHelp")}</p>

        <Input
          label={t("reset.confirmPassword")}
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-[50px] rounded-[10px] bg-paper-raised px-4 text-[13px] focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
          required
        />

        {error && <p className="text-[13px] text-coral">{error}</p>}

        <Button
          type="submit"
          variant="yellow"
          className="h-[50px] w-full rounded-full text-[13px] font-bold"
          disabled={isLoading}
        >
          {isLoading ? t("reset.submitting") : t("reset.submit")}
          {!isLoading && <ArrowRight size={16} strokeWidth={1.8} />}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <p className="text-[13px] text-ink-soft">
          {t("common.loading")}
        </p>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
