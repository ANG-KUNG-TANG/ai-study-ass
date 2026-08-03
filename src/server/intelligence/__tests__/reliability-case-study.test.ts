import assert from "node:assert/strict";
import { runPipeline } from "../pipeline";

const corruptHeader = "ͺΟΥΖΣΟΒΥΚΠΟΒΝ ΃ΖΤΖΒΣΔΙ ͻΠΦΣΟΒΝ ΠΗ AΡΡΝΚΖΕ FΚΟΒΟΔΖ";

const caseText = [
  `${corruptHeader}\nCase Study Series Case Study Series Case\nPage 1\nExplore Café is an 80-seat restaurant owned by Samantha Myers and Grant Patrick. They are considering installing a brewpub system. Should Explore Café invest in the proposed brewpub system? The project must be evaluated using incremental cash flow, net present value (NPV), internal rate of return (IRR), scenario analysis and sensitivity analysis.`,
  `${corruptHeader}\nPage 2\nThe brewpub system costs $300,000. Construction and preparation may cost up to $250,000. The initial licence fee is $65,000. The initial media-company fee is $20,000. Initial working capital is $10,000. Market research already completed cost $2,000. The project has an economic life of 10 years, a salvage value of $20,000, a tax rate of 30%, and a cost of capital of 8%. Straight-line depreciation is used.`,
  `${corruptHeader}\nPage 3\nOne barrel contains 31 gallons. One gallon contains 8 pints. In the best-case scenario demand is 7 barrels per seat per year. In the worst-case scenario demand is 5 barrels per seat per year. The selling price is $5 per pint and increases by 3% per year. Ingredient cost is $4,000 per 10 barrels and grows by 5% per year.`,
  `${corruptHeader}\nPage 4\nRent is $3,000 monthly, although it may be negotiated to $2,500 monthly. Maintenance is $15,000 annually after the first year. The brewery operator salary is $40,000 per year. Additional insurance is $3,000 annually. Additional utilities are $24,000 annually. Licence renewal is $700 annually. Advertising is $80,000 annually.`,
  `${corruptHeader}\nPage 5\nThe best-case and worst-case scenarios require annual revenue, operating expenses, depreciation, taxes, operating cash flow, terminal cash flow, NPV and IRR. A renovation scenario in Year 5 requires an additional capital expenditure of $1,000,000 and changes the selling price to $7 per pint. Sensitivity analysis should compare different costs of capital. References`,
].join("\f");

const result = runPipeline({
  rawText: caseText,
  fileName: "Case Study Series Case Study Series Case.pdf",
  mimeType: "application/pdf",
  fileSize: 12_000,
  pageCount: 5,
});

assert.equal(result.profile.classification.kind, "case_study");
assert.equal(result.profile.classification.domain, "finance");
assert.equal(result.profile.classification.taskType, "capital_budgeting_decision");
assert.match(result.profile.title.value, /Explore Café Brewpub Investment Case Study/i);
assert.equal(result.profile.title.generated, true);
assert.ok(!result.document.cleanText.includes(corruptHeader));
assert.ok(!result.profile.concepts.some((concept) => ["future", "per year", "best case", "this", "she"].includes(concept.normalized)));
assert.ok(result.profile.concepts.some((concept) => /Net Present Value/.test(concept.term)));
assert.ok(result.profile.caseStudy);
assert.ok(result.profile.caseStudy!.financialInputs.length >= 12);
assert.equal(
  result.profile.caseStudy!.derivedCalculations.find((item) => item.label === "Best-case first-year revenue")?.value,
  694_400,
);
assert.equal(
  result.profile.caseStudy!.derivedCalculations.find((item) => item.label === "Worst-case first-year revenue")?.value,
  496_000,
);
assert.ok(result.profile.coverage.presentFields.includes("npv"));
assert.ok(result.profile.coverage.presentFields.includes("irr"));
assert.ok(result.profile.qualityScore >= 0.85, `Expected >= 0.85, received ${result.profile.qualityScore}`);
assert.equal(result.profile.status, "ready");
assert.match(result.knowledge.method ?? "", /Capital-budgeting analysis/i);

console.log(`case-study reliability score: ${result.profile.qualityScoreOutOf10}/10`);
