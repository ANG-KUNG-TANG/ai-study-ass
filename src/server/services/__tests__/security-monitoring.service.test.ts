import {
  AuditLogEntity,
  type AuditAction,
} from "@/server/entities/auditLog.entity";
import { detectSecuritySignals } from "@/server/services/security-monitoring.service";

function event(
  action: AuditAction,
  overrides: Partial<{
    actorId: string | null;
    actorEmail: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }> = {},
): AuditLogEntity {
  return AuditLogEntity.fromPersistence({
    id: crypto.randomUUID(),
    actorId: overrides.actorId ?? null,
    actorEmail: overrides.actorEmail ?? null,
    action,
    metadata: overrides.metadata,
    createdAt: overrides.createdAt ?? new Date(),
  });
}

describe("security monitoring detector", () => {
  it("marks refresh-token reuse as critical", () => {
    const signals = detectSecuritySignals([
      event("auth.refresh_reuse_detected", {
        actorId: "user-1",
        actorEmail: "user@example.com",
      }),
    ]);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      type: "refresh_token_reuse",
      severity: "critical",
      actorId: "user-1",
    });
  });

  it("detects repeated failed logins at the threshold", () => {
    const events = Array.from({ length: 5 }, () =>
      event("auth.login_failed", {
        actorEmail: "user@example.com",
      }),
    );

    const signals = detectSecuritySignals(events);

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "repeated_failed_login",
          severity: "high",
          count: 5,
          actorEmail: "user@example.com",
        }),
      ]),
    );
  });

  it("does not alert below the failed-login threshold", () => {
    const events = Array.from({ length: 4 }, () =>
      event("auth.login_failed", {
        actorEmail: "user@example.com",
      }),
    );

    expect(detectSecuritySignals(events)).toEqual([]);
  });

  it("detects repeated rate-limit violations by IP", () => {
    const events = Array.from({ length: 3 }, () =>
      event("rate_limit.hit", {
        metadata: {
          ip: "203.0.113.10",
          route: "/api/auth/login",
        },
      }),
    );

    const signals = detectSecuritySignals(events);

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "rate_limit_abuse",
          severity: "high",
          count: 3,
          ip: "203.0.113.10",
        }),
      ]),
    );
  });

  it("classifies role changes and user deletions as high-impact admin actions", () => {
    const signals = detectSecuritySignals([
      event("admin.role_changed", {
        actorId: "admin-1",
      }),
      event("admin.user_deleted", {
        actorId: "admin-1",
      }),
    ]);

    expect(
      signals.filter(
        (signal) =>
          signal.type === "sensitive_admin_action" &&
          signal.severity === "high",
      ),
    ).toHaveLength(2);
  });
});
