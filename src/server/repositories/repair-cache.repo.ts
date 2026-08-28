import {
  RepairCache,
  type IRepairCache,
} from "@/server/models/RepairCache";

export async function findById(
  key: string,
): Promise<IRepairCache | null> {
  const doc =
    await RepairCache.findById(key)
      .lean()
      .exec();

  return doc
    ? (doc as unknown as IRepairCache)
    : null;
}

export async function upsert(
  value: Omit<
    IRepairCache,
    "createdAt" | "updatedAt"
  >,
): Promise<void> {
  await RepairCache.findOneAndUpdate(
    { _id: value._id },
    {
      $set: {
        noteId: value.noteId,
        userId: value.userId,
        feature: value.feature,
        sourceFingerprint:
          value.sourceFingerprint,
        variantFingerprint:
          value.variantFingerprint,
        gapFingerprint:
          value.gapFingerprint,
        strategyVersion:
          value.strategyVersion,
        payload: value.payload,
        expiresAt: value.expiresAt,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  ).exec();
}

export async function deleteById(
  key: string,
): Promise<void> {
  await RepairCache.deleteOne({
    _id: key,
  }).exec();
}

export async function deleteByNoteId(
  noteId: string,
): Promise<void> {
  await RepairCache.deleteMany({
    noteId,
  }).exec();
}
