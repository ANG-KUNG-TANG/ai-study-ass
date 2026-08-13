// src/server/utils/structured-output.ts

export interface StructuredArrayResult<T> {
  items: T[];
  recovered: boolean;
}

function removeMarkdownFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function findBalancedJson(
  source: string,
  open: "{" | "[",
  close: "}" | "]",
): string | null {
  const start = source.indexOf(open);

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === open) {
      depth += 1;
      continue;
    }

    if (char === close) {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function cleanupCommonJsonIssues(value: string): string {
  return (
    value
      // Remove control characters that commonly appear
      // unescaped in provider output.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")

      // Remove trailing commas.
      .replace(/,\s*([}\]])/g, "$1")
  );
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = removeMarkdownFence(raw);

  // First try: provider returned valid JSON.
  try {
    const parsed = JSON.parse(cleaned);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Recovery below.
  }

  // Provider sometimes adds prose around JSON.
  const balanced = findBalancedJson(cleaned, "{", "}");

  if (!balanced) {
    throw new Error(
      "No complete JSON object could be recovered from the AI response.",
    );
  }

  const repaired = cleanupCommonJsonIssues(balanced);

  const parsed = JSON.parse(repaired);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI response did not contain a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

/**
 * Extract complete JSON objects from an array even when
 * the provider truncates the response halfway through
 * the last object.
 */
function recoverObjectArray(raw: string, property: string): unknown[] {
  const cleaned = removeMarkdownFence(raw);

  const keyPatterns = [`"${property}"`, `'${property}'`];

  let keyPosition = -1;

  for (const pattern of keyPatterns) {
    keyPosition = cleaned.indexOf(pattern);

    if (keyPosition >= 0) {
      break;
    }
  }

  if (keyPosition < 0) {
    return [];
  }

  const arrayStart = cleaned.indexOf("[", keyPosition);

  if (arrayStart < 0) {
    return [];
  }

  const results: unknown[] = [];

  let objectStart = -1;

  let depth = 0;

  let inString = false;

  let escaped = false;

  for (let index = arrayStart + 1; index < cleaned.length; index += 1) {
    const char = cleaned[index];

    if (inString) {
      if (escaped) {
        escaped = false;

        continue;
      }

      if (char === "\\") {
        escaped = true;

        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;

      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        objectStart = index;
      }

      depth += 1;

      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }

      depth -= 1;

      if (depth === 0 && objectStart >= 0) {
        const candidate = cleaned.slice(objectStart, index + 1);

        try {
          results.push(JSON.parse(cleanupCommonJsonIssues(candidate)));
        } catch {
          // One malformed item should not destroy
          // previously recovered valid objects.
        }

        objectStart = -1;
      }
    }
  }

  return results;
}

export function parseStructuredArray<T>(
  raw: string,

  property: string,

  validator: (value: unknown) => T | null,
): StructuredArrayResult<T> {
  let rawItems: unknown[] = [];

  let recovered = false;

  try {
    const parsed = parseJsonObject(raw);

    const value = parsed[property];

    if (Array.isArray(value)) {
      rawItems = value;
    }
  } catch {
    rawItems = recoverObjectArray(raw, property);

    recovered = true;
  }

  const items = rawItems
    .map(validator)
    .filter((item): item is T => item !== null);

  return {
    items,
    recovered,
  };
}
