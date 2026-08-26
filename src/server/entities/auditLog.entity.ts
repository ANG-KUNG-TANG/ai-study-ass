// server/entities/auditLog.entity.ts
// Immutable record of something that happened in the system — powers the
// admin activity feed. Entries are write-once and only removed by retention.

export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "auth.register",
  "auth.email_verified",
  "auth.password_changed",
  "auth.password_reset",
  "auth.sessions_revoked",
  "auth.refresh_reuse_detected",
  "note.uploaded",
  "note.deleted",
  "quiz.generated",
  "flashcards.generated",
  "summary.generated",
  "feedback.submitted",
  "user.profile_updated",
  "user.account_deleted",
  "rate_limit.hit",
  "admin.role_changed",
  "admin.user_banned",
  "admin.user_unbanned",
  "admin.user_deleted",
  "admin.sessions_revoked",
  "admin.content_retried",
  "admin.content_cancelled",
  "admin.content_quarantined",
  "admin.content_restored",
  "admin.ai_policy_changed",
  "admin.settings_changed",
  "admin.retention_executed",
  "admin.provider_tested",
  "admin.feedback_updated",
  "admin.feedback_exported",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_CATEGORIES = [
  "authentication",
  "user",
  "content",
  "ai",
  "security",
  "settings",
  "system",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditStatus = "success" | "failure";
export type AuditActorRole = "user" | "admin" | "system";

export function categoryForAuditAction(action: AuditAction): AuditCategory {
  if (action.startsWith("auth.")) return "authentication";
  if (action === "rate_limit.hit") return "security";
  if (action.startsWith("admin.settings") || action.startsWith("admin.retention")) {
    return "settings";
  }
  if (action.startsWith("admin.ai") || action.startsWith("admin.provider")) {
    return "ai";
  }
  if (
    action.startsWith("note.") ||
    action.startsWith("quiz.") ||
    action.startsWith("flashcards.") ||
    action.startsWith("summary.") ||
    action.startsWith("admin.content")
  ) {
    return "content";
  }
  if (
    action.startsWith("user.") ||
    action.startsWith("feedback.") ||
    action.startsWith("admin.user") ||
    action.startsWith("admin.feedback") ||
    action === "admin.role_changed" ||
    action === "admin.sessions_revoked"
  ) {
    return "user";
  }
  return "system";
}

export interface AuditLogProps {
  id: string;
  actorId: string | null;     // null for unauthenticated/system events
  actorEmail: string | null;  // denormalized snapshot — stays readable even
                               // if the actor's account is later deleted
  actorRole?: AuditActorRole;
  action: AuditAction;
  category?: AuditCategory;
  status?: AuditStatus;
  targetType?: string;        // e.g. "note", "user", "quiz"
  targetId?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: Date;
}

export class AuditLogEntity {
  constructor(
    public readonly id: string,
    public readonly actorId: string | null,
    public readonly actorEmail: string | null,
    public readonly actorRole: AuditActorRole,
    public readonly action: AuditAction,
    public readonly category: AuditCategory,
    public readonly status: AuditStatus,
    public readonly targetType: string | undefined,
    public readonly targetId: string | undefined,
    public readonly metadata: Record<string, unknown> | undefined,
    public readonly reason: string | undefined,
    public readonly ipAddress: string | undefined,
    public readonly userAgent: string | undefined,
    public readonly requestId: string | undefined,
    public readonly createdAt: Date
  ) {}

  static fromPersistence(props: AuditLogProps): AuditLogEntity {
    return new AuditLogEntity(
      props.id,
      props.actorId,
      props.actorEmail,
      props.actorRole ?? (props.actorId ? "user" : "system"),
      props.action,
      props.category ?? categoryForAuditAction(props.action),
      props.status ?? "success",
      props.targetType,
      props.targetId,
      props.metadata,
      props.reason,
      props.ipAddress,
      props.userAgent,
      props.requestId,
      props.createdAt
    );
  }

  /** Human-readable line for the admin feed, e.g.
   *  "maria.santos@upenn.edu uploaded a new note" */
  describe(): string {
    const who = this.actorEmail ?? "System";
    switch (this.action) {
      case "auth.login": return `${who} logged in`;
      case "auth.login_failed": return `Failed login attempt for ${who}`;
      case "auth.logout": return `${who} logged out`;
      case "auth.register": return `${who} registered an account`;
      case "auth.email_verified": return `${who} verified their email`;
      case "auth.password_changed": return `${who} changed their password`;
      case "auth.password_reset": return `${who} reset their password`;
      case "auth.sessions_revoked": return `${who} signed out all sessions`;
      case "auth.refresh_reuse_detected": return `Refresh-token reuse detected for ${who}`;
      case "note.uploaded": return `${who} uploaded a new note`;
      case "note.deleted": return `${who} deleted a note`;
      case "quiz.generated": return `${who} generated a quiz`;
      case "flashcards.generated": {
        const count = this.metadata?.cardCount;
        return `${who} generated a flashcard deck${count ? ` (${count} cards)` : ""}`;
      }
      case "summary.generated": return `${who} generated a summary`;
      case "feedback.submitted": return `${who} submitted product feedback`;
      case "user.profile_updated": return `${who} updated their profile`;
      case "user.account_deleted": return `${who} deleted their account`;
      case "rate_limit.hit": {
        const route = this.metadata?.route ?? "an endpoint";
        const ip = this.metadata?.ip ?? "unknown IP";
        return `Rate limit hit on ${route} from IP ${ip}`;
      }
      case "admin.role_changed": {
        const target = this.metadata?.targetEmail ?? this.targetId ?? "a user";
        const role = this.metadata?.newRole ?? "another role";
        return `${who} changed ${target} to ${role}`;
      }
      case "admin.user_banned": {
        const target = this.metadata?.targetEmail ?? this.targetId ?? "a user";
        return `${who} banned ${target}`;
      }
      case "admin.user_unbanned": {
        const target = this.metadata?.targetEmail ?? this.targetId ?? "a user";
        return `${who} restored ${target}`;
      }
      case "admin.user_deleted": {
        const target = this.metadata?.targetEmail ?? this.targetId ?? "a user";
        return `${who} deleted ${target}`;
      }
      case "admin.sessions_revoked": return `${who} revoked a user's sessions`;
      case "admin.content_retried": return `${who} retried content processing`;
      case "admin.content_cancelled": return `${who} cancelled content processing`;
      case "admin.content_quarantined": return `${who} quarantined uploaded content`;
      case "admin.content_restored": return `${who} restored quarantined content`;
      case "admin.ai_policy_changed": return `${who} changed a user's AI policy`;
      case "admin.settings_changed": return `${who} changed operational settings`;
      case "admin.retention_executed": return `${who} executed the retention policy`;
      case "admin.provider_tested": return `${who} tested the AI provider`;
      case "admin.feedback_updated": return `${who} updated a feedback submission`;
      case "admin.feedback_exported": return `${who} exported user feedback`;
      default: return `${who} performed ${this.action}`;
    }
  }
}
