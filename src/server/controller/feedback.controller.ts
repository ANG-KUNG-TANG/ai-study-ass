import type { NextResponse } from "next/server";

import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as feedbackService from "@/server/services/feedback.service";
import { logActivity } from "@/server/services/auditLog.service";
import { BadRequestError } from "@/server/utils/errors";
import { getClientIp } from "@/server/utils/client-ip";
import {
  createdResponse,
  paginatedResponse,
  successResponse,
} from "@/server/utils/response";
import {
  parseAdminFeedbackQuery,
  parseCreateFeedback,
  parseReviewFeedback,
  parseUserFeedbackQuery,
} from "@/server/validators/feedback.validators";

function requestAuditContext(req: Request, auth: AuthContext) {
  return {
    actorId: auth.userId,
    actorEmail: auth.email,
    actorRole: auth.role,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
    requestId: req.headers.get("x-request-id") ?? undefined,
  };
}

export async function listOwnFeedback(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { limit } = parseUserFeedbackQuery(req);
  return successResponse(
    await feedbackService.listUserFeedback(auth.userId, limit),
  );
}

export async function createFeedback(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const input = await parseCreateFeedback(req);
  const feedback = await feedbackService.createFeedback(
    auth.userId,
    auth.email,
    input,
  );

  await logActivity({
    ...requestAuditContext(req, auth),
    action: "feedback.submitted",
    targetType: "feedback",
    targetId: feedback.id,
    metadata: { type: feedback.type, rating: feedback.rating },
  });

  return createdResponse(feedback, "Feedback submitted");
}

export async function listAllFeedback(
  req: Request,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  const query = parseAdminFeedbackQuery(req);
  const result = await feedbackService.listAdminFeedback(query);
  return paginatedResponse(result.data, result.meta, "Feedback retrieved");
}

export async function reviewFeedback(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!id) throw new BadRequestError("Missing feedback id");

  const input = await parseReviewFeedback(req);
  const feedback = await feedbackService.reviewFeedback(id, auth.userId, input);

  await logActivity({
    ...requestAuditContext(req, auth),
    actorRole: "admin",
    action: "admin.feedback_updated",
    targetType: "feedback",
    targetId: feedback.id,
    metadata: { status: feedback.status, type: feedback.type },
  });

  return successResponse(feedback, { message: "Feedback updated" });
}

export async function exportFeedback(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { page: _page, limit: _limit, ...filters } = parseAdminFeedbackQuery(req);
  const csv = await feedbackService.exportFeedbackCsv(filters);

  await logActivity({
    ...requestAuditContext(req, auth),
    actorRole: "admin",
    action: "admin.feedback_exported",
    targetType: "feedback_export",
    metadata: { filters },
  });

  return successResponse({
    csv,
  });
}
