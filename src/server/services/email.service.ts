import { createHash } from "node:crypto";

import { env } from "@/server/config/env";
import { sendEmail } from "@/server/integrations/email/resend.client";
import {
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from "@/server/templates/email.templates";

function actionUrl(pathname: string, token: string): string {
  const url = new URL(pathname, env.APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

function actionId(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const template = verificationEmailTemplate(
    actionUrl("/auth/verify-email", token),
  );

  await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    idempotencyKey: `verify-email/${actionId(token)}`,
    tags: [{ name: "email_type", value: "verification" }],
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const template = passwordResetEmailTemplate(
    actionUrl("/auth/reset-password", token),
  );

  await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    idempotencyKey: `password-reset/${actionId(token)}`,
    tags: [{ name: "email_type", value: "password_reset" }],
  });
}
