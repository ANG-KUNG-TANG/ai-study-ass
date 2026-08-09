import { NextResponse } from "next/server";

import { processUpdate } from "@/server/services/telegram.service";

import type { TelegramUpdate } from "@/server/integrations/telegram/telegram.types";

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
