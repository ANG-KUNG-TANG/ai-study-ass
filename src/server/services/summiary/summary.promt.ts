// =============================================================================
// server/services/summary.prompt.ts
//
// Builds the prompt sent to ai.service.generate() for summary generation.
// Kept separate from summary.service.ts so the prompt text can be iterated
// on/tested without touching the persistence/caching logic around it.
// =============================================================================

// Rough token-to-character ratio for English text is ~1:4. Capping input
// characters keeps a single summary request well under typical context
// windows regardless of provider, and keeps AI cost/latency predictable
// for very long uploaded documents (a 200-page PDF shouldn't be sent whole).
const MAX_CONTENT_CHARS = 24_000;

export interface SummaryPromptResult {
  systemPrompt: string;
  prompt: string;
  wasTruncated: boolean;
}

const SYSTEM_PROMPT = `You are a study assistant that summarizes academic and study material for students.
Respond with ONLY a single valid JSON object — no markdown fences, no prose before or after it.
The JSON object must have exactly these keys:
  "summary": a concise 3-6 sentence overview of the material, in plain language.
  "keyPoints": an array of 3-8 short strings, each one key takeaway a student should remember.
  "importantConcepts": an array of 2-6 short strings naming the core concepts/terms introduced.
Do not include any keys other than these three.`;

export function buildSummaryPrompt(noteContent: string): SummaryPromptResult {
  const wasTruncated = noteContent.length > MAX_CONTENT_CHARS;
  const content = wasTruncated ? noteContent.slice(0, MAX_CONTENT_CHARS) : noteContent;

  const prompt = `Summarize the following study material.${
    wasTruncated ? ' (Note: this material was truncated to fit length limits — summarize what is shown.)' : ''
  }

--- MATERIAL START ---
${content}
--- MATERIAL END ---`;

  return { systemPrompt: SYSTEM_PROMPT, prompt, wasTruncated };
}