import type { TelegramSendMessageResponse } from "./telegram.types";

const TELEGRAM_API_URL = "https://api.telegram.org";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  return token;
}

function createTelegramUrl(method: string): string {
  return `${TELEGRAM_API_URL}/bot${getBotToken()}/${method}`;
}

export async function sendMessage(
  chatId: number,
  text: string,
): Promise<TelegramSendMessageResponse> {
  const response = await fetch(createTelegramUrl("sendMessage"), {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  const data = (await response.json()) as TelegramSendMessageResponse;

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram API error: ${data.description ?? response.statusText}`,
    );
  }

  return data;
}
