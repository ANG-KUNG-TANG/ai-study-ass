import {
  OperationalSettingsEntity,
  OPERATIONAL_SETTINGS_ID,
} from "@/server/entities/operational-settings.entity";
import {
  OperationalSettings,
  type OperationalSettingsPersistence,
} from "@/server/models/OperationalSettings";

function toEntity(
  doc: OperationalSettingsPersistence,
): OperationalSettingsEntity {
  return OperationalSettingsEntity.fromPersistence({
    id: OPERATIONAL_SETTINGS_ID,
    uploadsEnabled: doc.uploadsEnabled,
    aiGenerationEnabled: doc.aiGenerationEnabled,
    allowedFileTypes: doc.allowedFileTypes,
    maxUploadSizeBytes: doc.maxUploadSizeBytes,
    auditRetentionDays: doc.auditRetentionDays,
    contentRetentionDays: doc.contentRetentionDays,
    pricing: doc.pricing,
    updatedBy: doc.updatedBy ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export async function find(): Promise<OperationalSettingsEntity | null> {
  const doc = await OperationalSettings.findById(OPERATIONAL_SETTINGS_ID)
    .lean<OperationalSettingsPersistence>()
    .exec();

  return doc ? toEntity(doc) : null;
}

export async function save(
  entity: OperationalSettingsEntity,
): Promise<OperationalSettingsEntity> {
  const data = entity.toPublic();

  const doc = await OperationalSettings.findOneAndUpdate(
    { _id: OPERATIONAL_SETTINGS_ID },
    {
      $set: {
        uploadsEnabled: data.uploadsEnabled,
        aiGenerationEnabled: data.aiGenerationEnabled,
        allowedFileTypes: data.allowedFileTypes,
        maxUploadSizeBytes: data.maxUploadSizeBytes,
        auditRetentionDays: data.auditRetentionDays,
        contentRetentionDays: data.contentRetentionDays,
        pricing: data.pricing,
        updatedBy: data.updatedBy,
      },
      $setOnInsert: {
        _id: OPERATIONAL_SETTINGS_ID,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
    .lean<OperationalSettingsPersistence>()
    .exec();

  if (!doc) {
    throw new Error("Operational settings could not be saved");
  }

  return toEntity(doc);
}
