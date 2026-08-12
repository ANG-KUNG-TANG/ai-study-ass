import { readFile, writeFile, mkdir } from "node:fs/promises";
import { renderPdfPages } from "../src/server/services/pdf-render.service";

async function main() {
  console.log("Reading PDF...");

  const buffer = await readFile("./DTI324-Chapter7.pdf");

  console.log(`PDF loaded: ${buffer.length} bytes`);
  console.log("Rendering pages 1, 5, and 10...");

  const pages = await renderPdfPages(buffer, [1, 5, 10]);

  await mkdir("./tmp/pdf-render-test", {
    recursive: true,
  });

  for (const page of pages) {
    const outputPath =
      `./tmp/pdf-render-test/page-${page.pageNumber}.png`;

    await writeFile(outputPath, page.buffer);

    console.log(
      `✅ Page ${page.pageNumber}: ${page.buffer.length} bytes → ${outputPath}`,
    );
  }

  console.log(`\nRendered ${pages.length} pages.`);
}

main().catch((error) => {
  console.error("❌ PDF rendering test failed:");
  console.error(error);
  process.exit(1);
});
