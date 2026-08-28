import {
  buildRepairCacheDescriptor,
} from "@/server/services/repair-cache.service";

describe(
  "repair cache descriptor",
  () => {
    const base = {
      noteId: "note-1",
      userId: "user-1",
      feature:
        "summary" as const,
      sourceText:
        "Verified source text.",
      variant:
        "mode=comprehensive",
      gapParts: [
        "LOW_SECTION_COVERAGE",
        "LOW_MAJOR_FACT_COVERAGE",
      ],
      strategyVersion:
        "summary-targeted-v1",
    };

    it(
      "is stable when gap ordering changes",
      () => {
        const left =
          buildRepairCacheDescriptor(
            base,
          );
        const right =
          buildRepairCacheDescriptor({
            ...base,
            gapParts: [
              "LOW_MAJOR_FACT_COVERAGE",
              "LOW_SECTION_COVERAGE",
            ],
          });

        expect(
          left.key,
        ).toBe(
          right.key,
        );
      },
    );

    it(
      "changes when the source changes",
      () => {
        const left =
          buildRepairCacheDescriptor(
            base,
          );
        const right =
          buildRepairCacheDescriptor({
            ...base,
            sourceText:
              "Different source text.",
          });

        expect(
          left.key,
        ).not.toBe(
          right.key,
        );
      },
    );

    it(
      "changes across feature variants",
      () => {
        const left =
          buildRepairCacheDescriptor(
            base,
          );
        const right =
          buildRepairCacheDescriptor({
            ...base,
            variant:
              "mode=exam",
          });

        expect(
          left.key,
        ).not.toBe(
          right.key,
        );
      },
    );

    it(
      "changes when the repair strategy version changes",
      () => {
        const left =
          buildRepairCacheDescriptor(
            base,
          );
        const right =
          buildRepairCacheDescriptor({
            ...base,
            strategyVersion:
              "summary-targeted-v2",
          });

        expect(
          left.key,
        ).not.toBe(
          right.key,
        );
      },
    );
  },
);
