
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/services/auth.service";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({ name: form.name, email: form.email, password: form.password });
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-[380px] text-center">
        <h1 className="mb-2 font-serif text-[20px] font-semibold">Check your email</h1>
        <p className="mb-4 text-[13px] text-ink-soft">{success}</p>
        <Link href="/auth/login" className="text-[12.5px] font-medium text-ink hover:underline">
          Back to log in
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[380px]">
      <h1 className="mb-1 font-serif text-[22px] font-semibold">Create your account</h1>
      <p className="mb-6 text-[13px] text-ink-soft">Start studying smarter.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <p className="-mt-2 text-[11px] text-ink-faint">
          At least 8 characters, with uppercase, lowercase, a number, and a special character.
        </p>
        <Input
          label="Confirm password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          required
        />

        {error && <p className="text-[12.5px] text-coral">{error}</p>}

        <Button type="submit" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-ink-soft">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-ink hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}