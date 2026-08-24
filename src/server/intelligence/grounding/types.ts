import type {
  DocumentKind,
  EvidenceSpan,
} from "../types";

export const GROUNDING_SCHEMA_VERSION = "2.0" as const;
export const GROUNDING_PIPELINE_VERSION = "intelligence-v2.4" as const;

export type AtomicFactType =
  | "definition"
  | "claim"
  | "rule"
  | "condition"
  | "number"
  | "result"
  | "formula"
  | "procedure_step"
  | "relationship"
  | "example"
  | "objective"
  | "limitation"
  | "warning"
  | "common_mistake";

export type FactVerificationStatus =
  | "supported"
  | "partially_supported"
  | "unsupported";

export interface AtomicFact {
  id: string;
  type: AtomicFactType;
  content: string;
  verbatimRequired: boolean;
  sourceSectionId: string;
  evidence: EvidenceSpan[];
  evidenceType: "stated";
  verificationStatus: FactVerificationStatus;
  confidence: number;
  importanceScore: number;
  numericTokens: string[];
}

export interface QualifiedTerm {
  term: string;
  definition: string;
  sourceSectionId: string;
  evidence: EvidenceSpan[];
  qualification:
    | "explicit_definition"
    | "glossary_definition"
    | "distinguished_and_repeated";
  confidence: number;
}

export interface ImportantConcept {
  name: string;
  normalizedName: string;
  explanation: string | null;
  sourceSectionIds: string[];
  evidence: EvidenceSpan[];
  importanceScore: number;
}

export type SectionCoverageStatus =
  | "covered"
  | "no_extractable_knowledge"
  | "excluded"
  | "failed";

export interface SectionCoverage {
  sectionId: string;
  heading: string;
  pageStart?: number;
  pageEnd?: number;
  status: SectionCoverageStatus;
  factIds: string[];
  sourceUnitCount: number;
  omittedUnitCount: number;
  reason?: string;
}

export interface GroundingQualityReport {
  score: number;
  scoreOutOf10: number;
  passed: boolean;
  supportedFactRatio: number;
  sectionCoverageRatio: number;
  numericExactnessRatio: number;
  qualifiedTermPrecision: number;
  duplicateFactRatio: number;
  artifactCount: number;
  warnings: string[];
}

export interface GroundedKnowledge {
  schemaVersion: typeof GROUNDING_SCHEMA_VERSION;
  pipelineVersion: string;
  sourceHash: string;
  documentKind: DocumentKind;
  sourceLanguage: string;
  facts: AtomicFact[];
  keyTerms: QualifiedTerm[];
  concepts: ImportantConcept[];
  sections: SectionCoverage[];
  quality: GroundingQualityReport;
  createdAt: Date;
}
