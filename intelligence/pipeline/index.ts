import { cleanDocument } from "./document_cleaner";
import { detectSections } from "./section_detector";
import { classifyDocument } from "./document_classifier";
import { buildDocumentChunks } from "./chunker";
import { runNLPPipeline } from "./nlp_pipeline";
import { extractKnowledge } from "./knowledge_extractor";
import { validateKnowledge } from "./claim_validator";
import {
  attachReliableProfile,
  buildReliableProfile,
} from "../reliability/profile";

import type {
  DocumentProfile,
  KnowledgeCore,
  NLPResult,
} from "../types";
import type {
  DocumentChunk,
  RawDocument,
  SectionedDocument,
} from "./types";
import type {
  ReliableDocumentProfile,
} from "../reliability/types";

export interface PipelineResult {
  knowledge: KnowledgeCore;
  nlp: NLPResult;
  document: SectionedDocument;
  profile: DocumentProfile;
  chunks: DocumentChunk[];
  reliabilityProfile: ReliableDocumentProfile;
}

/**
 * Synchronous compatibility runner. The full engine invokes the same functions
 * individually so it can publish user-visible progress after every stage.
 */
export function runPipeline(
  raw: RawDocument,
): PipelineResult {
  const cleaned =
    cleanDocument(raw);

  const document =
    detectSections(cleaned);

  const profile =
    classifyDocument(document);

  const chunks =
    buildDocumentChunks(document);

  const nlp =
    runNLPPipeline(document);

  const extracted =
    extractKnowledge(
      document,
      nlp,
      profile,
    );

  const validated =
    validateKnowledge(
      extracted,
    );

  const reliabilityProfile =
    buildReliableProfile({
      raw,
      document,
      nlp,
      core:
        validated,
    });

  const knowledge =
    attachReliableProfile(
      validated,
      reliabilityProfile,
    );

  return {
    knowledge,
    nlp,
    document,
    profile,
    chunks,
    reliabilityProfile,
  };
}

export {
  cleanDocument,
  detectSections,
  classifyDocument,
  buildDocumentChunks,
  runNLPPipeline,
  extractKnowledge,
  validateKnowledge,
};

export type {
  RawDocument,
  SectionedDocument,
  DocumentChunk,
} from "./types";

export type {
  NLPResult,
  KnowledgeCore,
  KnowledgeExtras,
  DocumentProfile,
} from "../types";

export type {
  ReliableDocumentProfile,
} from "../reliability/types";
