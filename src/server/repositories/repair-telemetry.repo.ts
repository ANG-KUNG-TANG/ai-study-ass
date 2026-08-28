import {
  RepairTelemetry,
  type IRepairTelemetry,
} from "@/server/models/RepairTelemetry";

export async function create(
  value: IRepairTelemetry,
): Promise<void> {
  await RepairTelemetry.create(value);
}

export async function findByNoteId(
  noteId: string,
  limit = 100,
): Promise<IRepairTelemetry[]> {
  const docs =
    await RepairTelemetry.find({
      noteId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(
        Math.max(
          1,
          Math.min(500, Math.floor(limit)),
        ),
      )
      .lean()
      .exec();

  return docs as unknown as IRepairTelemetry[];
}
