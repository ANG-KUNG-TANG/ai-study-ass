import type {
  IntelligenceStageId,
  IntelligenceStageProgress,
} from "./types";

export interface IntelligenceStageDefinition {
  stage: IntelligenceStageId;
  label: string;
  description: string;
  progress: number;
}

/**
 * Ordered catalogue shared by the engine, progress store, API, and UI.
 * Keeping this outside the engine means the user can see every stage before
 * that stage has started, rather than seeing rows appear one at a time.
 */
export const INTELLIGENCE_STAGE_CATALOG: readonly IntelligenceStageDefinition[] = [
  {
    stage: "document_received",
    label: "Document received",
    description: "The extracted document text entered the intelligence engine.",
    progress: 3,
  },
  {
    stage: "cleaning",
    label: "Cleaning document",
    description: "Normalising layout while preserving source evidence.",
    progress: 9,
  },
  {
    stage: "section_detection",
    label: "Detecting sections",
    description: "Finding headings, page ranges, and semantic section roles.",
    progress: 16,
  },
  {
    stage: "document_classification",
    label: "Classifying document",
    description: "Determining whether the file is a paper, lecture, report, documentation, or assignment.",
    progress: 22,
  },
  {
    stage: "chunking",
    label: "Creating source chunks",
    description: "Building section-aware chunks without discarding later pages.",
    progress: 28,
  },
  {
    stage: "nlp",
    label: "Analysing language",
    description: "Detecting sentences, phrases, entities, metrics, tools, and concepts.",
    progress: 38,
  },
  {
    stage: "claim_extraction",
    label: "Extracting claims",
    description: "Creating structured problem, method, sample, result, and definition claims.",
    progress: 48,
  },
  {
    stage: "claim_validation",
    label: "Validating evidence",
    description: "Rejecting unsupported numbers, metric mismatches, duplicates, and invalid concepts.",
    progress: 58,
  },
  {
    stage: "ontology_resolution",
    label: "Resolving concepts",
    description: "Matching concepts to the ontology while retaining document-local concepts.",
    progress: 66,
  },
  {
    stage: "graph_construction",
    label: "Building knowledge graph",
    description: "Connecting the document, validated claims, concepts, tools, samples, and results.",
    progress: 73,
  },
  {
    stage: "symbolic_reasoning",
    label: "Running symbolic reasoning",
    description: "Generating Prolog facts and explainable inferences from validated knowledge.",
    progress: 79,
  },
  {
    stage: "gap_detection",
    label: "Checking knowledge gaps",
    description: "Checking only fields applicable to this document type.",
    progress: 84,
  },
  {
    stage: "confidence_scoring",
    label: "Scoring confidence",
    description: "Measuring grounding, numeric validity, consistency, coverage, concepts, graph, and reasoning.",
    progress: 89,
  },
  {
    stage: "ai_repair",
    label: "Repairing missing knowledge",
    description: "Optionally filling required gaps with evidence-grounded AI claims.",
    progress: 95,
  },
  {
    stage: "complete",
    label: "Intelligence ready",
    description: "The validated intelligence result is ready for summary, quiz, flashcards, and chat.",
    progress: 100,
  },
] as const;

export const INTELLIGENCE_STAGE_META: Readonly<
  Record<
    IntelligenceStageId,
    Omit<IntelligenceStageDefinition, "stage">
  >
> = Object.freeze(
  Object.fromEntries(
    INTELLIGENCE_STAGE_CATALOG.map(({ stage, ...definition }) => [
      stage,
      definition,
    ]),
  ) as Record<
    IntelligenceStageId,
    Omit<IntelligenceStageDefinition, "stage">
  >,
);

export function createPendingStageProgress(): IntelligenceStageProgress[] {
  return INTELLIGENCE_STAGE_CATALOG.map((definition) => ({
    ...definition,
    status: "pending",
    warnings: [],
  }));
}
