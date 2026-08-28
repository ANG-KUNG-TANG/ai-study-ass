import {
  assessExtractionQuality,
} from "@/server/services/extraction-quality.service";
import {
  buildSelectiveOcrPlan,
  mergeRecoveredPages,
  shouldAcceptSelectiveOcrRecovery,
} from "@/server/services/ocr/selective-ocr.service";

function healthyText(
  label: string,
): string {
  return (
    `${label} explains a reliable networking concept with enough readable ` +
    "detail to support study generation, validation, examples, and review."
  ).repeat(4);
}

function extractionReport(input: {
  pages: Array<{
    pageNumber: number;
    rawText: string;
  }>;
  pageCount: number;
}) {
  return assessExtractionQuality({
    fileType: "pdf",
    content: input.pages
      .map((page) => page.rawText)
      .join("\n\n"),
    pageCount: input.pageCount,
    pages: input.pages,
  });
}

describe(
  "selective OCR recovery",
  () => {
    it(
      "skips OCR when native extraction is already good",
      () => {
        const pages = [
          {
            pageNumber: 1,
            rawText:
              healthyText("Page one"),
          },
          {
            pageNumber: 2,
            rawText:
              healthyText("Page two"),
          },
          {
            pageNumber: 3,
            rawText:
              healthyText("Page three"),
          },
          {
            pageNumber: 4,
            rawText:
              healthyText("Page four"),
          },
        ];
        const report =
          assessExtractionQuality({
            fileType: "pdf",
            content: pages
              .map(
                (page) =>
                  page.rawText,
              )
              .join("\n\n"),
            pageCount: 4,
            pages,
          });

        const plan =
          buildSelectiveOcrPlan({
            report,
            pages,
            pageCount: 4,
          });

        expect(
          plan.action,
        ).toBe("skip");
        expect(
          plan.pageNumbers,
        ).toEqual([]);
      },
    );

    it(
      "targets only pages with missing or weak native text",
      () => {
        const pages = [
          {
            pageNumber: 1,
            rawText:
              healthyText("Page one").slice(0, 110),
          },
          {
            pageNumber: 2,
            rawText: "tiny",
          },
          {
            pageNumber: 4,
            rawText:
              healthyText("Page four").slice(0, 110),
          },
          {
            pageNumber: 6,
            rawText:
              healthyText("Page six").slice(0, 110),
          },
        ];
        const report =
          assessExtractionQuality({
            fileType: "pdf",
            content: pages
              .map(
                (page) =>
                  page.rawText,
              )
              .join("\n\n"),
            pageCount: 6,
            pages,
          });

        const plan =
          buildSelectiveOcrPlan({
            report,
            pages,
            pageCount: 6,
          });

        expect(
          plan.action,
        ).toBe("ocr");
        expect(
          plan.pageNumbers,
        ).toEqual([
          2,
          3,
          5,
        ]);
      },
    );

    it(
      "blocks an unbounded full-document OCR fallback",
      () => {
        const report =
          assessExtractionQuality({
            fileType: "pdf",
            content: "",
            pageCount: 30,
            pages: [],
          });

        const plan =
          buildSelectiveOcrPlan({
            report,
            pages: [],
            pageCount: 30,
            maxPages: 24,
          });

        expect(
          plan.action,
        ).toBe("blocked");
        expect(
          plan.pageNumbers,
        ).toEqual([]);
        expect(
          plan.candidatePageNumbers,
        ).toHaveLength(30);
      },
    );

    it(
      "allows a fully scanned small document because every affected page is still bounded",
      () => {
        const report =
          assessExtractionQuality({
            fileType: "pdf",
            content: "",
            pageCount: 4,
            pages: [],
          });

        const plan =
          buildSelectiveOcrPlan({
            report,
            pages: [],
            pageCount: 4,
            maxPages: 24,
          });

        expect(
          plan.action,
        ).toBe("ocr");
        expect(
          plan.pageNumbers,
        ).toEqual([
          1,
          2,
          3,
          4,
        ]);
      },
    );

    it(
      "probes sparse pages in an otherwise good image-heavy PDF",
      () => {
        const pages = [
          {
            pageNumber: 1,
            rawText:
              healthyText("Text-heavy first page").slice(0, 320),
          },
          {
            pageNumber: 2,
            rawText:
              "Configure the FTP server and review the screenshot below.",
          },
          {
            pageNumber: 3,
            rawText:
              "FTP server configuration text. Delete FTP. Router interface brief is shown below.",
          },
          {
            pageNumber: 4,
            rawText:
              "Ping from PC 0 is shown in the screenshot below.",
          },
        ];
        const report =
          extractionReport({
            pages,
            pageCount: 4,
          });

        expect(report.status).toBe("good");
        expect(
          report.metrics.averageCharsPerPage,
        ).toBeGreaterThanOrEqual(120);

        const plan =
          buildSelectiveOcrPlan({
            report,
            pages,
            pageCount: 4,
          });

        expect(plan.action).toBe("ocr");
        expect(plan.reason).toBe(
          "sparse_image_heavy_probe",
        );
        expect(plan.pageNumbers).toEqual([
          2,
          3,
          4,
        ]);
      },
    );

    it(
      "does not probe one sparse title page in an otherwise text-rich PDF",
      () => {
        const pages = [
          {
            pageNumber: 1,
            rawText: "Course title and author",
          },
          ...[2, 3, 4, 5].map(
            (pageNumber) => ({
              pageNumber,
              rawText: healthyText(
                `Text-rich page ${pageNumber}`,
              ),
            }),
          ),
        ];
        const report =
          extractionReport({
            pages,
            pageCount: 5,
          });

        expect(report.status).toBe("good");

        const plan =
          buildSelectiveOcrPlan({
            report,
            pages,
            pageCount: 5,
          });

        expect(plan.action).toBe("skip");
        expect(plan.reason).toBe(
          "native_extraction_usable",
        );
      },
    );

    it(
      "accepts page-level OCR enrichment when the global score stays at 100",
      () => {
        const nativeReport =
          extractionReport({
            pageCount: 4,
            pages: [
              { pageNumber: 1, rawText: healthyText("Page one") },
              { pageNumber: 2, rawText: "FTP screenshot caption" },
              { pageNumber: 3, rawText: "Router screenshot caption" },
              { pageNumber: 4, rawText: "Ping screenshot caption" },
            ],
          });
        const recoveredReport = {
          ...nativeReport,
          score: nativeReport.score,
        };

        expect(nativeReport.score).toBe(100);
        expect(
          shouldAcceptSelectiveOcrRecovery({
            nativeReport,
            recoveredReport,
            improvedPageNumbers: [2, 3, 4],
          }),
        ).toBe(true);
      },
    );

    it(
      "rejects OCR enrichment when page text improves but global quality regresses",
      () => {
        const nativeReport =
          extractionReport({
            pageCount: 4,
            pages: [
              { pageNumber: 1, rawText: healthyText("Page one") },
              { pageNumber: 2, rawText: "FTP screenshot caption" },
              { pageNumber: 3, rawText: "Router screenshot caption" },
              { pageNumber: 4, rawText: "Ping screenshot caption" },
            ],
          });
        const recoveredReport = {
          ...nativeReport,
          score: 89,
        };

        expect(
          shouldAcceptSelectiveOcrRecovery({
            nativeReport,
            recoveredReport,
            improvedPageNumbers: [2],
          }),
        ).toBe(false);
      },
    );

    it(
      "replaces only weak native pages with stronger OCR text",
      () => {
        const strongNative =
          healthyText(
            "Strong native page",
          );
        const recovered =
          healthyText(
            "Recovered scanned page",
          );

        const merged =
          mergeRecoveredPages(
            [
              {
                pageNumber: 1,
                rawText:
                  strongNative,
              },
              {
                pageNumber: 2,
                rawText:
                  "small",
              },
            ],
            [
              {
                pageNumber: 1,
                rawText:
                  "bad",
              },
              {
                pageNumber: 2,
                rawText:
                  recovered,
              },
            ],
          );

        expect(
          merged.find(
            (page) =>
              page.pageNumber ===
              1,
          )?.rawText,
        ).toBe(
          strongNative,
        );
        expect(
          merged.find(
            (page) =>
              page.pageNumber ===
              2,
          )?.rawText,
        ).toBe(
          recovered,
        );
      },
    );
  },
);
