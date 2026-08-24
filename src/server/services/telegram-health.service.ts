import {
  getMe,
  getWebhookInfo,
} from "@/server/integrations/telegram/telegram.client";
import { logger } from "@/server/utils/logger";

const TELEGRAM_HEALTH_CACHE_MS = 30_000;

export interface TelegramHealthSnapshot {
  configured: boolean;
  reachable: boolean;
  bot: {
    id: number | null;
    username: string | null;
    displayName: string | null;
  };
  webhook: {
    configured: boolean;
    secretConfigured: boolean;
    matchesExpectedUrl: boolean | null;
    url: string | null;
    expectedUrl: string | null;
    pendingUpdates: number | null;
    lastErrorAt: string | null;
    lastErrorMessage: string | null;
  };
  checkedAt: string;
}

type TelegramHealthCache = {
  value: TelegramHealthSnapshot;
  expiresAt: number;
};

type TelegramHealthGlobal = typeof globalThis & {
  __telegramHealthCache?: TelegramHealthCache;
  __telegramHealthPromise?: Promise<TelegramHealthSnapshot>;
};

const healthGlobal = globalThis as TelegramHealthGlobal;

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function expectedWebhookUrl(): string | null {
  const publicUrl = process.env.APP_PUBLIC_URL?.trim();

  if (!publicUrl) {
    return null;
  }

  return `${normalizeUrl(publicUrl)}/api/telegram/webhook`;
}

function unixToIso(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1_000).toISOString();
}

function unavailableSnapshot(): TelegramHealthSnapshot {
  return {
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
    reachable: false,
    bot: {
      id: null,
      username: null,
      displayName: null,
    },
    webhook: {
      configured: false,
      secretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
      matchesExpectedUrl: null,
      url: null,
      expectedUrl: expectedWebhookUrl(),
      pendingUpdates: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
    checkedAt: new Date().toISOString(),
  };
}

async function loadTelegramHealth(): Promise<TelegramHealthSnapshot> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    return unavailableSnapshot();
  }

  try {
    const [bot, webhook] = await Promise.all([getMe(), getWebhookInfo()]);

    const expectedUrl = expectedWebhookUrl();
    const actualUrl = webhook.url?.trim() || null;

    const matchesExpectedUrl =
      expectedUrl && actualUrl
        ? normalizeUrl(actualUrl) === normalizeUrl(expectedUrl)
        : expectedUrl
          ? false
          : null;

    const displayName =
      [bot.first_name, bot.last_name].filter(Boolean).join(" ").trim() || null;

    return {
      configured: true,
      reachable: true,
      bot: {
        id: bot.id,
        username: bot.username ?? null,
        displayName,
      },
      webhook: {
        configured: Boolean(actualUrl),
        secretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
        matchesExpectedUrl,
        url: actualUrl,
        expectedUrl,
        pendingUpdates: webhook.pending_update_count,
        lastErrorAt: unixToIso(webhook.last_error_date),
        lastErrorMessage: webhook.last_error_message ?? null,
      },
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("[health] Telegram health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return unavailableSnapshot();
  }
}

export async function getTelegramHealth(): Promise<TelegramHealthSnapshot> {
  const cached = healthGlobal.__telegramHealthCache;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (healthGlobal.__telegramHealthPromise) {
    return healthGlobal.__telegramHealthPromise;
  }

  healthGlobal.__telegramHealthPromise = loadTelegramHealth()
    .then((value) => {
      healthGlobal.__telegramHealthCache = {
        value,
        expiresAt: Date.now() + TELEGRAM_HEALTH_CACHE_MS,
      };

      return value;
    })
    .finally(() => {
      healthGlobal.__telegramHealthPromise = undefined;
    });

  return healthGlobal.__telegramHealthPromise;
}
