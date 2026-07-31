// server/entities/auditLog.entity.ts
// Immutable record of something that happened in the system — powers the
// admin "Recent activity" feed. Write-once, read-only: no update/delete.

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.register"
  | "note.uploaded"
  | "note.deleted"
  | "quiz.generated"
  | "flashcards.generated"
  | "summary.generated"
  | "rate_limit.hit"
  | "admin.role_changed"
  | "admin.user_banned"
  | "admin.user_unbanned"
  | "admin.user_deleted";

export interface AuditLogProps {
  id: string;
  actorId: string | null;     // null for unauthenticated/system events
  actorEmail: string | null;  // denormalized snapshot — stays readable even
                               // if the actor's account is later deleted
  action: AuditAction;
  targetType?: string;        // e.g. "note", "user", "quiz"
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export class AuditLogEntity {
  constructor(
    public readonly id: string,
    public readonly actorId: string | null,
    public readonly actorEmail: string | null,
    public readonly action: AuditAction,
    public readonly targetType: string | undefined,
    public readonly targetId: string | undefined,
    public readonly metadata: Record<string, unknown> | undefined,
    public readonly createdAt: Date
  ) {}

  static fromPersistence(props: AuditLogProps): AuditLogEntity {
    return new AuditLogEntity(
      props.id,
      props.actorId,
      props.actorEmail,
      props.action,
      props.targetType,
      props.targetId,
      props.metadata,
      props.createdAt
    );
  }

  /** Human-readable line for the admin feed, e.g.
   *  "maria.santos@upenn.edu uploaded a new note" */
  describe(): string {
    const who = this.actorEmail ?? "System";
    switch (this.action) {
      case "auth.login": return `${who} logged in`;
      case "auth.logout": return `${who} logged out`;
      case "auth.register": return `${who} registered an account`;
      case "note.uploaded": return `${who} uploaded a new note`;
      case "note.deleted": return `${who} deleted a note`;
      case "quiz.generated": return `${who} generated a quiz`;
      case "flashcards.generated": {
        const count = this.metadata?.cardCount;
        return `${who} generated a flashcard deck${count ? ` (${count} cards)` : ""}`;
      }
      case "summary.generated": return `${who} generated a summary`;
      case "rate_limit.hit": {
        const route = this.metadata?.route ?? "an endpoint";
        const ip = this.metadata?.ip ?? "unknown IP";
        return `Rate limit hit on ${route} from IP ${ip}`;
      }
      case "admin.role_changed": return `${who}'s role was changed`;
      case "admin.user_banned": return `${who} was banned`;
      case "admin.user_unbanned": return `${who} was unbanned`;
      case "admin.user_deleted": return `${who}'s account was deleted`;
      default: return `${who} performed ${this.action}`;
    }
  }
}