import type {
  TelegramDocument,
  TelegramMessage,
  TelegramUpdate,
  TelegramCallbackQuery,
} from "@/server/integrations/telegram/telegram.types";

import {
  answerCallbackQuery,
  sendMessage,
  getFile,
  downloadFile,
} from "@/server/integrations/telegram/telegram.client";

import { linkTelegramAccount } from "@/server/services/telegramLink.service";
import { processUpload } from "@/server/services/upload.service";
import { createNote } from "@/server/services/note.service";

import * as telegramIntegrationRepo from "@/server/repositories/telegramIntegration.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import type {
  FeatureGenerationStatus,
  StudyGenerationStage,
  StudyGenerationState,
} from "@/server/types/generation";
import { retryStudyGeneration } from "@/server/queues/study-generation.queue";
import { logger } from "@/server/utils/logger";

const PDF_MIME_TYPE = "application/pdf";
const TELEGRAM_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;

type NoteCallbackAction = "status" | "retry";

interface NoteCallback {
  action: NoteCallbackAction;
  noteId: string;
}

function parseNoteCallback(data: string): NoteCallback | null {
  const match = data.match(/^(status|retry):(.+)$/);

  if (!match) {
    return null;
  }

  return {
    action: match[1] as NoteCallbackAction,
    noteId: match[2],
  };
}

function getPublicAppUrl(): string {
  const url = process.env.APP_PUBLIC_URL?.trim();

  if (!url) {
    throw new Error("APP_PUBLIC_URL is not configured");
  }

  return url.replace(/\/+$/, "");
}

function buildDashboardUrl(): string {
  return `${getPublicAppUrl()}/student/dashboard`;
}

function buildLoginUrl(): string {
  const destination = encodeURIComponent("/student/dashboard");

  return `${getPublicAppUrl()}/auth/login?from=${destination}`;
}

function buildNoteUrl(noteId: string): string {
  return `${getPublicAppUrl()}/student/notes/${noteId}/summary`;
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

function parseStartCommand(text: string): {
  isStart: boolean;
  payload?: string;
} {
  const match = text.trim().match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/);

  if (!match) {
    return {
      isStart: false,
    };
  }

  const payload = match[1]?.trim();

  return {
    isStart: true,
    payload: payload && payload.length > 0 ? payload : undefined,
  };
}

function featureStatusIcon(status: FeatureGenerationStatus): string {
  switch (status) {
    case "ready":
      return "✅";

    case "generating":
      return "🔄";

    case "partial":
      return "⚠️";

    case "failed":
      return "❌";

    case "pending":
    default:
      return "⏳";
  }
}

function intelligenceStatusIcon(stage: StudyGenerationStage): string {
  switch (stage) {
    case "failed":
      return "❌";

    case "partial":
      return "⚠️";

    case "pending":
      return "⏳";

    case "analyzing":
      return "🔄";

    case "generating":
    case "complete":
      return "✅";

    default:
      return "⏳";
  }
}

function generationStageLabel(stage: StudyGenerationStage): string {
  switch (stage) {
    case "pending":
      return "Waiting to start";

    case "analyzing":
      return "Analyzing document";

    case "generating":
      return "Generating study materials";

    case "complete":
      return "Complete";

    case "partial":
      return "Completed with some issues";

    case "failed":
      return "Failed";

    default:
      return "Unknown";
  }
}

function generationStepLabel(
  step: StudyGenerationState["currentStep"],
): string {
  switch (step) {
    case "queued":
      return "Waiting in queue";

    case "intelligence":
      return "Analyzing document";

    case "summary":
      return "Generating summary";

    case "chatKnowledge":
      return "Generating knowledge concepts";

    case "quiz":
      return "Generating quiz";

    case "flashcards":
      return "Generating flashcards";

    case "complete":
      return "Complete";

    default:
      return "Unknown";
  }
}

// ─── Start / onboarding ───────────────────────────────────────────────────────

async function handleStart(message: TelegramMessage): Promise<void> {
  const sender = message.from;

  if (!sender) {
    await sendMessage(
      message.chat.id,
      "❌ Unable to identify your Telegram account.",
    );
    return;
  }

  const integration = await telegramIntegrationRepo.findByTelegramUserId(
    sender.id,
  );

  if (!integration) {
    await sendMessage(
      message.chat.id,
      [
        "👋 Welcome to AI Study Assistant!",
        "",
        "Turn PDF documents into:",
        "",
        "📝 Summaries",
        "🧠 Knowledge Concepts",
        "❓ Quizzes",
        "🃏 Flashcards",
        "",
        "Your Telegram account is not connected yet.",
        "",
        "Open AI Study Assistant, sign in or create an account, then connect Telegram.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🔗 Open AI Study Assistant",
              url: buildLoginUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  await telegramIntegrationRepo.updateLastActive(sender.id);

  await sendMessage(
    message.chat.id,
    [
      `👋 Welcome back, ${sender.first_name}!`,
      "",
      "✅ Your Telegram account is connected.",
      "",
      "Send me a PDF and I will create:",
      "",
      "📝 Summary",
      "🧠 Knowledge Concepts",
      "❓ Quiz",
      "🃏 Flashcards",
    ].join("\n"),
    {
      buttons: [
        [
          {
            text: "🏠 Open Dashboard",
            url: buildDashboardUrl(),
          },
        ],
      ],
    },
  );
}
// --- retry / retry
async function handleRetry(message: TelegramMessage): Promise<void> {
  const sender = message.from;

  if (!sender) {
    await sendMessage(
      message.chat.id,
      "❌ Unable to identify your Telegram account.",
    );
    return;
  }

  const integration = await telegramIntegrationRepo.findByTelegramUserId(
    sender.id,
  );

  if (!integration) {
    await sendMessage(
      message.chat.id,
      [
        "🔐 Telegram is not connected.",
        "",
        "Connect your AI Study Assistant account before retrying generation.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🔗 Connect Account",
              url: buildLoginUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  await telegramIntegrationRepo.updateLastActive(sender.id);

  const notes = await noteRepo.findManyByUser(integration.userId, {
    page: 1,
    limit: 1,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const note = notes.data[0];

  if (!note) {
    await sendMessage(
      message.chat.id,
      [
        "🔄 Retry Generation",
        "",
        "You do not have any uploaded documents yet.",
        "",
        "Upload a PDF first.",
      ].join("\n"),
    );

    return;
  }

  const generation = await generationRepo.findByNoteId(note.id);

  if (
    generation &&
    (generation.stage === "pending" ||
      generation.stage === "analyzing" ||
      generation.stage === "generating")
  ) {
    await sendMessage(
      message.chat.id,
      [
        "⏳ Generation is already running.",
        "",
        `📄 ${note.title}`,
        "",
        `Current phase: ${generationStepLabel(generation.currentStep)}`,
        "",
        "Use /status to check progress.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "📖 Open Note",
              url: buildNoteUrl(note.id),
            },
          ],
        ],
      },
    );

    return;
  }

  if (generation?.stage === "complete") {
    await sendMessage(
      message.chat.id,
      [
        "✅ Generation is already complete.",
        "",
        `📄 ${note.title}`,
        "",
        "All study materials have already been generated.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "📖 Open Note",
              url: buildNoteUrl(note.id),
            },
          ],
        ],
      },
    );

    return;
  }

  try {
    const result = await retryStudyGeneration({
      noteId: note.id,
      userId: integration.userId,
      telegramChatId: message.chat.id,
      force: true,
    });

    if (result.status === "already-running") {
      await sendMessage(
        message.chat.id,
        [
          "⏳ Generation is already queued or running.",
          "",
          `📄 ${note.title}`,
          "",
          "Use /status to check progress.",
        ].join("\n"),
      );

      return;
    }

    await sendMessage(
      message.chat.id,
      [
        "🔄 Generation retry started!",
        "",
        `📄 ${note.title}`,
        "",
        "The document has been placed back in the generation queue.",
        "",
        "📝 Summary",
        "🧠 Knowledge",
        "❓ Quiz",
        "🃏 Flashcards",
        "",
        "Use /status to follow the progress.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "📖 Open Note",
              url: buildNoteUrl(note.id),
            },
          ],
        ],
      },
    );
  } catch (error) {
    logger.error("[telegram] generation retry failed", {
      noteId: note.id,
      userId: integration.userId,
      telegramUserId: sender.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await sendMessage(
      message.chat.id,
      [
        "❌ Unable to retry generation.",
        "",
        "Please try again later or check /status.",
      ].join("\n"),
    );
  }
}

// ─── Generation status ────────────────────────────────────────────────────────

async function handleGenerationStatus(message: TelegramMessage): Promise<void> {
  const sender = message.from;

  if (!sender) {
    await sendMessage(
      message.chat.id,
      "❌ Unable to identify your Telegram account.",
    );
    return;
  }

  const integration = await telegramIntegrationRepo.findByTelegramUserId(
    sender.id,
  );

  if (!integration) {
    await sendMessage(
      message.chat.id,
      [
        "🔐 Telegram is not connected.",
        "",
        "Connect your AI Study Assistant account first.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🔗 Connect Account",
              url: buildLoginUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  await telegramIntegrationRepo.updateLastActive(sender.id);

  const notes = await noteRepo.findManyByUser(integration.userId, {
    page: 1,
    limit: 1,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const note = notes.data[0];

  if (!note) {
    await sendMessage(
      message.chat.id,
      [
        "📊 Study Generation Status",
        "",
        "You do not have any uploaded documents yet.",
        "",
        "Send me a PDF to start.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🏠 Open Dashboard",
              url: buildDashboardUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  const generation = await generationRepo.findByNoteId(note.id);

  if (!generation) {
    await sendMessage(
      message.chat.id,
      [
        "📊 Study Generation Status",
        "",
        `📄 ${note.title}`,
        "",
        "⏳ Generation is waiting to start.",
        "",
        "The document has been uploaded, but no generation state exists yet.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "📖 Open Note",
              url: buildNoteUrl(note.id),
            },
          ],
        ],
      },
    );

    return;
  }

  const { features } = generation;

  await sendMessage(
    message.chat.id,
    [
      "📊 Study Generation Status",
      "",
      `📄 ${note.title}`,
      "",
      `Current phase: ${generationStepLabel(generation.currentStep)}`,
      "",
      `${intelligenceStatusIcon(generation.stage)} Intelligence`,
      `${featureStatusIcon(features.summary.status)} Summary`,
      `${featureStatusIcon(features.chatKnowledge.status)} Knowledge`,
      `${featureStatusIcon(features.quiz.status)} Quiz`,
      `${featureStatusIcon(features.flashcards.status)} Flashcards`,
      "",
      `Overall: ${generationStageLabel(generation.stage)}`,
    ].join("\n"),
    {
      buttons: [
        [
          {
            text: "📖 Open Note",
            url: buildNoteUrl(note.id),
          },
        ],
        [
          {
            text: "📚 My Files",
            url: buildDashboardUrl(),
          },
        ],
      ],
    },
  );
}

async function sendGenerationStatusForNote(
  chatId: number,
  userId: string,
  noteId: string,
): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    await sendMessage(chatId, "❌ You do not have access to this document.");
    return;
  }

  const generation = await generationRepo.findByNoteId(note.id);

  if (!generation) {
    await sendMessage(
      chatId,
      [
        "📊 Study Generation Status",
        "",
        `📄 ${note.title}`,
        "",
        "⏳ Generation is waiting to start.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "📖 Open Note",
              url: buildNoteUrl(note.id),
            },
          ],
        ],
      },
    );

    return;
  }

  const { features } = generation;

  await sendMessage(
    chatId,
    [
      "📊 Study Generation Status",
      "",
      `📄 ${note.title}`,
      "",
      `Current phase: ${generationStepLabel(generation.currentStep)}`,
      "",
      `${intelligenceStatusIcon(generation.stage)} Intelligence`,
      `${featureStatusIcon(features.summary.status)} Summary`,
      `${featureStatusIcon(features.chatKnowledge.status)} Knowledge`,
      `${featureStatusIcon(features.quiz.status)} Quiz`,
      `${featureStatusIcon(features.flashcards.status)} Flashcards`,
      "",
      `Overall: ${generationStageLabel(generation.stage)}`,
    ].join("\n"),
    {
      buttons: [
        [
          {
            text: "📖 Open Note",
            url: buildNoteUrl(note.id),
          },
        ],
      ],
    },
  );
}

async function retryGenerationForNote(
  chatId: number,
  userId: string,
  noteId: string,
): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    await sendMessage(chatId, "❌ You do not have access to this document.");
    return;
  }

  const generation = await generationRepo.findByNoteId(note.id);

  if (
    generation &&
    (generation.stage === "pending" ||
      generation.stage === "analyzing" ||
      generation.stage === "generating")
  ) {
    await sendMessage(
      chatId,
      [
        "⏳ Generation is already running.",
        "",
        `📄 ${note.title}`,
        "",
        `Current phase: ${generationStepLabel(generation.currentStep)}`,
        "",
        "Use /status to check progress.",
      ].join("\n"),
    );

    return;
  }

  if (generation?.stage === "complete") {
    await sendMessage(
      chatId,
      ["✅ Generation is already complete.", "", `📄 ${note.title}`].join("\n"),
    );

    return;
  }

  const result = await retryStudyGeneration({
    noteId: note.id,
    userId,
    telegramChatId: chatId,
    force: true,
  });

  if (result.status === "already-running") {
    await sendMessage(
      chatId,
      [
        "⏳ Generation is already queued or running.",
        "",
        `📄 ${note.title}`,
      ].join("\n"),
    );

    return;
  }

  await sendMessage(
    chatId,
    [
      "🔄 Generation retry started!",
      "",
      `📄 ${note.title}`,
      "",
      "The document has been placed back in the generation queue.",
      "",
      "Use /status to follow progress.",
    ].join("\n"),
    {
      buttons: [
        [
          {
            text: "📖 Open Note",
            url: buildNoteUrl(note.id),
          },
        ],
      ],
    },
  );
}
// ─── Help ─────────────────────────────────────────────────────────────────────

async function handleHelp(message: TelegramMessage): Promise<void> {
  await sendMessage(
    message.chat.id,
    [
      "📚 AI Study Assistant Help",
      "",
      "1. Connect your Telegram account.",
      "2. Upload a PDF.",
      "3. The PDF is validated and extracted.",
      "4. A study note is created in your web account.",
      "5. Summary, Knowledge, Quiz and Flashcards are generated automatically.",
      "",
      "Commands:",
      "/start - Start or reopen the bot",
      "/account - Check connection",
      "/status - Check latest document generation",
      "/myfiles - View your recent documents",
      "/retry - Retry failed or partial generation",
      "/help - Show this help",
    ].join("\n"),
    {
      buttons: [
        [
          {
            text: "🏠 Open Dashboard",
            url: buildDashboardUrl(),
          },
        ],
      ],
    },
  );
}

// ─── Account link ─────────────────────────────────────────────────────────────

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

    logger.info("[telegram] account linked", {
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
      {
        buttons: [
          [
            {
              text: "🏠 Open Dashboard",
              url: buildDashboardUrl(),
            },
          ],
        ],
      },
    );
  } catch (error) {
    logger.error("[telegram] account linking failed", {
      telegramUserId: sender.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await sendMessage(
      message.chat.id,
      [
        "❌ Unable to connect Telegram.",
        "",
        "The connection link may be invalid, expired, or already used.",
        "",
        "Generate a new connection link from AI Study Assistant and try again.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🌐 Open AI Study Assistant",
              url: buildLoginUrl(),
            },
          ],
        ],
      },
    );
  }
}

// ─── Account status ───────────────────────────────────────────────────────────

async function handleAccount(message: TelegramMessage): Promise<void> {
  const sender = message.from;

  if (!sender) {
    await sendMessage(
      message.chat.id,
      "❌ Unable to identify your Telegram account.",
    );
    return;
  }

  const integration = await telegramIntegrationRepo.findByTelegramUserId(
    sender.id,
  );

  if (!integration) {
    await sendMessage(
      message.chat.id,
      [
        "🔐 Telegram is not connected.",
        "",
        "Open AI Study Assistant to sign in or create an account.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🔗 Connect Account",
              url: buildLoginUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  await telegramIntegrationRepo.updateLastActive(sender.id);

  await sendMessage(
    message.chat.id,
    [
      "✅ Telegram connected",
      "",
      `Name: ${sender.first_name}`,
      sender.username ? `Telegram: @${sender.username}` : "",
      "",
      "PDF uploads from this chat are saved to your AI Study Assistant account.",
    ]
      .filter(Boolean)
      .join("\n"),
    {
      buttons: [
        [
          {
            text: "🏠 Open Dashboard",
            url: buildDashboardUrl(),
          },
        ],
      ],
    },
  );
}

// ─── PDF upload ───────────────────────────────────────────────────────────────

async function handleDocument(
  message: TelegramMessage,
  document: TelegramDocument,
): Promise<void> {
  const chatId = message.chat.id;
  const sender = message.from;

  if (!sender) {
    await sendMessage(chatId, "❌ Unable to identify your Telegram account.");
    return;
  }

  const integration = await telegramIntegrationRepo.findByTelegramUserId(
    sender.id,
  );

  if (!integration) {
    await sendMessage(
      chatId,
      [
        "🔐 Connect your account first",
        "",
        "Your Telegram account is not linked to AI Study Assistant.",
        "",
        "Open AI Study Assistant, sign in or create an account, connect Telegram, then upload this PDF again.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🔗 Open AI Study Assistant",
              url: buildLoginUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  const userId = integration.userId;

  await telegramIntegrationRepo.updateLastActive(sender.id);

  if (!looksLikePdf(document)) {
    await sendMessage(
      chatId,
      ["❌ Unsupported file type.", "", "Please upload a PDF document."].join(
        "\n",
      ),
    );
    return;
  }

  if (
    document.file_size &&
    document.file_size > TELEGRAM_DOWNLOAD_LIMIT_BYTES
  ) {
    await sendMessage(
      chatId,
      [
        "❌ PDF is too large.",
        "",
        "Telegram PDF uploads are currently limited to 20 MB.",
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
      "⏳ Downloading and validating...",
    ].join("\n"),
  );

  try {
    const telegramFile = await getFile(document.file_id);

    if (!telegramFile.file_path) {
      throw new Error("Telegram did not provide a downloadable file path.");
    }

    const pdfBuffer = await downloadFile(telegramFile.file_path);

    if (pdfBuffer.length === 0) {
      throw new Error("Downloaded PDF is empty.");
    }

    if (pdfBuffer.length > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      await sendMessage(
        chatId,
        "❌ The downloaded PDF exceeds the Telegram 20 MB limit.",
      );
      return;
    }

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

    await sendMessage(
      chatId,
      ["✅ PDF validated!", "", "⏳ Extracting document content..."].join("\n"),
    );

    const processed = await processUpload({
      buffer: pdfBuffer,
      originalName: fileName,
      mimeType: document.mime_type ?? PDF_MIME_TYPE,
      size: pdfBuffer.length,
    });

    if (!processed.content.trim()) {
      throw new Error("No readable text could be extracted from this PDF.");
    }

    await sendMessage(
      chatId,
      [
        "📖 Document extracted successfully.",
        "",
        `Pages: ${processed.pageCount ?? "Unknown"}`,
        `Characters: ${processed.charCount.toLocaleString()}`,
        "",
        "⏳ Creating your study note...",
      ].join("\n"),
    );

    const note = await createNote(userId, processed, {
      telegramChatId: chatId,
    });

    logger.info("[telegram] note created from PDF", {
      noteId: note.id,
      userId,
      telegramUserId: sender.id,
      fileName,
      fileSize: pdfBuffer.length,
      pageCount: processed.pageCount,
      charCount: processed.charCount,
    });

    await sendMessage(
      chatId,
      [
        "✅ Document uploaded successfully!",
        "",
        `📚 ${note.title}`,
        "",
        "🧠 AI Study Assistant is generating:",
        "",
        "📝 Summary",
        "🧠 Knowledge Concepts",
        "❓ Quiz",
        "🃏 Flashcards",
        "",
        "I will notify you here when generation finishes.",
        "",
        "Open the note directly or return to your dashboard.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "📚 Open Study Note",
              url: buildNoteUrl(note.id),
            },
          ],
          [
            {
              text: "🏠 Open Dashboard",
              url: buildDashboardUrl(),
            },
          ],
        ],
      },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unexpected document processing error";

    logger.error("[telegram] PDF processing failed", {
      userId,
      telegramUserId: sender.id,
      fileName,
      error: errorMessage,
    });

    await sendMessage(
      chatId,
      [
        "❌ Unable to process this document.",
        "",
        errorMessage,
        "",
        "Please check the PDF and try again.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🏠 Open Dashboard",
              url: buildDashboardUrl(),
            },
          ],
        ],
      },
    );
  }
}

// ─── My Files ─────────────────────────────────────────────────────────────────

async function handleMyFiles(message: TelegramMessage): Promise<void> {
  const sender = message.from;

  if (!sender) {
    await sendMessage(
      message.chat.id,
      "❌ Unable to identify your Telegram account.",
    );
    return;
  }

  const integration = await telegramIntegrationRepo.findByTelegramUserId(
    sender.id,
  );

  if (!integration) {
    await sendMessage(
      message.chat.id,
      [
        "🔐 Telegram is not connected.",
        "",
        "Connect your AI Study Assistant account first to view your documents.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🔗 Connect Account",
              url: buildLoginUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  await telegramIntegrationRepo.updateLastActive(sender.id);

  const result = await noteRepo.findManyByUser(integration.userId, {
    page: 1,
    limit: 5,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  if (result.data.length === 0) {
    await sendMessage(
      message.chat.id,
      [
        "📚 My Files",
        "",
        "You have not uploaded any documents yet.",
        "",
        "Send me a PDF to create your first study note.",
      ].join("\n"),
      {
        buttons: [
          [
            {
              text: "🏠 Open Dashboard",
              url: buildDashboardUrl(),
            },
          ],
        ],
      },
    );

    return;
  }

  const fileLines = result.data.flatMap((note, index) => {
    const createdAt = note.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return [
      `${index + 1}. ${note.title}`,
      `   ${note.fileType.toUpperCase()} • ${createdAt}`,
      "",
    ];
  });

  const noteButtons = result.data.map((note) => [
    {
      text: "📖 Open",
      url: buildNoteUrl(note.id),
    },
    {
      text: "📊 Status",
      callback_data: `status:${note.id}`,
    },
    {
      text: "🔄 Retry",
      callback_data: `retry:${note.id}`,
    },
  ]);

  await sendMessage(
    message.chat.id,
    [
      "📚 Your Recent Files",
      "",
      ...fileLines,
      result.total > result.data.length
        ? `Showing ${result.data.length} of ${result.total} documents.`
        : `${result.total} document${result.total === 1 ? "" : "s"} total.`,
    ].join("\n"),
    {
      buttons: [
        ...noteButtons,
        [
          {
            text: "🏠 View All Documents",
            url: buildDashboardUrl(),
          },
        ],
      ],
    },
  );
}

// ─── Text commands ────────────────────────────────────────────────────────────

async function handleText(message: TelegramMessage): Promise<void> {
  const text = message.text?.trim();

  if (!text) {
    return;
  }

  const startCommand = parseStartCommand(text);

  if (startCommand.isStart) {
    if (startCommand.payload) {
      await handleAccountLink(message, startCommand.payload);
      return;
    }

    await handleStart(message);
    return;
  }

  switch (text) {
    case "/help":
      await handleHelp(message);
      return;

    case "/account":
      await handleAccount(message);
      return;

    case "/status":
      await handleGenerationStatus(message);
      return;

    case "/myfiles":
      await handleMyFiles(message);
      return;

    case "/retry":
      await handleRetry(message);
      return;

    default:
      await sendMessage(
        message.chat.id,
        [
          "I did not recognise that command.",
          "",
          "Upload a PDF or use:",
          "/help",
          "/account",
          "/status",
          "/myfiles",
          "/retry",
        ].join("\n"),
      );
  }
}

async function handleCallbackQuery(
  query: TelegramCallbackQuery,
): Promise<void> {
  const message = query.message;
  const data = query.data;

  if (!message || !data) {
    await answerCallbackQuery(query.id, "Action unavailable.");
    return;
  }

  const callback = parseNoteCallback(data);

  if (!callback) {
    await answerCallbackQuery(query.id, "Unknown action.");
    return;
  }

  const integration = await telegramIntegrationRepo.findByTelegramUserId(
    query.from.id,
  );

  if (!integration) {
    await answerCallbackQuery(query.id, "Connect your account first.");

    await sendMessage(message.chat.id, "🔐 Telegram is not connected.");

    return;
  }

  await telegramIntegrationRepo.updateLastActive(query.from.id);

  // Stop Telegram's button-loading animation immediately.
  await answerCallbackQuery(query.id);

  try {
    switch (callback.action) {
      case "status":
        await sendGenerationStatusForNote(
          message.chat.id,
          integration.userId,
          callback.noteId,
        );
        return;

      case "retry":
        await retryGenerationForNote(
          message.chat.id,
          integration.userId,
          callback.noteId,
        );
        return;
    }
  } catch (error) {
    logger.error("[telegram] callback action failed", {
      telegramUserId: query.from.id,
      action: callback.action,
      noteId: callback.noteId,
      error: error instanceof Error ? error.message : String(error),
    });

    await sendMessage(message.chat.id, "❌ Unable to complete that action.");
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function processUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

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