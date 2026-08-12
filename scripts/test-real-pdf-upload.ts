import fs from "node:fs/promises";
import path from "node:path";

import { processUpload } from "@/server/services/upload.service";

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error(
      "Usage: npx tsx scripts/test-real-pdf-upload.ts <path-to-pdf>",
    );
  }

  const absolutePath = path.resolve(inputPath);

  const buffer = await fs.readFile(absolutePath);

  const fileName = path.basename(absolutePath);

  console.log("\n================================");
  console.log("REAL PDF PIPELINE TEST");
  console.log("================================");

  console.log("File:", fileName);
  console.log("Size:", `${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  const startedAt = Date.now();

  const result = await processUpload({
    buffer,
    originalName: fileName,
    mimeType: "application/pdf",
    size: buffer.length,
  });

  const elapsedMs = Date.now() - startedAt;

  console.log("\n================================");
  console.log("RESULT");
  console.log("================================");

  console.log({
    fileName: result.fileName,
    fileType: result.fileType,
    fileSize: result.fileSize,

    pageCount: result.pageCount,
    charCount: result.charCount,

    extractionQuality: result.extractionQuality,

    charsPerPage: result.charsPerPage,

    requiresVisionFallback: result.requiresVisionFallback,

    visionFallbackUsed: result.visionFallbackUsed,

    elapsedMs,
  });

  console.log("\n================================");
  console.log("CONTENT PREVIEW");
  console.log("================================\n");

  console.log(result.content.slice(0, 5000));

  console.log("\n================================");
  console.log(`Total content length: ${result.content.length}`);
}

main().catch((error) => {
  console.error("\n❌ REAL PDF TEST FAILED\n");

  console.error(error instanceof Error ? error.stack : error);

  process.exit(1);
});
