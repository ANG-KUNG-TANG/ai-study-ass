{ status: 401}import { z, type ZodSchema } from "zod";
import { ValidationError } from "@/server/utils/errors";
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from "@/server/utils/constants";

// ─── validateBody ─────────────────────────────────────────────────────────────
// Parses + validates JSON request body against a Zod schema.
// Returns typed, validated data. Throws ValidationError on failure.
//
// Usage:
//   const data = await validateBody(req, registerSchema)

export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    const fields = Object.fromEntries(
      result.error.issues.map((i) => [i.path.join("."), i.message])
    );
    throw new ValidationError("Validation failed", fields);
  }

  return result.data;
}

// ─── validateQuery ────────────────────────────────────────────────────────────
// Parses + validates URL search params against a Zod schema.
// Coercion (string → number) is handled by the schema itself.
//
// Usage:
//   const query = validateQuery(req, paginationSchema)

export function validateQuery<T>(req: Request, schema: ZodSchema<T>): T {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());

  const result = schema.safeParse(raw);

  if (!result.success) {
    const fields = Object.fromEntries(
      result.error.issues.map((i) => [i.path.join("."), i.message])
    );
    throw new ValidationError("Invalid query parameters", fields);
  }

  return result.data;
}

// ─── Pagination schema ────────────────────────────────────────────────────────
// Reusable across all list endpoints.
// z.coerce handles string → number conversion from URL params automatically.

export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, "Page must be at least 1")
    .default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(MAX_LIMIT, `Limit cannot exceed ${MAX_LIMIT}`)
    .default(DEFAULT_LIMIT),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;