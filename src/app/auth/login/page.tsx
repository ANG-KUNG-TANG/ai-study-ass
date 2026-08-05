"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
    <div className="rounded-2xl border border-[#E6DDC8] bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-semibold text-[#221F1A]">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-[#726B5C]">
          Log in to continue your studies.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <div className="relative">
          <Input
            label="Password"
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
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p className="text-[13px] text-[#E85D46]">{error}</p>}

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-[#726B5C]">
            <input
              type="checkbox"
              className="rounded border-[#E6DDC8] text-[#FFCE3E] focus:ring-0"
            />
            Remember me
          </label>
          <Link
            href="/auth/forgot-password"
            className="font-medium text-[#E85D46] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="yellow"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? "Logging in…" : "Log in"}
          {!isLoading && <ArrowRight size={16} strokeWidth={1.8} />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#726B5C]">
        Don’t have an account?{" "}
        <Link
          href="/auth/register"
          className="font-semibold text-[#221F1A] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
