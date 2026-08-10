import { NextResponse } from "next/server";

import { processUpdate } from "@/server/services/telegram.service";

import type { TelegramUpdate } from "@/server/integrations/telegram/telegram.types";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as telegramLinkService from "@/server/services/telegramLink.service";  

export async function webhook(req: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET is not configured");
  }

  const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");

  if (receivedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized webhook request",
      },
      {
        status: 401,
      },
    );
  }

  const update = (await req.json()) as TelegramUpdate;

  await processUpdate(update);

  return NextResponse.json(
    {
      success: true,
    },
    {
      status: 200,
    },
  );
}

// ─── Create Link ──────────────────────────────────────────────────────────────

export async function createLink(
  _req: Request,
  _context: RouteContext,
  auth: AuthContext,
) {
  const result = await telegramLinkService.generateTelegramLink(auth.userId);

  return NextResponse.json({
    success: true,
    data: result,
  });
}

// ─── Status ───────────────────────────────────────────────────────────────────

export async function getStatus(
  _req: Request,
  _context: RouteContext,
  auth: AuthContext,
) {
  const result = await telegramLinkService.getTelegramStatus(auth.userId);

  return NextResponse.json({
    success: true,
    data: result,
  });
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnect(
  _req: Request,
  _context: RouteContext,
  auth: AuthContext,
) {
  const result = await telegramLinkService.unlinkTelegram(auth.userId);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
