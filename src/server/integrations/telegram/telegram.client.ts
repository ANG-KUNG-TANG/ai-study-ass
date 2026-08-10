import type {
  TelegramApiResponse,
  TelegramFile,
} from "./telegram.types";

const TELEGRAM_API_URL = "https://api.telegram.org";

export interface TelegramInlineButton {
  text: string;
  url: string;
}

export interface TelegramSendMessageOptions {
  buttons?: TelegramInlineButton[][];
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;

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

  const response = await fetch(createTelegramApiUrl("sendMessage"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

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

// ─── Get File ─────────────────────────────────────────────────────────────────

export async function getFile(fileId: string): Promise<TelegramFile> {
  const response = await fetch(createTelegramApiUrl("getFile"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_id: fileId,
    }),
  });

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

export async function downloadFile(filePath: string): Promise<Buffer> {
  const response = await fetch(createTelegramFileUrl(filePath));

  if (!response.ok) {
    throw new Error(
      `Telegram file download failed with status ${response.status}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}
