import type {
  TelegramApiResponse,
  TelegramFile,
} from "./telegram.types";

import { logger } from "@/server/utils/logger";

const TELEGRAM_API_URL = "https://api.telegram.org";

const TELEGRAM_REQUEST_TIMEOUT_MS = 10_000;
const TELEGRAM_MAX_ATTEMPTS = 3;
const TELEGRAM_BASE_BACKOFF_MS = 500;

export interface TelegramInlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}
export interface TelegramSendMessageOptions {
  buttons?: TelegramInlineButton[][];
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  return token;
}

function createTelegramApiUrl(method: string): string {
  return `${TELEGRAM_API_URL}/bot${getBotToken()}/${method}`;
}

function createTelegramFileUrl(filePath: string): string {
  return `${TELEGRAM_API_URL}/file/bot${getBotToken()}/${filePath}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function backoffMs(attempt: number): number {
  return TELEGRAM_BASE_BACKOFF_MS * 2 ** Math.max(attempt - 1, 0);
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");

  if (!value) {
    return null;
  }

  const seconds = Number.parseFloat(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return Math.ceil(seconds * 1_000);
}

function getErrorDetails(error: unknown): {
  message: string;
  cause?: string;
} {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
    };
  }

  const cause = error.cause;

  if (!cause) {
    return {
      message: error.message,
    };
  }

  if (cause instanceof Error) {
    const errorWithCode = cause as Error & {
      code?: string;
    };

    return {
      message: error.message,
      cause: errorWithCode.code
        ? `${errorWithCode.name}: ${errorWithCode.message} (${errorWithCode.code})`
        : `${errorWithCode.name}: ${errorWithCode.message}`,
    };
  }

  return {
    message: error.message,
    cause: String(cause),
  };
}

async function telegramFetch(
  operation: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= TELEGRAM_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, TELEGRAM_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (
        !shouldRetryStatus(response.status) ||
        attempt === TELEGRAM_MAX_ATTEMPTS
      ) {
        return response;
      }

      const delay =
        retryAfterMs(response) ??
        backoffMs(attempt);

      // Consume the response before retrying so the connection can be reused.
      await response.arrayBuffer().catch(() => undefined);

      logger.warn("[telegram] API request retry", {
        operation,
        attempt,
        maxAttempts: TELEGRAM_MAX_ATTEMPTS,
        status: response.status,
        retryInMs: delay,
      });

      await sleep(delay);
    } catch (error) {
      lastError = error;

      if (attempt === TELEGRAM_MAX_ATTEMPTS) {
        const details = getErrorDetails(error);

        throw new Error(
          `Telegram ${operation} request failed after ${TELEGRAM_MAX_ATTEMPTS} attempts: ${details.message}${
            details.cause ? `; cause=${details.cause}` : ""
          }`,
          {
            cause: error,
          },
        );
      }

      const delay = backoffMs(attempt);
      const details = getErrorDetails(error);

      logger.warn("[telegram] API request retry", {
        operation,
        attempt,
        maxAttempts: TELEGRAM_MAX_ATTEMPTS,
        error: details.message,
        cause: details.cause,
        retryInMs: delay,
      });

      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Telegram ${operation} request failed`);
}

// ─── Send Message ─────────────────────────────────────────────────────────────

export async function sendMessage(
  chatId: number,
  text: string,
  options: TelegramSendMessageOptions = {},
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (options.buttons?.length) {
    body.reply_markup = {
      inline_keyboard: options.buttons,
    };
  }

  const response = await telegramFetch(
    "sendMessage",
    createTelegramApiUrl("sendMessage"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const data =
    (await response.json()) as TelegramApiResponse<unknown>;

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram sendMessage failed: ${
        data.description ?? response.statusText
      }`,
    );
  }
}
// ─── Answer Callback Query ────────────────────────────────────────────────────

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  };

  if (text) {
    body.text = text;
  }

  const response = await telegramFetch(
    "answerCallbackQuery",
    createTelegramApiUrl("answerCallbackQuery"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const data =
    (await response.json()) as TelegramApiResponse<boolean>;

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram answerCallbackQuery failed: ${
        data.description ?? response.statusText
      }`,
    );
  }
}

// ─── Get File ─────────────────────────────────────────────────────────────────

export async function getFile(
  fileId: string,
): Promise<TelegramFile> {
  const response = await telegramFetch(
    "getFile",
    createTelegramApiUrl("getFile"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_id: fileId,
      }),
    },
  );

  const data =
    (await response.json()) as TelegramApiResponse<TelegramFile>;

  if (!response.ok || !data.ok || !data.result) {
    throw new Error(
      `Telegram getFile failed: ${
        data.description ?? response.statusText
      }`,
    );
  }

  if (!data.result.file_path) {
    throw new Error("Telegram did not return a file path");
  }

  return data.result;
}

// ─── Download File ────────────────────────────────────────────────────────────

export async function downloadFile(
  filePath: string,
): Promise<Buffer> {
  const response = await telegramFetch(
    "downloadFile",
    createTelegramFileUrl(filePath),
  );

  if (!response.ok) {
    throw new Error(
      `Telegram file download failed with status ${response.status}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}
