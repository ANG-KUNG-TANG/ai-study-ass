import {
  DEFAULT_OPERATIONAL_SETTINGS,
  OperationalSettingsEntity,
} from "@/server/entities/operational-settings.entity";

describe("OperationalSettingsEntity", () => {
  it("creates a safe default policy", () => {
    const settings = OperationalSettingsEntity.defaults().toPublic();

    expect(settings.uploadsEnabled).toBe(true);
    expect(settings.aiGenerationEnabled).toBe(true);
    expect(settings.allowedFileTypes).toEqual(["pdf", "docx"]);
    expect(settings.contentRetentionDays).toBe(0);
  });

  it("rejects disabling every upload file type", () => {
    expect(() => OperationalSettingsEntity.create({
      ...DEFAULT_OPERATIONAL_SETTINGS,
      allowedFileTypes: [],
    })).toThrow("Validation failed");
  });

  it("rejects negative provider pricing", () => {
    expect(() => OperationalSettingsEntity.create({
      ...DEFAULT_OPERATIONAL_SETTINGS,
      pricing: {
        ...DEFAULT_OPERATIONAL_SETTINGS.pricing,
        openai: {
          ...DEFAULT_OPERATIONAL_SETTINGS.pricing.openai,
          inputPerMillionUsd: -1,
        },
      },
    })).toThrow("Validation failed");
  });
});
