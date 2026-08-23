import type { AuditLogEntity } from "@/server/entities/auditLog.entity";
import * as auditLogRepo from "@/server/repositories/auditLog.repo";

export type SecuritySeverity = "medium" | "high" | "critical";

export type SecuritySignalType =
  | "refresh_token_reuse"
  | "repeated_failed_login"
  | "rate_limit_abuse"
  | "sensitive_admin_action";

export interface SecuritySignal {
  type: SecuritySignalType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  count: number;
  actorId?: string;
  actorEmail?: string;
  ip?: string;
  firstSeen: Date;
  lastSeen: Date;
}

export interface SecurityReport {
  windowMinutes: number;
  generatedAt: Date;
  scannedEvents: number;
  summary: {
    medium: number;
    high: number;
    critical: number;
  };
  signals: SecuritySignal[];
}

const FAILED_LOGIN_THRESHOLD = 5;
const RATE_LIMIT_HIT_THRESHOLD = 3;

function severityRank(severity: SecuritySeverity): number {
  switch (severity) {
    case "critical":
      return 3;
    case "high":
      return 2;
    case "medium":
      return 1;
  }
}

function stringMetadata(
  event: AuditLogEntity,
  key: string,
): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function pushGroupedSignal(
  signals: SecuritySignal[],
  events: AuditLogEntity[],
  input: Omit<
    SecuritySignal,
    "count" | "firstSeen" | "lastSeen"
  >,
): void {
  if (events.length === 0) return;

  const timestamps = events
    .map((event) => event.createdAt.getTime())
    .sort((a, b) => a - b);

  signals.push({
    ...input,
    count: events.length,
    firstSeen: new Date(timestamps[0]),
    lastSeen: new Date(timestamps[timestamps.length - 1]),
  });
}

export function detectSecuritySignals(
  events: AuditLogEntity[],
): SecuritySignal[] {
  const signals: SecuritySignal[] = [];

  for (const event of events) {
    if (event.action === "auth.refresh_reuse_detected") {
      signals.push({
        type: "refresh_token_reuse",
        severity: "critical",
        title: "Refresh-token reuse detected",
        description:
          "A stale or concurrently reused refresh token was detected and sessions were revoked.",
        count: 1,
        ...(event.actorId ? { actorId: event.actorId } : {}),
        ...(event.actorEmail
          ? { actorEmail: event.actorEmail }
          : {}),
        firstSeen: event.createdAt,
        lastSeen: event.createdAt,
      });
    }

    if (
      event.action === "admin.role_changed" ||
      event.action === "admin.user_deleted" ||
      event.action === "admin.user_banned" ||
      event.action === "admin.user_unbanned"
    ) {
      const highRisk =
        event.action === "admin.role_changed" ||
        event.action === "admin.user_deleted";

      signals.push({
        type: "sensitive_admin_action",
        severity: highRisk ? "high" : "medium",
        title: highRisk
          ? "High-impact admin action"
          : "Sensitive admin action",
        description: `Administrative action recorded: ${event.action}.`,
        count: 1,
        ...(event.actorId ? { actorId: event.actorId } : {}),
        ...(event.actorEmail
          ? { actorEmail: event.actorEmail }
          : {}),
        firstSeen: event.createdAt,
        lastSeen: event.createdAt,
      });
    }
  }

  const failedByIdentity = new Map<string, AuditLogEntity[]>();

  for (const event of events) {
    if (event.action !== "auth.login_failed") continue;

    const identity =
      event.actorId ??
      event.actorEmail?.trim().toLowerCase();

    if (!identity) continue;

    const bucket = failedByIdentity.get(identity) ?? [];
    bucket.push(event);
    failedByIdentity.set(identity, bucket);
  }

  for (const [identity, failedEvents] of failedByIdentity) {
    if (failedEvents.length < FAILED_LOGIN_THRESHOLD) continue;

    const first = failedEvents[0];

    pushGroupedSignal(signals, failedEvents, {
      type: "repeated_failed_login",
      severity: "high",
      title: "Repeated failed login attempts",
      description:
        `${failedEvents.length} failed login attempts were recorded for the same account identity.`,
      ...(first.actorId
        ? { actorId: first.actorId }
        : {}),
      ...(first.actorEmail
        ? { actorEmail: first.actorEmail }
        : identity.includes("@")
          ? { actorEmail: identity }
          : {}),
    });
  }

  const rateLimitsByIp = new Map<string, AuditLogEntity[]>();

  for (const event of events) {
    if (event.action !== "rate_limit.hit") continue;

    const ip = stringMetadata(event, "ip");
    if (!ip) continue;

    const bucket = rateLimitsByIp.get(ip) ?? [];
    bucket.push(event);
    rateLimitsByIp.set(ip, bucket);
  }

  for (const [ip, rateLimitEvents] of rateLimitsByIp) {
    if (rateLimitEvents.length < RATE_LIMIT_HIT_THRESHOLD) {
      continue;
    }

    pushGroupedSignal(signals, rateLimitEvents, {
      type: "rate_limit_abuse",
      severity: "high",
      title: "Repeated rate-limit violations",
      description:
        `${rateLimitEvents.length} rate-limit violations were recorded from the same client identity.`,
      ip,
    });
  }

  return signals.sort((a, b) => {
    const severityDifference =
      severityRank(b.severity) - severityRank(a.severity);

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return b.lastSeen.getTime() - a.lastSeen.getTime();
  });
}

export async function getSecurityReport(
  windowMinutes: number = 15,
): Promise<SecurityReport> {
  const safeWindowMinutes = Math.min(
    1_440,
    Math.max(5, Math.floor(windowMinutes)),
  );

  const generatedAt = new Date();
  const since = new Date(
    generatedAt.getTime() - safeWindowMinutes * 60_000,
  );

  const events = await auditLogRepo.findSince(since);
  const signals = detectSecuritySignals(events);

  return {
    windowMinutes: safeWindowMinutes,
    generatedAt,
    scannedEvents: events.length,
    summary: {
      medium: signals.filter(
        (signal) => signal.severity === "medium",
      ).length,
      high: signals.filter(
        (signal) => signal.severity === "high",
      ).length,
      critical: signals.filter(
        (signal) => signal.severity === "critical",
      ).length,
    },
    signals,
  };
}
