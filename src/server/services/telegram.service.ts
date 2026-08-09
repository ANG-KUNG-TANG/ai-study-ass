import type {
  TelegramDocument,
  TelegramMessage,
  TelegramUpdate,
} from "@/server/integrations/telegram/telegram.types";

import { sendMessage } from "@/server/integrations/telegram/telegram.client";

const PDF_MIME_TYPE = "application/pdf";

async function handleStart(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;

  await sendMessage(
    chatId,
    [
      "👋 Welcome to AI Study Assistant!",
      "",
      "Upload a PDF and I will generate:",
      "",
      "📝 Summary",
      "🧠 Knowledge Concepts",
      "❓ Quiz",
      "🃏 Flashcards",
      "",
      "Use /help if you need instructions.",
    ].join("\n"),
  );
}

async function handleHelp(message: TelegramMessage): Promise<void> {
  await sendMessage(
    message.chat.id,
    [
      "📚 How to use AI Study Assistant",
      "",
      "1. Upload a PDF document.",
      "2. Wait while the document is processed.",
      "3. Receive your generated study materials.",
      "",
      "Available features:",
      "📝 Summary",
      "🧠 Knowledge Concepts",
      "❓ Quiz",
      "🃏 Flashcards",
    ].join("\n"),
  );
}

async function handleDocument(
  message: TelegramMessage,
  document: TelegramDocument,
): Promise<void> {
  const chatId = message.chat.id;

  if (document.mime_type !== PDF_MIME_TYPE) {
    await sendMessage(chatId, "❌ Please upload a PDF document.");

    return;
  }

  await sendMessage(
    chatId,
    [
      "📄 PDF received!",
      "",
      `File: ${document.file_name ?? "document.pdf"}`,
      "",
      "⏳ PDF processing will be connected in the next stage.",
    ].join("\n"),
  );

  // Later:
  //
  // const file = await telegramClient.getFile(document.file_id);
  // const pdf = await telegramClient.downloadFile(file.file_path);
  //
  // await documentIngestionService.ingest({
  //   source: "telegram",
  //   ...
  // });
}

async function handleText(message: TelegramMessage): Promise<void> {
  switch (message.text) {
    case "/start":
      return handleStart(message);

    case "/help":
      return handleHelp(message);

    default:
      await sendMessage(message.chat.id, "Please upload a PDF or use /help.");
  }
}

export async function processUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;

  if (!message) {
    return;
  }

  if (message.document) {
    await handleDocument(message, message.document);

    return;
  }

  if (message.text) {
    await handleText(message);
  }
}
