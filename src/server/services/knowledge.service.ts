// server/services/knowledge.service.ts
// (matches your uploaded knowledge_service.ts, minus the typo import + new failure path)

import * as knowledgeRepo from '@/server/repositories/knowledge.repo';
import * as knowledgeEntity from '@/server/entities/knowledge.entity';
import { NotFoundError, ValidationError } from '@/server/utils/errors';
import type { IntelligenceResult, KnowledgeEntity, PipelineStage } from '@/server/types/Knowledge';

export async function createKnowledge(result: IntelligenceResult): Promise<KnowledgeEntity> {
  const input = knowledgeRepo.fromIntelligenceResult(result);
  const errors = knowledgeEntity.validate({ ...input, createdAt: new Date(), updatedAt: new Date() });
  if (errors.length > 0) throw new ValidationError(errors.join('; '));
  return knowledgeRepo.upsert(input);
}

export async function createFailedKnowledge(
  noteId: string,
  stage: PipelineStage,
  error: string
): Promise<KnowledgeEntity> {
  return knowledgeRepo.upsertFailed(noteId, stage, error);
}

export async function getKnowledge(noteId: string): Promise<KnowledgeEntity> {
  const knowledge = await knowledgeRepo.findByNoteId(noteId);
  if (!knowledge) throw new NotFoundError(`Knowledge not found for note ${noteId}`);
  return knowledge;
}

export async function ensureKnowledge(noteId: string): Promise<KnowledgeEntity | null> {
  return knowledgeRepo.findByNoteId(noteId);
}

export async function deleteKnowledge(noteId: string): Promise<boolean> {
  return knowledgeRepo.deleteByNoteId(noteId);
}