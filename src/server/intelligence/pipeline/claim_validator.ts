import type {
  ClaimType,
  ExtractedClaim,
  FieldState,
  KnowledgeCore,
  KeyPoint,
  ValidationIssue,
  ValidationReport,
} from "../types";

export function validateKnowledge(core: KnowledgeCore): KnowledgeCore {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();
  const validClaims: ExtractedClaim[] = [];
  const rejectedClaims: ExtractedClaim[] = [];

  for (const claim of core.claims) {
    const messages: string[] = [];
    const evidenceText = claim.evidence.map((evidence) => evidence.text).join(" ");

    if (claim.evidence.length === 0 || !evidenceText.trim()) {
      messages.push("Claim has no supporting evidence.");
      issues.push({ code: "missing_evidence", severity: "error", message: messages.at(-1)!, claimId: claim.id });
    }

    if (claim.numericValue !== undefined && !containsNumber(evidenceText, claim.numericValue)) {
      messages.push(`Numeric value ${claim.numericValue} is not present in its evidence.`);
      issues.push({ code: "unsupported_number", severity: "error", message: messages.at(-1)!, claimId: claim.id });
    }

    if (claim.metric && !metricIsSupported(claim.metric, evidenceText)) {
      messages.push(`Metric '${claim.metric}' is not supported by the evidence wording.`);
      issues.push({ code: "metric_mismatch", severity: "error", message: messages.at(-1)!, claimId: claim.id });
    }

    const duplicateKey = `${claim.type}:${normalise(claim.object)}`;
    if (seen.has(duplicateKey)) {
      messages.push(`Duplicate of claim ${seen.get(duplicateKey)}.`);
      issues.push({ code: "duplicate_claim", severity: "warning", message: messages.at(-1)!, claimId: claim.id });
    } else {
      seen.set(duplicateKey, claim.id);
    }

    const valid = !messages.some((message) => !message.startsWith("Duplicate"));
    const validated: ExtractedClaim = {
      ...claim,
      validationStatus: valid ? "valid" : "rejected",
      validationMessages: messages,
      confidence: valid ? claim.confidence : Math.min(claim.confidence, 0.35),
    };

    if (valid && !messages.some((message) => message.startsWith("Duplicate"))) validClaims.push(validated);
    else rejectedClaims.push(validated);
  }

  const validConcepts = core.concepts.filter((concept) => concept.valid);
  const rejectedConcepts = core.concepts.filter((concept) => !concept.valid);
  for (const concept of rejectedConcepts) {
    issues.push({
      code: "invalid_concept",
      severity: "warning",
      message: concept.rejectionReason ?? `Invalid concept: ${concept.term}`,
      conceptId: concept.id,
    });
  }

  const fieldStates = buildFieldStates(core, validClaims, issues);
  const contradictionCount = detectMetricContradictions(validClaims, issues);
  const numericClaims = validClaims.filter((claim) => claim.numericValue !== undefined);
  const numericValid = numericClaims.filter((claim) => containsNumber(claim.evidence.map((item) => item.text).join(" "), claim.numericValue!)).length;
  const grounded = validClaims.filter((claim) => claim.evidence.length > 0).length;

  const report: ValidationReport = {
    validClaimIds: validClaims.map((claim) => claim.id),
    rejectedClaimIds: rejectedClaims.map((claim) => claim.id),
    validConceptIds: validConcepts.map((concept) => concept.id),
    rejectedConceptIds: rejectedConcepts.map((concept) => concept.id),
    issues,
    groundedClaimRatio: core.claims.length === 0 ? 0 : grounded / core.claims.length,
    numericClaimRatio: numericClaims.length === 0 ? 1 : numericValid / numericClaims.length,
    consistencyScore: Math.max(0, 1 - contradictionCount / Math.max(1, validClaims.length)),
    passed: validClaims.length > 0 && !issues.some((issue) => issue.severity === "error"),
  };

  return rebuildLegacyCore({
    ...core,
    claims: [...validClaims, ...rejectedClaims],
    concepts: [...validConcepts, ...rejectedConcepts],
    validation: report,
    fieldStates,
  });
}

function buildFieldStates(
  core: KnowledgeCore,
  claims: ExtractedClaim[],
  issues: ValidationIssue[],
): Partial<Record<ClaimType, FieldState>> {
  const states: Partial<Record<ClaimType, FieldState>> = {};
  for (const expected of core.documentProfile.expectedFields) {
    if (!expected.applicable) {
      states[expected.field] = "not_applicable";
      continue;
    }

    const present = claims.some((claim) => claim.type === expected.field);
    states[expected.field] = present ? "present" : "missing";
    if (expected.required && !present) {
      issues.push({
        code: "missing_required_field",
        severity: "error",
        message: `Required field '${expected.field}' was not found: ${expected.reason}`,
      });
    }
  }
  return states;
}

function rebuildLegacyCore(core: KnowledgeCore): KnowledgeCore {
  const valid = core.claims.filter((claim) => claim.validationStatus === "valid");
  const method = valid.find((claim) => claim.type === "method")?.object ?? null;
  const dataset = valid.find((claim) => claim.type === "data_source")?.object ?? null;
  const problem = valid.find((claim) => claim.type === "problem")?.object ?? null;
  const accuracyClaim = valid.find((claim) => claim.type === "result" && claim.metric?.toLowerCase() === "accuracy");
  const accuracy = accuracyClaim?.numericValue ?? null;
  const keyPoints = buildKeyPoints(valid);

  return {
    ...core,
    method,
    dataset,
    accuracy,
    problem,
    contributions: valid.filter((claim) => claim.type === "contribution").map((claim) => claim.object),
    keyPoints,
    entities: core.concepts.filter((concept) => concept.valid).slice(0, 20).map((concept) => concept.term),
    extras: {
      ...(core.extras ?? { metric: null, limitations: null, futureWork: null, topic: null, keywords: [] }),
      metric: valid.find((claim) => claim.type === "result" && claim.metric)?.metric ?? null,
      limitations: valid.find((claim) => claim.type === "limitation")?.object ?? null,
      futureWork: valid.find((claim) => claim.type === "future_work")?.object ?? null,
    },
  };
}

function buildKeyPoints(claims: ExtractedClaim[]): KeyPoint[] {
  const priorities: ClaimType[] = ["method", "tool", "sample", "metric", "result", "contribution"];
  const labels: Partial<Record<ClaimType, string>> = {
    method: "Method",
    tool: "Tool",
    sample: "Study sample",
    metric: "Evaluation metric",
    result: "Reported result",
    contribution: "Contribution",
  };
  const points: KeyPoint[] = [];

  for (const type of priorities) {
    const matching = claims.filter((claim) => claim.type === type).slice(0, type === "result" ? 3 : 1);
    for (const claim of matching) {
      points.push({
        label: labels[type] ?? type,
        value: type === "result" ? claim.object : claim.object,
        claimId: claim.id,
        pageNumber: claim.evidence[0]?.pageNumber,
      });
    }
  }

  return points.slice(0, 8);
}

function containsNumber(text: string, value: number): boolean {
  const escaped = String(value).replace(".", "\\.");
  return new RegExp(`(^|[^0-9])${escaped}(?:%|\\b)`).test(text);
}

function metricIsSupported(metric: string, evidence: string): boolean {
  const lowerMetric = metric.toLowerCase();
  const lowerEvidence = evidence.toLowerCase();
  if (lowerMetric === "linear correlation coefficient") return /linear correlation coefficient/.test(lowerEvidence);
  if (lowerMetric === "correlation coefficient") return /correlation coefficient/.test(lowerEvidence);
  if (lowerMetric === "correlation") return /correlation/.test(lowerEvidence);
  if (lowerMetric === "accuracy") return /accuracy|accurate/.test(lowerEvidence);
  if (lowerMetric === "inaccuracy" || lowerMetric === "prediction inaccuracy") return /inaccuracy/.test(lowerEvidence);
  return lowerEvidence.includes(lowerMetric);
}

function detectMetricContradictions(claims: ExtractedClaim[], issues: ValidationIssue[]): number {
  let count = 0;
  const byMetric = new Map<string, ExtractedClaim[]>();
  for (const claim of claims.filter((item) => item.type === "result" && item.metric && item.numericValue !== undefined)) {
    const key = claim.metric!.toLowerCase();
    byMetric.set(key, [...(byMetric.get(key) ?? []), claim]);
  }

  for (const [metric, metricClaims] of byMetric) {
    const values = new Set(metricClaims.map((claim) => claim.numericValue));
    if (values.size > 1 && metric === "accuracy") {
      count += 1;
      issues.push({
        code: "contradiction",
        severity: "warning",
        message: `Multiple accuracy values were extracted (${[...values].join(", ")}); verify result context.`,
      });
    }
  }
  return count;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
