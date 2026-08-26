import {
  assessExtractionQuality,
  assertExtractionUsable,
  ExtractionQualityError,
} from "@/server/services/extraction-quality.service";

describe("extraction-quality.service", () => {
  it("accepts healthy DOCX-style text", () => {
    const content = [
      "Software defect prediction estimates which modules are most likely to contain defects.",
      "Object-oriented metrics such as coupling, cohesion, inheritance depth, and class size can be used as predictors.",
      "A reliable study assistant should keep generated claims grounded in the uploaded source and reject unsupported content.",
      "Evaluation should consider precision, recall, F1 score, class imbalance, and the quality of the extracted evidence.",
    ].join("\n\n");

    const report = assessExtractionQuality({
      fileType: "docx",
      content,
    });

    expect(report.status).toBe("good");
    expect(report.usable).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });

  it("does not assume extracted text must be ASCII or English", () => {
    const content = [
      "การเรียนรู้ของเครื่องช่วยวิเคราะห์ข้อมูลและสร้างแบบจำลองจากหลักฐานที่มีอยู่ในเอกสาร",
      "မြန်မာဘာသာဖြင့်ရေးထားသောစာသားများကိုလည်း Unicode အဖြစ်မှန်ကန်စွာစစ်ဆေးနိုင်ရမည်။",
      "ระบบควรตรวจสอบคุณภาพของข้อความก่อนสร้างสรุป แบบทดสอบ และแฟลชการ์ดจากเอกสารที่อัปโหลด",
      "အရင်းအမြစ်စာသားနှင့် ချိတ်ဆက်ထားသော အထောက်အထားများကို မပျောက်စေရန် စနစ်က အရည်အသွေးစစ်ဆေးမှု ပြုလုပ်ရမည်။",
    ].join("\n\n");

    const report = assessExtractionQuality({
      fileType: "docx",
      content,
    });

    expect(report.status).not.toBe("failed");
    expect(report.metrics.alphanumericRatio).toBeGreaterThan(0.35);
  });

  it("fails empty extraction", () => {
    const report = assessExtractionQuality({
      fileType: "pdf",
      content: "   \n\n ",
      pageCount: 6,
      pages: [],
    });

    expect(report.status).toBe("failed");
    expect(report.usable).toBe(false);
    expect(
      report.reasons.some(
        (reason) => reason.code === "EMPTY_OR_WHITESPACE",
      ),
    ).toBe(true);
  });

  it("fails a PDF with very low page coverage", () => {
    const pageText =
      "This is readable academic source content with definitions, evidence, relationships, and enough text to be useful. ".repeat(
        8,
      );

    const report = assessExtractionQuality({
      fileType: "pdf",
      content: pageText.repeat(2),
      pageCount: 10,
      pages: [
        { pageNumber: 1, rawText: pageText },
        { pageNumber: 10, rawText: pageText },
      ],
    });

    expect(report.status).toBe("failed");
    expect(
      report.reasons.some(
        (reason) => reason.code === "LOW_PAGE_COVERAGE",
      ),
    ).toBe(true);
  });

  it("detects broken Unicode replacement-character extraction", () => {
    const content =
      "Valid introductory text ".repeat(10) +
      "\uFFFD".repeat(80) +
      " supported source material ".repeat(10);

    const report = assessExtractionQuality({
      fileType: "docx",
      content,
    });

    expect(report.status).toBe("failed");
    expect(
      report.reasons.some(
        (reason) =>
          reason.code === "REPLACEMENT_CHARACTER_NOISE",
      ),
    ).toBe(true);
  });

  it("warns when the configured content limit was reached", () => {
    const content =
      "Grounded document evidence and study material. ".repeat(20);

    const report = assessExtractionQuality({
      fileType: "docx",
      content,
      maxContentLength: content.length,
    });

    expect(report.status).toBe("warning");
    expect(report.usable).toBe(true);
    expect(
      report.reasons.some(
        (reason) =>
          reason.code === "TRUNCATED_AT_CONTENT_LIMIT",
      ),
    ).toBe(true);
  });

  it("throws a FileError-compatible quality error only for failed reports", () => {
    const failed = assessExtractionQuality({
      fileType: "docx",
      content: "tiny",
    });

    expect(() => assertExtractionUsable(failed)).toThrow(
      ExtractionQualityError,
    );

    const good = assessExtractionQuality({
      fileType: "docx",
      content:
        "A sufficiently detailed source paragraph with concepts, evidence, examples, relationships, definitions, and explanatory content. ".repeat(
          8,
        ),
    });

    expect(() => assertExtractionUsable(good)).not.toThrow();
  });
});
