import type {
  DocumentClassification,
  DocumentDomain,
  DocumentKind,
} from "./types";

interface SignalGroup<T extends string> {
  value: T;
  phrases: string[];
}

const KIND_SIGNALS: Array<SignalGroup<DocumentKind>> = [
  {
    value: "case_study",
    phrases: [
      "case study",
      "best-case",
      "best case",
      "worst-case",
      "worst case",
      "scenario analysis",
      "sensitivity analysis",
      "should invest",
      "should the company",
      "calculate the npv",
      "calculate npv",
      "calculate irr",
      "decision problem",
      "assume that",
    ],
  },
  {
    value: "research_paper",
    phrases: [
      "abstract",
      "introduction",
      "methodology",
      "related work",
      "we propose",
      "we evaluate",
      "our results",
      "references",
      "dataset",
      "experiment",
    ],
  },
  {
    value: "lecture_notes",
    phrases: [
      "learning objectives",
      "lecture",
      "week 1",
      "week 2",
      "slide",
      "course outline",
      "lesson",
    ],
  },
  {
    value: "assignment",
    phrases: [
      "assignment",
      "submit",
      "marks",
      "answer all questions",
      "question 1",
      "task 1",
      "due date",
    ],
  },
  {
    value: "textbook_chapter",
    phrases: [
      "chapter",
      "review questions",
      "chapter summary",
      "learning outcomes",
      "worked example",
    ],
  },
  {
    value: "report",
    phrases: [
      "executive summary",
      "recommendations",
      "findings",
      "scope of the report",
      "prepared for",
    ],
  },
];

const DOMAIN_SIGNALS: Array<SignalGroup<DocumentDomain>> = [
  {
    value: "finance",
    phrases: [
      "net present value",
      "npv",
      "internal rate of return",
      "irr",
      "cash flow",
      "capital budgeting",
      "working capital",
      "discount rate",
      "cost of capital",
      "depreciation",
      "salvage value",
      "tax rate",
      "terminal cash flow",
    ],
  },
  {
    value: "software_engineering",
    phrases: [
      "software defect",
      "fault prediction",
      "software testing",
      "class imbalance",
      "code smell",
      "software metrics",
      "bug prediction",
    ],
  },
  {
    value: "data_science",
    phrases: [
      "machine learning",
      "classification",
      "regression",
      "dataset",
      "model training",
      "feature selection",
      "data mining",
    ],
  },
  {
    value: "computer_science",
    phrases: [
      "algorithm",
      "database",
      "network",
      "operating system",
      "computer vision",
      "natural language processing",
      "cybersecurity",
    ],
  },
  {
    value: "business",
    phrases: [
      "business model",
      "customer",
      "market analysis",
      "operations",
      "strategy",
      "revenue",
      "cost structure",
    ],
  },
  {
    value: "health",
    phrases: [
      "patient",
      "clinical",
      "healthcare",
      "diagnosis",
      "treatment",
      "medical",
    ],
  },
];

function phraseScore(text: string, phrases: string[]): {
  score: number;
  evidence: string[];
} {
  const lower = text.toLowerCase();
  const evidence: string[] = [];
  let score = 0;

  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = lower.match(new RegExp(escaped, "g"))?.length ?? 0;
    if (matches === 0) continue;
    score += Math.min(3, matches) * (phrase.includes(" ") ? 1.35 : 1);
    evidence.push(phrase);
  }

  return { score, evidence };
}

function selectBest<T extends string>(
  text: string,
  groups: Array<SignalGroup<T>>,
  fallback: T,
): { value: T; confidence: number; evidence: string[] } {
  const ranked = groups
    .map((group) => ({
      value: group.value,
      ...phraseScore(text, group.phrases),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score <= 0) {
    return { value: fallback, confidence: 0.25, evidence: [] };
  }

  const margin = best.score - (second?.score ?? 0);
  const confidence = Math.max(
    0.45,
    Math.min(0.98, 0.52 + best.score * 0.035 + margin * 0.025),
  );

  return {
    value: best.value,
    confidence,
    evidence: best.evidence.slice(0, 8),
  };
}

function detectTaskType(
  text: string,
  kind: DocumentKind,
  domain: DocumentDomain,
): string | null {
  const lower = text.toLowerCase();

  if (
    kind === "case_study" &&
    domain === "finance" &&
    /\b(npv|net present value)\b/.test(lower) &&
    /\b(irr|internal rate of return)\b/.test(lower)
  ) {
    return "capital_budgeting_decision";
  }

  if (
    domain === "software_engineering" &&
    /software defect|fault prediction/.test(lower)
  ) {
    return "software_defect_prediction_analysis";
  }

  if (kind === "research_paper") return "research_evidence_analysis";
  if (kind === "assignment") return "assessment_task";
  if (kind === "lecture_notes" || kind === "textbook_chapter") {
    return "concept_learning";
  }

  return null;
}

export function classifyDocument(text: string): DocumentClassification {
  const kind = selectBest(text, KIND_SIGNALS, "unknown");
  const domain = selectBest(text, DOMAIN_SIGNALS, "general");

  return {
    kind: kind.value,
    domain: domain.value,
    taskType: detectTaskType(text, kind.value, domain.value),
    confidence: Math.min(kind.confidence, domain.confidence + 0.05),
    evidence: [...new Set([...kind.evidence, ...domain.evidence])].slice(0, 12),
  };
}
