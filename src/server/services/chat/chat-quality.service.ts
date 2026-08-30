import type {
  ChatGroundingDecision,
  ChatResponseValidation,
} from "@/server/services/chat/chat-grounding.service";
import {
  buildFeatureQualityReport,
  type FeatureQualityContractReport,
} from "@/server/services/quality/feature-quality.contract";

export function assessChatQualityContract(input: {
  answer: string;
  decision: ChatGroundingDecision;
  validation?: ChatResponseValidation;
}): FeatureQualityContractReport {
  const { answer, decision, validation } = input;
  const abstention = decision.answerability === "NOT_ANSWERABLE";
  const honestAbstention = abstention && /(?:couldn'?t|cannot|can'?t|won'?t\s+guess|not\s+enough|not\s+provided|not\s+in\s+(?:the\s+)?document)/iu.test(answer);
  const validationAccepted = abstention
    ? honestAbstention
    : validation?.accepted ?? true;
  const numericExactness = validation?.issueCodes.includes("UNSUPPORTED_NUMERIC") ? 0 : 1;
  const claimGrounding = validation?.issueCodes.includes("UNSUPPORTED_CLAIM") ? 0 : 1;
  const limitationHonesty = decision.answerability === "PARTIAL"
    ? validation?.issueCodes.includes("PARTIAL_WITHOUT_LIMITATION") ? 0 : 1
    : abstention ? (honestAbstention ? 1 : 0) : 1;
  const answerabilityAlignment = validation?.issueCodes.includes("UNEXPECTED_ABSTENTION") ? 0 : 1;
  const completeness = decision.answerability === "ANSWERABLE"
    ? Math.min(1, 0.65 + decision.queryCoverage * 0.35)
    : decision.answerability === "PARTIAL"
      ? Math.min(1, 0.7 + decision.queryCoverage * 0.3)
      : honestAbstention ? 1 : 0;
  const readability = readabilityRatio(answer);
  const evidenceUse = abstention
    ? 1
    : decision.evidence.length > 0 && decision.supportedPoints.length > 0
      ? 1
      : decision.evidence.length > 0
        ? 0.9
        : 0.6;

  return buildFeatureQualityReport({
    feature: "chat",
    dimensions: [
      { key: "grounding", label: "Grounding", weight: 2.5, ratio: claimGrounding },
      { key: "answerability", label: "Answerability alignment", weight: 1.5, ratio: answerabilityAlignment },
      { key: "numericExactness", label: "Numeric exactness", weight: 1.5, ratio: numericExactness },
      { key: "completeness", label: "Question coverage", weight: 1.5, ratio: completeness },
      { key: "limitationHonesty", label: "Limitation honesty", weight: 1.0, ratio: limitationHonesty },
      { key: "readability", label: "Readability", weight: 1.0, ratio: readability },
      { key: "evidenceUse", label: "Evidence use", weight: 1.0, ratio: evidenceUse },
    ],
    hardGates: [
      {
        code: "NO_UNSUPPORTED_CLAIMS",
        message: "Chat must not present unsupported claims as document facts.",
        passed: claimGrounding === 1,
      },
      {
        code: "NUMERIC_EXACTNESS",
        message: "Numbers in chat answers must be supported exactly by document evidence.",
        passed: numericExactness === 1,
      },
      {
        code: "HONEST_ABSTENTION",
        message: "When the source cannot answer, chat must say so instead of guessing.",
        passed: validationAccepted,
      },
    ],
  });
}

function readabilityRatio(answer: string): number {
  const text = answer.trim();
  if (!text) return 0;
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((item) => item.replace(/^[-*]\s*/u, "").trim())
    .filter(Boolean);
  if (sentences.length === 0) return 1;
  const readable = sentences.filter((sentence) =>
    sentence.split(/\s+/u).filter(Boolean).length <= 42 && sentence.length <= 320,
  ).length;
  return readable / sentences.length;
}
