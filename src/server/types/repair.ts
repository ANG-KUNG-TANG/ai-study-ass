export const REPAIR_FEATURES = [
  "summary",
  "quiz",
  "flashcards",
] as const;

export type RepairFeature =
  (typeof REPAIR_FEATURES)[number];

export interface RepairCacheDescriptor {
  key: string;
  noteId: string;
  userId: string;
  feature: RepairFeature;
  sourceFingerprint: string;
  variantFingerprint: string;
  gapFingerprint: string;
  strategyVersion: string;
}

export interface RepairTelemetryInput {
  noteId: string;
  userId: string;
  feature: RepairFeature;
  strategyVersion: string;
  repairNeeded: boolean;
  repairAttempted: boolean;
  repairCacheHit: boolean;
  repairAccepted: boolean;
  providerCallAvoided: boolean;
  evidenceCharacters: number;
  tokensUsed: number;
  gapCodes: string[];
}
