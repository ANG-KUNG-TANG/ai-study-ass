export type DocumentKind =
  | "research_paper"
  | "case_study"
  | "lecture_notes"
  | "textbook_chapter"
  | "assignment"
  | "report"
  | "unknown";

export type DocumentDomain =
  | "finance"
  | "computer_science"
  | "software_engineering"
  | "data_science"
  | "business"
  | "health"
  | "general";

export type ReliabilityStatus = "ready" | "partial" | "rejected";

export interface DocumentClassification {
  kind: DocumentKind;
  domain: DocumentDomain;
  taskType: string | null;
  confidence: number;
  evidence: string[];
}

export type TitleSource =
  | "metadata"
  | "heading"
  | "generated"
  | "filename";

export interface RejectedTitleCandidate {
  value: string;
  reason: string;
}

export interface ResolvedTitle {
  value: string;
  source: TitleSource;
  confidence: number;
  generated: boolean;
  rejectedCandidates: RejectedTitleCandidate[];
}

export interface TextQualityReport {
  score: number;
  passed: boolean;
  suspiciousCharacterRatio: number;
  greekCharacterRatio: number;
  readableCharacterRatio: number;
  corruptLineCount: number;
  repeatedLineCount: number;
  replacementCharacterCount: number;
  warnings: string[];
}

export interface StudyConcept {
  term: string;
  normalized: string;
  category: string;
  confidence: number;
  evidence?: string;
}

export interface KeyTermDefinition {
  term: string;
  definition: string;
  confidence: number;
  evidence: string;
}

export type FinancialUnit =
  | "USD"
  | "percent"
  | "years"
  | "days"
  | "seats"
  | "barrels"
  | "gallons"
  | "pints"
  | "count"
  | "unknown";

export type FinancialFrequency =
  | "once"
  | "daily"
  | "monthly"
  | "yearly"
  | "unknown";

export interface FinancialInput {
  label: string;
  value: number;
  unit: FinancialUnit;
  frequency: FinancialFrequency;
  growthRate?: number;
  startYear?: number;
  evidence: string;
  evidencePage?: number;
  confidence: number;
  derived?: boolean;
  formula?: string;
}

export interface CaseScenario {
  name: string;
  changes: string[];
  evidence: string[];
  confidence: number;
}

export interface CaseStudyProfile {
  decisionProblem: string | null;
  actors: string[];
  method: string;
  financialInputs: FinancialInput[];
  scenarios: CaseScenario[];
  requiredCalculations: string[];
  unresolvedAssumptions: string[];
  derivedCalculations: FinancialInput[];
}

export interface RequirementItem {
  id: string;
  priority: "M" | "S" | "C" | "W" | null;
  statement: string;
  evidence: string;
}

export interface RequirementsDocumentProfile {
  objectives: string[];
  requirements: RequirementItem[];
  actors: string[];
  processSteps: string[];
  diagramTypes: string[];
  priorityScheme: string | null;
}

export interface CoverageReport {
  score: number;
  status: ReliabilityStatus;
  requiredFields: string[];
  presentFields: string[];
  missingFields: string[];
  criticalWarnings: string[];
  componentScores: {
    textQuality: number;
    titleQuality: number;
    conceptQuality: number;
    structuralCoverage: number;
    grounding: number;
    numericValidation: number;
    consistency: number;
    sectionCoverage: number;
  };
}

export interface ReliableDocumentProfile {
  title: ResolvedTitle;
  classification: DocumentClassification;
  textQuality: TextQualityReport;
  concepts: StudyConcept[];
  keyTerms: KeyTermDefinition[];
  caseStudy: CaseStudyProfile | null;
  requirementsDocument: RequirementsDocumentProfile | null;
  coverage: CoverageReport;
  qualityScore: number;
  qualityScoreOutOf10: number;
  status: ReliabilityStatus;
  warnings: string[];
  cleanedText: string;
}
