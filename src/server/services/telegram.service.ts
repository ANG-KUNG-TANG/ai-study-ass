import type {
  TelegramDocument,
  TelegramMessage,
  TelegramUpdate,
} from "@/server/integrations/telegram/telegram.types";
import { linkTelegramAccount } from "@/server/services/telegramLink.service";
import {
  sendMessage,
  getFile,
  downloadFile,
} from "@/server/integrations/telegram/telegram.client";

const PDF_MIME_TYPE = "application/pdf";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

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

  // ─── 1. Validate file type ────────────────────────────────────────────────

  if (!looksLikePdf(document)) {
    await sendMessage(
      chatId,
      ["❌ Unsupported file type.", "", "Please upload a PDF document."].join(
        "\n",
      ),
    );

    return;
  }

  // ─── 2. Validate Telegram file size ──────────────────────────────────────

  if (document.file_size && document.file_size > MAX_FILE_SIZE_BYTES) {
    await sendMessage(
      chatId,
      [
        "❌ PDF is too large.",
        "",
        "Telegram uploads are currently limited to 20 MB for this bot.",
      ].join("\n"),
    );

    return;
  }

  const fileName = document.file_name ?? "document.pdf";

  await sendMessage(
    chatId,
    [
      "📄 PDF received!",
      "",
      `File: ${fileName}`,
      "",
      "⏳ Validating document...",
    ].join("\n"),
  );

  // ─── 3. Ask Telegram for file path ───────────────────────────────────────

  const telegramFile = await getFile(document.file_id);

  // ─── 4. Download PDF ─────────────────────────────────────────────────────

  const pdfBuffer = await downloadFile(telegramFile.file_path!);

  // ─── 5. Check downloaded size ────────────────────────────────────────────

  if (pdfBuffer.length > MAX_FILE_SIZE_BYTES) {
    await sendMessage(chatId, "❌ The downloaded PDF exceeds the 20 MB limit.");

    return;
  }

  // ─── 6. Verify actual PDF data ───────────────────────────────────────────

  if (!hasPdfSignature(pdfBuffer)) {
    await sendMessage(
      chatId,
      [
        "❌ This file does not appear to be a valid PDF.",
        "",
        "Please upload another document.",
      ].join("\n"),
    );

    return;
  }

  // ─── 7. Temporary success response ───────────────────────────────────────

  const sizeMb = pdfBuffer.length / (1024 * 1024);

  await sendMessage(
    chatId,
    [
      "✅ PDF validated successfully!",
      "",
      `📄 ${fileName}`,
      `📦 ${sizeMb.toFixed(2)} MB`,
      "",
      "The document is ready for processing.",
    ].join("\n"),
  );

  // NEXT STAGE:
  //
  // await documentIngestionService.ingest({
  //   buffer: pdfBuffer,
  //   fileName,
  //   mimeType: PDF_MIME_TYPE,
  //   source: "telegram",
  //   ...
  // });
}

async function handleText(message: TelegramMessage): Promise<void> {
  const text = message.text?.trim();

  if (!text) {
    return;
  }

  // Supports:
  // /start
  // /start TOKEN
  // /start@aistudyassbot TOKEN
  const startMatch = text.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/);

  if (startMatch) {
    const token = startMatch[1]?.trim();

    if (token) {
      await handleAccountLink(message, token);
      return;
    }

    await handleStart(message);
    return;
  }

  switch (text) {
    case "/help":
      await handleHelp(message);
      return;

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

async function handleAccountLink(
  message: TelegramMessage,
  token: string,
): Promise<void> {
  const sender = message.from;

  if (!sender) {
    await sendMessage(
      message.chat.id,
      "❌ Unable to identify your Telegram account.",
    );
    return;
  }

  try {
    const integration = await linkTelegramAccount({
      token,
      telegramUserId: sender.id,
      telegramChatId: message.chat.id,
      telegramUsername: sender.username,
      telegramFirstName: sender.first_name,
    });

    console.info("[telegram] account linked", {
      userId: integration.userId,
      telegramUserId: sender.id,
    });

    await sendMessage(
      message.chat.id,
      [
        "✅ Telegram connected successfully!",
        "",
        "Your Telegram account is now linked to AI Study Assistant.",
        "",
        "You can upload PDFs directly here.",
      ].join("\n"),
    );
  } catch (error) {
    console.error("[telegram] account linking failed", {
      telegramUserId: sender.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await sendMessage(
      message.chat.id,
      [
        "❌ Unable to connect Telegram.",
        "",
        "The link may be invalid, expired, or already used.",
        "",
        "Generate a new connection link and try again.",
      ].join("\n"),
    );
  }
}

function looksLikePdf(document: TelegramDocument): boolean {
  const mimeIsPdf = document.mime_type === PDF_MIME_TYPE;

  const extensionIsPdf =
    document.file_name?.toLowerCase().endsWith(".pdf") ?? false;

  return mimeIsPdf || extensionIsPdf;
}

function hasPdfSignature(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }

  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}
