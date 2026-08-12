import {
  classifyProviderFailure,
  PDF_OCR_QUOTA_EXHAUSTED_PREFIX,
} from "@/server/utils/provider-error";

describe("provider-error", () => {
  it("detects explicit Gemini quota exhaustion", () => {
    const error = new Error(
      `Gemini vision request failed (429): {
              "error": {
                "code": 429,
                "message": "You exceeded your current quota, please check your plan and billing details."
              }
            }`,
    );

    const result = classifyProviderFailure(error);

    expect(result.kind).toBe("quota-exhausted");

    expect(result.statusCode).toBe(429);

    expect(result.retryable).toBe(false);

    expect(result.preserveUpload).toBe(true);
  });

  it("treats ordinary 429 as retryable rate limiting", () => {
    const result = classifyProviderFailure(
      new Error("Gemini request failed (429): rate limit exceeded"),
    );

    expect(result.kind).toBe("rate-limited");

    expect(result.retryable).toBe(true);

    expect(result.preserveUpload).toBe(true);
  });

  it("treats 503 as transient", () => {
    const result = classifyProviderFailure(
      new Error("Gemini request failed (503): service unavailable"),
    );

    expect(result.kind).toBe("transient");

    expect(result.retryable).toBe(true);
  });

  it("treats timeout as transient", () => {
    const result = classifyProviderFailure(
      new Error("Gemini vision request timed out"),
    );

    expect(result.kind).toBe("transient");

    expect(result.retryable).toBe(true);
  });

  it("recognises wrapped quota errors", () => {
    const result = classifyProviderFailure(
      new Error(`${PDF_OCR_QUOTA_EXHAUSTED_PREFIX}: provider quota exhausted`),
    );

    expect(result.kind).toBe("quota-exhausted");

    expect(result.preserveUpload).toBe(true);
  });

  it("does not classify unrelated errors as provider retry errors", () => {
    const result = classifyProviderFailure(new Error("PDF is corrupted"));

    expect(result.kind).toBe("unknown");

    expect(result.preserveUpload).toBe(false);
  });
});
