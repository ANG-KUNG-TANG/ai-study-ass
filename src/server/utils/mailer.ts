import { Resend } from "resend";
import { logger } from "@/server/utils/logger";
import { z } from "zod";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Same exported signatures as before — sendVerificationEmail / sendPasswordResetEmail
// (email: string, token: string) => Promise<void> — so nothing calling this module
// needs to change. Internals now use Resend's HTTPS API instead of raw SMTP,
// which sidesteps outbound-SMTP-port blocking on hosts like Vercel.
//
// Setup:
//   npm install resend
//   Add RESEND_API_KEY to your env (get one at resend.com — free tier available)
//   Verify a sending domain in Resend, or use their shared onboarding domain for dev
//
// ASSUMPTION — env vars not yet in env.ts. Add if missing:
//   RESEND_API_KEY, EMAIL_FROM, APP_URL

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "AI Study Assistant <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!resend) {
    // Dev fallback — no API key configured, log instead of sending
    logger.info("Email not sent — RESEND_API_KEY not configured (dev mode)", { to, subject, text });
    return;
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    // Don't leak provider error details to the caller — just log + surface a generic failure
    logger.error("Failed to send email via Resend", { to, subject, error });
    throw new Error("Failed to send email");
  }
}

// ─── Verification email ────────────────────────────────────────────────────────

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verify your email — AI Study Assistant";

  const text = `Welcome to AI Study Assistant!\n\nVerify your email: ${link}\n\nThis link expires in 24 hours.`;
  const html = `
    <p>Welcome to AI Study Assistant!</p>
    <p><a href="${link}">Click here to verify your email</a></p>
    <p>Or paste this link into your browser:<br>${link}</p>
    <p>This link expires in 24 hours.</p>
  `;

  await send(email, subject, html, text);
}

// ─── Password reset email ──────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your password — AI Study Assistant";

  const text = `Reset your password: ${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
  const html = `
    <p>We received a request to reset your password.</p>
    <p><a href="${link}">Click here to reset your password</a></p>
    <p>Or paste this link into your browser:<br>${link}</p>
    <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `;

  await send(email, subject, html, text);
}

// // ── Email (Resend) ─────────────────────────────────────────────────────
// RESEND_API_KEY: z.string().optional(), // optional so dev works without it (mailer.ts logs instead of sending)
// EMAIL_FROM: z.string().default("AI Study Assistant <onboarding@resend.dev>"),
// APP_URL: z.string().url().default("http://localhost:3000"),