import { Resend } from "resend";

import { env } from "@/server/config/env";
import type {
  SendEmailInput,
  SendEmailResult,
} from "@/server/integrations/email/email.types";
import { logger } from "@/server/utils/logger";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error("Resend is enabled but RESEND_API_KEY is not configured");
  }

  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function recipientDomain(email: string): string {
  const separator = email.lastIndexOf("@");
  return separator >= 0 ? email.slice(separator + 1).toLowerCase() : "unknown";
}

function normaliseProviderError(error: unknown): {
  name?: string;
  statusCode?: number;
} {
  if (!error || typeof error !== "object") return {};

  const candidate = error as {
    name?: unknown;
    statusCode?: unknown;
  };

  return {
    ...(typeof candidate.name === "string" ? { name: candidate.name } : {}),
    ...(typeof candidate.statusCode === "number"
      ? { statusCode: candidate.statusCode }
      : {}),
  };
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!env.EMAIL_ENABLED) {
    logger.info("Email delivery skipped because EMAIL_ENABLED is false", {
      subject: input.subject,
      recipientDomain: recipientDomain(input.to),
    });

    return { status: "disabled" };
  }

  const client = getResendClient();
  const { data, error } = await client.emails.send(
    {
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: env.EMAIL_REPLY_TO || undefined,
      tags: input.tags,
    },
    {
      idempotencyKey: input.idempotencyKey,
    },
  );

  if (error) {
    logger.error("Failed to send transactional email", {
      subject: input.subject,
      recipientDomain: recipientDomain(input.to),
      provider: normaliseProviderError(error),
    });
    throw new Error("Failed to send email");
  }

  if (!data?.id) {
    throw new Error("Email provider did not return a message ID");
  }

  return {
    status: "sent",
    messageId: data.id,
  };
}
