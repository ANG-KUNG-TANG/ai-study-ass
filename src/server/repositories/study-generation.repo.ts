import type { UpdateQuery } from "mongoose";
import {
  StudyGeneration,
  type IStudyGeneration,
} from "@/server/models/StudyGeneration";
import {
  GENERATION_FEATURES,
  type FeatureGenerationState,
  type GenerationFeature,
  type GenerationStep,
  type StudyGenerationStage,
  type StudyGenerationState,
} from "@/server/types/generation";


function freshFeatureState(): FeatureGenerationState {
  return {
    status: "pending",
    source: null,
    confidence: null,
    aiFallbackUsed: false,
    itemCount: null,
    error: null,
    updatedAt: new Date(),
  };
}

function freshFeatures(): StudyGenerationState["features"] {
  return {
    summary: freshFeatureState(),
    quiz: freshFeatureState(),
    flashcards: freshFeatureState(),
    chatKnowledge: freshFeatureState(),
  };
}

function toState(value: unknown): StudyGenerationState {
  const doc = value as {
    _id: string;
    noteId: string;
    userId: string;
    stage: StudyGenerationStage;
    currentStep: GenerationStep;
    features: StudyGenerationState["features"];
    startedAt: Date;
    completedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  return {
    noteId: doc.noteId ?? doc._id,
    userId: doc.userId,
    stage: doc.stage,
    currentStep: doc.currentStep ?? "queued",
    features: doc.features,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function initialise(
  noteId: string,
  userId: string,
  reset = false,
): Promise<StudyGenerationState> {
  const now = new Date();

  const update: UpdateQuery<IStudyGeneration> = reset
    ? {
        $set: {
          userId,
          stage: "pending",
          currentStep: "queued",
          features: freshFeatures(),
          startedAt: now,
          completedAt: null,
        },
        $setOnInsert: {
          _id: noteId,
          noteId,
        },
      }
    : {
        $setOnInsert: {
          _id: noteId,
          noteId,
          userId,
          stage: "pending",
          currentStep: "queued",
          features: freshFeatures(),
          startedAt: now,
          completedAt: null,
        },
      };

  const doc = await StudyGeneration.findOneAndUpdate({ _id: noteId }, update, {
    upsert: true,
    returnDocument: "after",
    setDefaultsOnInsert: true,
  })
    .lean()
    .exec();

  if (!doc) {
    throw new Error(`Could not initialise study generation for note ${noteId}`);
  }

  return toState(doc);
}

export async function updateStage(
  noteId: string,
  stage: StudyGenerationStage,
): Promise<void> {
  const completedAt =
    stage === "complete" || stage === "partial" || stage === "failed"
      ? new Date()
      : null;

  await StudyGeneration.updateOne(
    { _id: noteId },
    {
      $set: {
        stage,
        completedAt,
      },
    },
  ).exec();
}

export async function updateFeature(
  noteId: string,
  feature: GenerationFeature,
  update: Partial<FeatureGenerationState>,
): Promise<void> {
  if (!GENERATION_FEATURES.includes(feature)) {
    throw new Error(`Unknown generation feature: ${feature}`);
  }

  const set: Record<string, unknown> = {
    [`features.${feature}.updatedAt`]: new Date(),
    updatedAt: new Date(),
  };

  for (const [key, value] of Object.entries(update)) {
    set[`features.${feature}.${key}`] = value;
  }

  await StudyGeneration.updateOne({ _id: noteId }, { $set: set }).exec();
}

export async function findByNoteId(
  noteId: string,
): Promise<StudyGenerationState | null> {
  const doc = await StudyGeneration.findById(noteId).lean().exec();
  return doc ? toState(doc) : null;
}

export async function deleteByNoteId(noteId: string): Promise<void> {
  await StudyGeneration.deleteOne({ _id: noteId }).exec();
}

export async function updateCurrentStep(
  noteId: string,
  currentStep: GenerationStep,
): Promise<void> {
  await StudyGeneration.updateOne(
    { _id: noteId },
    {
      $set: {
        currentStep,
      },
    },
  ).exec();
}
