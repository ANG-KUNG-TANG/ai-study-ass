// =============================================================================
// server/validators/note.validators.ts
//
// Runtime validation for GET /api/notes query params — this was previously
// missing entirely; note.controller.ts's parseNoteQuery() did unchecked
// Number()/type-cast coercion instead, letting invalid values (NaN pages,
// arbitrary fileType/sortBy strings) reach note.repo.ts before failing.
// =============================================================================

import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@/server/utils/constants';

// z.coerce.number() on an empty/missing search param yields NaN, so each
// field is optional at the string level and only coerced+defaulted when
// actually present — this is what makes ?page=abc fail validation with a
// clear message instead of becoming NaN silently.
export const noteQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? DEFAULT_PAGE : Number(v)))
    .pipe(z.number({ error: 'page must be a number' }).int('page must be an integer').positive('page must be positive')),

  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? DEFAULT_LIMIT : Number(v)))
    .pipe(
      z
        .number({ error: 'limit must be a number' })
        .int('limit must be an integer')
        .positive('limit must be positive')
        .max(MAX_LIMIT, `limit cannot exceed ${MAX_LIMIT}`),
    ),

  search: z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : undefined;
    }),

  fileType: z.enum(['pdf', 'docx'], { error: 'fileType must be "pdf" or "docx"' }).optional(),

  sortBy: z.enum(['createdAt', 'title', 'fileSize'], { error: 'invalid sortBy value' }).optional(),

  sortOrder: z.enum(['asc', 'desc'], { error: 'sortOrder must be "asc" or "desc"' }).optional(),
});

export type NoteQueryInput = z.infer<typeof noteQuerySchema>;

/**
 * Parses+validates a Request's query string against noteQuerySchema.
 * Throws a ZodError on any invalid value — your error-handler middleware
 * already documents mapping ZodError → 422, so this surfaces as a clear
 * "field: message" response instead of an opaque failure three layers
 * down in the repository.
 */
export function parseNoteQuery(req: Request): NoteQueryInput {
  const params = new URL(req.url).searchParams;
  return noteQuerySchema.parse({
    page: params.get('page') ?? undefined,
    limit: params.get('limit') ?? undefined,
    search: params.get('search') ?? undefined,
    fileType: params.get('fileType') ?? undefined,
    sortBy: params.get('sortBy') ?? undefined,
    sortOrder: params.get('sortOrder') ?? undefined,
  });
}