export type ProviderFailureKind =
  | "quota-exhausted"
  | "rate-limited"
  | "transient"
  | "unknown";

export interface ProviderFailureInfo {
  kind: ProviderFailureKind;

  statusCode?: number;

  /**
   * Whether automatic retry makes sense.
   */
  retryable: boolean;

  /**
   * Whether we should keep the original uploaded PDF
   * so the job can be manually retried later.
   */
  preserveUpload: boolean;

  message: string;
}

export const PDF_OCR_QUOTA_EXHAUSTED_PREFIX = "PDF_OCR_QUOTA_EXHAUSTED";

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractStatusCode(message: string): number | undefined {
  const patterns = [
    /\((\d{3})\)/,
    /"code"\s*:\s*(\d{3})/i,
    /status(?:Code)?["'\s:=]+(\d{3})/i,
    /\b(429|500|502|503|504)\b/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (!match) {
      continue;
    }

    const value = Number(match[1]);

    if (Number.isInteger(value)) {
      return value;
    }
  }

  return undefined;
}

function containsQuotaExhaustionLanguage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes(PDF_OCR_QUOTA_EXHAUSTED_PREFIX.toLowerCase()) ||
    normalized.includes("exceeded your current quota") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("quota_exceeded") ||
    normalized.includes("daily quota") ||
    normalized.includes("plan and billing") ||
    normalized.includes("billing details")
  );
}

function containsTimeoutLanguage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("aborterror") ||
    normalized.includes("etimedout") ||
    normalized.includes("econnreset")
  );
}

export function classifyProviderFailure(error: unknown): ProviderFailureInfo {
  const message = errorToMessage(error);

  const statusCode = extractStatusCode(message);

  // ─────────────────────────────────────────────────────────────
  // Explicit quota exhaustion
  //
  // Do NOT burn BullMQ retries.
  // Keep the source PDF for later manual retry.
  // ─────────────────────────────────────────────────────────────

  if (statusCode === 429 && containsQuotaExhaustionLanguage(message)) {
    return {
      kind: "quota-exhausted",

      statusCode,

      retryable: false,

      preserveUpload: true,

      message,
    };
  }

  // Also recognise our own wrapped BullMQ marker.
  if (containsQuotaExhaustionLanguage(message)) {
    return {
      kind: "quota-exhausted",

      statusCode,

      retryable: false,

      preserveUpload: true,

      message,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Temporary 429
  //
  // Could be RPM/TPM/provider throttling.
  // Let BullMQ exponential backoff retry.
  // ─────────────────────────────────────────────────────────────

  if (statusCode === 429) {
    return {
      kind: "rate-limited",

      statusCode,

      retryable: true,

      preserveUpload: true,

      message,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Temporary provider/server failure
  // ─────────────────────────────────────────────────────────────

  if (
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    containsTimeoutLanguage(message)
  ) {
    return {
      kind: "transient",

      statusCode,

      retryable: true,

      preserveUpload: true,

      message,
    };
  }

  return {
    kind: "unknown",

    statusCode,

    retryable: false,

    preserveUpload: false,

    message,
  };
}
