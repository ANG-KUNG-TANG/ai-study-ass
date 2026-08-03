import type { ReliableDocumentProfile } from "@/server/intelligence/reliability/types";

const MAX_CONTENT_CHARS = 30_000;

export interface SummaryPromptInput {
  content: string;
  profile: ReliableDocumentProfile | null;
  symbolicDraft: string;
}

export interface SummaryPromptResult {
  systemPrompt: string;
  prompt: string;
  wasTruncated: boolean;
}

const SYSTEM_PROMPT = `You are the evidence-grounded fallback for a symbolic study-intelligence engine.
Return ONLY one valid JSON object and no markdown fences.

Required keys:
- "overview": 3-7 clear sentences grounded in the supplied source.
- "keyPoints": 3-10 short, evidence-grounded strings.
- "importantConcepts": 3-12 meaningful technical concepts, never pronouns or sentence fragments.
- "keyTerms": an array of objects {"term": string, "definition": string}; include only definitions supported by the source.
- "unresolvedAssumptions": an array of ambiguities or missing assumptions explicitly visible in the source.

Rules:
- Do not invent figures, actors, methods, datasets, assumptions or conclusions.
- Preserve exact numerical values and units.
- Do not use corrupted text, headers, footers, publication boilerplate or reference-list entries.
- Reject weak terms such as "this", "these costs", "she", "future" or "per year".
- Do not repeat concepts under different names.
- The symbolic profile is authoritative for extracted numbers and classifications.
- AI may clarify or connect supported facts, but must not replace deterministic numerical evidence.`;

export function buildSummaryPrompt(
  input: string | SummaryPromptInput,
): SummaryPromptResult {
  const normalized: SummaryPromptInput = typeof input === "string"
    ? { content: input, profile: null, symbolicDraft: "" }
    : input;
  const wasTruncated = normalized.content.length > MAX_CONTENT_CHARS;
  const content = wasTruncated
    ? normalized.content.slice(0, MAX_CONTENT_CHARS)
    : normalized.content;
  const profilePayload = normalized.profile
    ? JSON.stringify(
        {
          title: normalized.profile.title,
          classification: normalized.profile.classification,
          qualityScore: normalized.profile.qualityScore,
          missingCoverage: normalized.profile.coverage.missingFields,
          concepts: normalized.profile.concepts.map((concept) => concept.term),
          financialInputs: normalized.profile.caseStudy?.financialInputs,
          scenarios: normalized.profile.caseStudy?.scenarios,
          unresolvedAssumptions: normalized.profile.caseStudy?.unresolvedAssumptions,
        },
        null,
        2,
      )
    : "No reliable symbolic profile was available.";

  const prompt = `Improve only the weak or missing parts of the symbolic study notes.

DOCUMENT PROFILE:
${profilePayload}

SYMBOLIC DRAFT:
${normalized.symbolicDraft.slice(0, 16_000)}

SOURCE MATERIAL${wasTruncated ? " (truncated evenly by the caller's limit)" : ""}:
--- MATERIAL START ---
${content}
--- MATERIAL END ---`;

  return {
    systemPrompt: SYSTEM_PROMPT,
    prompt,
    wasTruncated,
  };
}
