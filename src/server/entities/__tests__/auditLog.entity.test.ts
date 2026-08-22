import { AUDIT_ACTIONS } from "@/server/entities/auditLog.entity";
import { AuditLog } from "@/server/models/Auditlog";

describe("AuditLog action schema", () => {
  it.each(AUDIT_ACTIONS)("accepts %s", (action) => {
    const doc = new AuditLog({
      _id: `audit-${action}`,
      actorId: null,
      actorEmail: null,
      action,
    });

    expect(doc.validateSync()).toBeUndefined();
  });
});
