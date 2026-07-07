// =============================================================================
// server/services/summary.service.ts
//
// generateSummary(noteId) is the only export feature routes should call.
// It handles: ownership-agnostic note lookup (the route/controller is
// responsible for checking the note belongs to the requesting user —
// this service just operates on whatever noteId it's given), cache
// short-circuiting, AI generation via ai.service.ts, response parsing/
// validation, and persistence back onto the Note document.
//
// ASSUMPTIONS TO VERIFY (no access to your actual repo/model files):
//   1. note.repository.ts exports `findById(id): Promise<NoteEntity | null>`
//      and something that can persist the summary back — I've called it
//      `updateSummary(id, summary): Promise<NoteEntity>` below. Rename the
//      import/call if your repo uses different names.
//   2. NoteEntity has a `content: string` field (the extracted text) and a
//      `summary: string` field, matching the Note collection design doc.
//   3. NotFoundError is imported from '../utils/errors' — adjust the path
//      to wherever your Week 1 error classes actually live.
// =============================================================================

import { generate } from '@/server/services/ai.service';
import { buildSummaryPrompt } from '@/server/services/summiary/summary.promt';
import { findById, updateSummary } from '@/server/repositories/note.repo';
import { NotFoundError } from '../../utils/errors';

export interface SummaryResult {
  /** The persisted, flattened summary string (what's stored on Note.summary). */
  summary: string;
  /** Structured breakdown — not persisted separately today (see note below),
   *  but returned so the API/UI can render key points and concepts distinctly
   *  without re-parsing the flattened string. */
  keyPoints: string[];
  importantConcepts: string[];
  /** True if this came from Note.summary without calling the AI. */
  cached: boolean;
  tokensUsed: number;
}

interface RawSummaryJSON {
  summary?: unknown;
  keyPoints?: unknown;
  importantConcepts?: unknown;
}

/**
 * Parses and validates the AI's JSON response against the shape
 * summary.prompt.ts's SYSTEM_PROMPT asks for. Throws with a clear message
 * on malformed output rather than silently defaulting to empty arrays,
 * since a malformed response usually means the prompt or model changed
 * and that's worth surfacing during development.
 */
function parseSummaryResponse(rawText: string): {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
} {
  // Defensive: some providers wrap JSON in ```json fences even when asked
  // not to. Strip them before parsing rather than failing on a technicality.
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');

  let parsed: RawSummaryJSON;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`summary.service: AI response was not valid JSON: ${String(err)}`);
  }

  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length === 0) {
    throw new Error('summary.service: AI response missing a non-empty "summary" string.');
  }
  if (!Array.isArray(parsed.keyPoints) || !parsed.keyPoints.every((p) => typeof p === 'string')) {
    throw new Error('summary.service: AI response "keyPoints" must be a string array.');
  }
  if (
    !Array.isArray(parsed.importantConcepts) ||
    !parsed.importantConcepts.every((c) => typeof c === 'string')
  ) {
    throw new Error('summary.service: AI response "importantConcepts" must be a string array.');
  }

  return {
    summary: parsed.summary.trim(),
    keyPoints: parsed.keyPoints,
    importantConcepts: parsed.importantConcepts,
  };
}

/** Flattens the structured summary into the single string Note.summary stores. */
function formatForStorage(parts: {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
}): string {
  const keyPointsBlock = parts.keyPoints.length
    ? `\n\n**Key Points:**\n${parts.keyPoints.map((p) => `- ${p}`).join('\n')}`
    : '';
  const conceptsBlock = parts.importantConcepts.length
    ? `\n\n**Important Concepts:** ${parts.importantConcepts.join(', ')}`
    : '';
  return `${parts.summary}${keyPointsBlock}${conceptsBlock}`;
}

/**
 * Generate (or return the cached) summary for a note.
 *
 * @param noteId  The note to summarize.
 * @param options.force  Regenerate even if Note.summary is already set.
 *                        Default false — cache is checked first, matching
 *                        the "Cache — skip if exists" requirement.
 */
export async function generateSummary(
  noteId: string,
  options: { force?: boolean } = {},
): Promise<SummaryResult> {
  const note = await findById(noteId);
  if (!note) {
    throw new NotFoundError(`Note ${noteId} not found`);
  }

  // ── Cache short-circuit ─────────────────────────────────────────────────
  // Note.summary only stores the flattened string, not the structured
  // keyPoints/importantConcepts arrays (see the Note collection design —
  // it has no fields for them). So a cache hit can return the flattened
  // text but can't reconstruct the original arrays. Returning them empty
  // on a cache hit is the honest answer given the current schema; if the
  // UI needs the structured breakdown to survive a cache hit, Note's
  // schema needs new fields (keyPoints: string[], importantConcepts:
  // string[]) — flagging this as an open question rather than guessing.
  if (!options.force && note.summary && note.summary.trim().length > 0) {
    return {
      summary: note.summary,
      keyPoints: [],
      importantConcepts: [],
      cached: true,
      tokensUsed: 0,
    };
  }

  if (!note.content || note.content.trim().length === 0) {
    throw new Error(`summary.service: Note ${noteId} has no extracted content to summarize.`);
  }

  const { systemPrompt, prompt } = buildSummaryPrompt(note.content);

  const aiResult = await generate({
    prompt,
    systemPrompt,
    jsonMode: true,
    temperature: 0.3, // summaries should be low-variance, not creative
  });

  const structured = parseSummaryResponse(aiResult.text);
  const flattened = formatForStorage(structured);

  await updateSummary(noteId, flattened);

  return {
    summary: flattened,
    keyPoints: structured.keyPoints,
    importantConcepts: structured.importantConcepts,
    cached: false,
    tokensUsed: aiResult.tokensUsed,
  };
}