// server/repositories/knowledge.repo.ts
// Mapper + repo merged, per your call two turns ago. Typo fixed.

import { Types } from 'mongoose';
import { Knowledge, type KnowledgeDocument } from '@/server/models/Knowledge';
import type {
  IntelligenceResult,
  PipelineStage,
} from '@/server/types/Knowledge';
import { CreateKnowledgeInput, KnowledgeEntity } from '@/server/entities/knowledge.entity';

// ─── Mapper ──────────────────────────────────────────────────────────────────

export function fromIntelligenceResult(result: IntelligenceResult): CreateKnowledgeInput {
  return ({
    noteId: result.noteId,
    stage: 'complete',
    core: result.core,
    ontologyMatches: result.ontology.map((rc) => ({
      conceptId: rc.concept.id,
      confidence: rc.confidence,
      matchType: rc.matchType,
      rawInput: rc.rawInput,
    })),
    graph: {
      nodes: Array.from(result.graph.nodes.values()),
      edges: result.graph.edges,
    },
    prologFacts: result.prolog.facts, // never result.prolog.engine — live instance
    gaps: result.gaps,
    confidenceBreakdown: result.confidenceBreakdown,
    confidence: result.confidence,
    aiFallback: result.aiFallback,
  } as unknown) as CreateKnowledgeInput;
}

export function toEntity(doc: KnowledgeDocument): KnowledgeEntity {
  return ({
    noteId: doc.noteId.toString(),
    stage: doc.stage,
    error: doc.error,
    core: doc.core as unknown as KnowledgeEntity['core'],
    ontologyMatches: doc.ontologyMatches,
    graph: doc.graph,
    prologFacts: doc.prologFacts,
    gaps: doc.gaps as unknown as KnowledgeEntity['gaps'],
    confidenceBreakdown: doc.confidenceBreakdown,
    confidence: doc.confidence,
    aiFallback: doc.aiFallback as unknown as KnowledgeEntity['aiFallback'],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    // Mongoose documents expose a validate method; satisfy the entity type by
    // reusing the document's validate function.
    validate: (doc.validate as unknown) as KnowledgeEntity['validate'],
  } as unknown) as KnowledgeEntity;
}

// error intentionally excluded here — a successful upsert always clears it
// via $unset below rather than relying on $set-with-undefined, which Mongo
// silently drops and would leave a stale error message on a now-complete doc.
export function toPersistence(input: CreateKnowledgeInput) {
  return {
    noteId: new Types.ObjectId(input.noteId),
    stage: input.stage,
    core: input.core,
    ontologyMatches: input.ontologyMatches,
    graph: input.graph,
    prologFacts: input.prologFacts,
    gaps: input.gaps,
    confidenceBreakdown: input.confidenceBreakdown,
    confidence: input.confidence,
    aiFallback: input.aiFallback,
  };
}

// ─── Repo ────────────────────────────────────────────────────────────────────

export async function save(input: CreateKnowledgeInput): Promise<KnowledgeEntity> {
  const doc = await Knowledge.create(toPersistence(input));
  return toEntity(doc);
}

export async function upsert(input: CreateKnowledgeInput): Promise<KnowledgeEntity> {
  const doc = await Knowledge.findOneAndUpdate(
    { noteId: input.noteId },
    {
      $set: toPersistence(input),
      $unset: { error: '' },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return toEntity(doc!);
}

/**
 * Marks a note's Knowledge as failed at a given stage. Explicitly $unsets
 * the success fields rather than relying on $set-with-undefined (which
 * MongoDB silently drops from the update, leaving stale core/graph data
 * behind from a PREVIOUS successful run if this note is being reprocessed
 * and fails the second time). Without the $unset, a note could show old
 * "complete" data under a "failed" stage — flagging this since it's the
 * kind of bug that only shows up on reprocessing, not first run.
 */
export async function upsertFailed(
  noteId: string,
  stage: PipelineStage,
  error: string
): Promise<KnowledgeEntity> {
  const doc = await Knowledge.findOneAndUpdate(
    { noteId },
    {
      $set: { stage, error },
      $unset: {
        core: '',
        ontologyMatches: '',
        graph: '',
        prologFacts: '',
        gaps: '',
        confidenceBreakdown: '',
        confidence: '',
        aiFallback: '',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return toEntity(doc!);
}

export async function findByNoteId(noteId: string): Promise<KnowledgeEntity | null> {
  const doc = await Knowledge.findOne({ noteId });
  return doc ? toEntity(doc) : null;
}

export async function deleteByNoteId(noteId: string): Promise<boolean> {
  const result = await Knowledge.deleteOne({ noteId });
  return result.deletedCount === 1;
}

export async function exists(noteId: string): Promise<boolean> {
  const doc = await Knowledge.exists({ noteId });
  return doc !== null;
}