"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { forgotPassword } from "@/services/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-[#E6DDC8] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DCEBDF] text-[#4C7A5A]">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="font-serif text-xl font-semibold">Check your inbox</h2>
        <p className="mt-1 text-sm text-[#726B5C]">
          We've sent a password reset link to <strong>{email}</strong>.
        </p>
        <Link href="/auth/login" className="mt-6 inline-block text-sm font-medium text-[#E85D46] hover:underline">
          ← Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E6DDC8] bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-[#221F1A]">Reset password</h1>
        <p className="mt-1 text-sm text-[#726B5C]">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {error && <p className="text-[13px] text-[#E85D46]">{error}</p>}

        <Button type="submit" variant="yellow" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending…" : "Send reset link"}
          {!isLoading && <ArrowRight size={16} strokeWidth={1.8} />}
        </Button>
      </form>

      <Link
        href="/auth/login"
        className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[#726B5C] hover:text-[#221F1A]"
      >
        <ArrowLeft size={14} />
        Back to login
      </Link>
    </div>
  );
}