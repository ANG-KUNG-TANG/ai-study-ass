"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

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
      <p className="text-[13px] text-[#E85D46]">
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
    <div className="rounded-2xl border border-[#E6DDC8] bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-[#221F1A]">
          {t("reset.title")}
        </h1>
        <p className="mt-1 text-sm text-[#726B5C]">
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
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-[34px] text-[#B3A98F] hover:text-[#726B5C]"
            aria-label={
              showPassword
                ? t("common.hidePassword")
                : t("common.showPassword")
            }
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <p className="-mt-2 text-[11px] text-[#726B5C]">
          Use at least 8 characters with uppercase, lowercase, a number, and a
          special character.
        </p>

        <Input
          label={t("reset.confirmPassword")}
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

        {error && <p className="text-[13px] text-[#E85D46]">{error}</p>}

        <Button
          type="submit"
          variant="yellow"
          className="w-full"
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
        <p className="text-[13px] text-[#726B5C]">
          {t("common.loading")}
        </p>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
