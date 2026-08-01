import { z } from "zod";
import { NextResponse } from "next/server";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import {
  successResponse,
  createdResponse,
  noContentResponse,
} from "@/server/utils/response";
import {
  deleteQuiz,
  generateQuiz,
  getAllQuizzesByNote,
  getAllQuizzesByUser,
} from "@/server/services/quiz/quiz.service";
import {
  findById as findQuizById,
} from "@/server/repositories/quiz.repo";
import {
  findById as findNoteById,
} from "@/server/repositories/note.repo";
import {
  QUESTION_TYPES,
} from "@/server/entities/quiz.entity";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/server/utils/errors";
import {
  isValidObjectId,
} from "mongoose";
import {
  logActivity,
} from "@/server/services/auditLog.service";

const generateBodySchema = z.object({
  noteId: z.string().min(1),

  questionCount: z
    .number()
    .int()
    .positive()
    .optional(),

  questionTypes: z
    .array(z.enum(QUESTION_TYPES))
    .optional(),

  dropInvalidQuestions:
    z.boolean().optional(),

  // Without this field Zod strips `force` and the service returns a cached
  // legacy quiz instead of replacing it.
  force: z.boolean().optional(),
});

async function getNoteIdFromContext(
  context: RouteContext,
): Promise<string> {
  const params = await context.params;

  const noteId =
    params.noteId ??
    params.noteid ??
    params.id;

  if (!noteId) {
    throw new BadRequestError(
      "Missing note id in route parameters",
    );
  }

  return noteId;
}

async function assertOwnsNote(
  noteId: string,
  userId: string,
): Promise<void> {
  const note = await findNoteById(noteId);

  if (!note) {
    throw new NotFoundError(
      `Note ${noteId} not found`,
    );
  }

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError(
      "You do not have access to this note.",
    );
  }
}

export async function generateQuizController(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const input = generateBodySchema.parse(
    await req.json(),
  );

  await assertOwnsNote(
    input.noteId,
    auth.userId,
  );

  const quiz = await generateQuiz(
    input.noteId,
    auth.userId,
    {
      questionCount:
        input.questionCount,
      questionTypes:
        input.questionTypes,
      dropInvalidQuestions:
        input.dropInvalidQuestions,
      force: input.force,
    },
  );

  void logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "quiz.generated",
    targetType: "note",
    targetId: input.noteId,
    metadata: {
      questionCount:
        quiz.toJSON().questions.length,
      forced:
        input.force ?? false,
    },
  });

  return createdResponse(
    quiz.toJSON(),
  );
}

export async function getQuizController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!id || !isValidObjectId(id)) {
    throw new NotFoundError("Quiz");
  }

  const quiz = await findQuizById(id);

  if (!quiz) {
    throw new NotFoundError(
      `Quiz ${id} not found`,
    );
  }

  if (quiz.userId !== auth.userId) {
    throw new ForbiddenError(
      "You do not have access to this quiz.",
    );
  }

  return successResponse(
    quiz.toJSON(),
  );
}

export async function listQuizzesByNoteController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId =
    await getNoteIdFromContext(context);

  await assertOwnsNote(
    noteId,
    auth.userId,
  );

  const quizzes =
    await getAllQuizzesByNote(
      noteId,
      auth.userId,
    );

  return successResponse(
    quizzes.map((quiz) =>
      quiz.toJSON(),
    ),
  );
}

export async function listAllQuizzesController(
  _req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const quizzes =
    await getAllQuizzesByUser(
      auth.userId,
    );

  return successResponse(
    quizzes.map((quiz: any) =>
      quiz.toJSON(),
    ),
  );
}

export async function deleteQuizController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!id) {
    throw new BadRequestError(
      "Missing quiz id",
    );
  }

  await deleteQuiz(
    id,
    auth.userId,
  );

  return noContentResponse();
}
