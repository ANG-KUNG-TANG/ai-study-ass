import type {
  CaseScenario,
  CaseStudyProfile,
  FinancialFrequency,
  FinancialInput,
  FinancialUnit,
} from "./types";
import { normaliseLine } from "./text-quality";

interface PatternDefinition {
  label: string;
  regex: RegExp;
  unit: FinancialUnit;
  frequency: FinancialFrequency;
  confidence?: number;
}

const PATTERNS: PatternDefinition[] = [
  { label: "Brewpub system cost", regex: /brewpub\s+system[^$\n]{0,90}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Construction and preparation cost", regex: /(?:construction|preparation)[^$\n]{0,110}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Initial licence fee", regex: /initial\s+licen[cs]e\s+fee[^$\n]{0,70}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Initial media-company fee", regex: /(?:media(?:-company)?\s+fee|media company)[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Initial working capital", regex: /(?:initial\s+)?(?:net\s+)?working\s+capital[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Market research cost", regex: /market\s+research[^$\n]{0,90}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Selling price per pint", regex: /(?:selling\s+price|price)[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)[^\n]{0,40}per\s+pint/i, unit: "USD", frequency: "once" },
  { label: "Ingredient cost", regex: /ingredient\s+cost[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "unknown" },
  { label: "Monthly rent", regex: /rent[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)[^\n]{0,40}(?:month|monthly)/i, unit: "USD", frequency: "monthly" },
  { label: "Annual maintenance", regex: /maintenance[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)[^\n]{0,40}(?:annual|year)/i, unit: "USD", frequency: "yearly" },
  { label: "Brewery operator salary", regex: /(?:brewery\s+operator|operator\s+salary)[^$\n]{0,100}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "yearly" },
  { label: "Additional insurance", regex: /insurance[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "yearly" },
  { label: "Additional utilities", regex: /utilities[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "yearly" },
  { label: "Licence renewal", regex: /licen[cs]e\s+renewal[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "yearly" },
  { label: "Annual advertising", regex: /advertising[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "yearly" },
  { label: "Salvage value", regex: /salvage\s+value[^$\n]{0,80}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Renovation capital expenditure", regex: /(?:renovation|capital\s+expenditure)[^$\n]{0,120}\$\s*([\d,]+(?:\.\d+)?)/i, unit: "USD", frequency: "once" },
  { label: "Tax rate", regex: /tax\s+rate[^\d%\n]{0,40}(\d+(?:\.\d+)?)\s*%/i, unit: "percent", frequency: "yearly" },
  { label: "Cost of capital", regex: /cost\s+of\s+capital[^\d%\n]{0,50}(\d+(?:\.\d+)?)\s*%/i, unit: "percent", frequency: "yearly" },
  { label: "Project life", regex: /(?:economic\s+life|project\s+life|over)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*years?/i, unit: "years", frequency: "once" },
  { label: "Restaurant seats", regex: /(\d+(?:\.\d+)?)\s*-?seat\s+(?:restaurant|cafe|café)/i, unit: "seats", frequency: "once" },
  { label: "Best-case barrels per seat", regex: /best[- ]case[^\n]{0,120}?(\d+(?:\.\d+)?)\s+barrels?\s+per\s+seat/i, unit: "barrels", frequency: "yearly" },
  { label: "Worst-case barrels per seat", regex: /worst[- ]case[^\n]{0,120}?(\d+(?:\.\d+)?)\s+barrels?\s+per\s+seat/i, unit: "barrels", frequency: "yearly" },
  { label: "Gallons per barrel", regex: /(?:one|1)\s+barrel[^\n]{0,70}?(\d+(?:\.\d+)?)\s+gallons?/i, unit: "gallons", frequency: "once" },
  { label: "Pints per gallon", regex: /(?:one|1)\s+gallon[^\n]{0,70}?(\d+(?:\.\d+)?)\s+pints?/i, unit: "pints", frequency: "once" },
];

function parseNumber(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function sentenceForMatch(text: string, index: number): string {
  const before = text.lastIndexOf(".", index);
  const lineBefore = text.lastIndexOf("\n", index);
  const start = Math.max(before, lineBefore) + 1;
  const dotAfter = text.indexOf(".", index);
  const lineAfter = text.indexOf("\n", index);
  const possibleEnds = [dotAfter, lineAfter].filter((value) => value >= 0);
  const end = possibleEnds.length > 0 ? Math.min(...possibleEnds) + 1 : Math.min(text.length, index + 320);
  return normaliseLine(text.slice(start, end));
}

function pageForEvidence(rawText: string, evidence: string): number | undefined {
  const pages = rawText.split(/\f+/);
  if (pages.length <= 1) return undefined;
  const needle = evidence.slice(0, 45).toLowerCase();
  const pageIndex = pages.findIndex((page) => page.toLowerCase().includes(needle));
  return pageIndex >= 0 ? pageIndex + 1 : undefined;
}

function inferGrowthRate(evidence: string): number | undefined {
  const match = evidence.match(/(?:increase|grow|rise)[^\d%]{0,35}(\d+(?:\.\d+)?)\s*%/i);
  return match ? parseNumber(match[1]) : undefined;
}

function inferStartYear(evidence: string): number | undefined {
  const match = evidence.match(/year\s+(\d+)/i);
  return match ? parseNumber(match[1]) : undefined;
}

function extractInputs(text: string, rawText: string): FinancialInput[] {
  const output: FinancialInput[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(text);
    if (!match?.[1]) continue;

    const value = parseNumber(match[1]);
    if (!Number.isFinite(value)) continue;

    const evidence = sentenceForMatch(text, match.index);
    const key = `${pattern.label}:${value}:${pattern.unit}`;
    if (seen.has(key)) continue;
    seen.add(key);

    output.push({
      label: pattern.label,
      value,
      unit: pattern.unit,
      frequency: pattern.frequency,
      growthRate: inferGrowthRate(evidence),
      startYear: inferStartYear(evidence),
      evidence,
      evidencePage: pageForEvidence(rawText, evidence),
      confidence: pattern.confidence ?? 0.94,
    });
  }

  return output;
}

function inputValue(inputs: FinancialInput[], label: string): number | undefined {
  return inputs.find((input) => input.label === label)?.value;
}

function deriveCalculations(inputs: FinancialInput[]): FinancialInput[] {
  const seats = inputValue(inputs, "Restaurant seats");
  const gallons = inputValue(inputs, "Gallons per barrel");
  const pintsPerGallon = inputValue(inputs, "Pints per gallon");
  const bestBarrels = inputValue(inputs, "Best-case barrels per seat");
  const worstBarrels = inputValue(inputs, "Worst-case barrels per seat");
  const price = inputValue(inputs, "Selling price per pint");
  const output: FinancialInput[] = [];

  if (gallons && pintsPerGallon) {
    output.push({
      label: "Pints per barrel",
      value: gallons * pintsPerGallon,
      unit: "pints",
      frequency: "once",
      evidence: "Derived from gallons per barrel and pints per gallon.",
      confidence: 0.99,
      derived: true,
      formula: `${gallons} gallons × ${pintsPerGallon} pints`,
    });
  }

  const pintsPerBarrel = output.find((input) => input.label === "Pints per barrel")?.value;

  for (const scenario of [
    { label: "Best-case first-year volume", barrels: bestBarrels },
    { label: "Worst-case first-year volume", barrels: worstBarrels },
  ]) {
    if (!seats || !scenario.barrels || !pintsPerBarrel) continue;
    const volume = seats * scenario.barrels * pintsPerBarrel;
    output.push({
      label: scenario.label,
      value: volume,
      unit: "pints",
      frequency: "yearly",
      evidence: "Derived from seats, barrels per seat, and pints per barrel.",
      confidence: 0.99,
      derived: true,
      formula: `${seats} seats × ${scenario.barrels} barrels × ${pintsPerBarrel} pints`,
    });

    if (price) {
      output.push({
        label: scenario.label.replace("volume", "revenue"),
        value: volume * price,
        unit: "USD",
        frequency: "yearly",
        evidence: "Derived from first-year volume and selling price per pint.",
        confidence: 0.99,
        derived: true,
        formula: `${volume} pints × $${price}`,
      });
    }
  }

  return output;
}

function decisionProblem(text: string): string | null {
  const sentence = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normaliseLine)
    .find((candidate) =>
      /\b(should|whether|decide|considering)\b/i.test(candidate) &&
      /\b(invest|investment|project|brewpub|expand)\b/i.test(candidate),
    );

  return sentence ?? null;
}

function actors(text: string): string[] {
  const output = new Set<string>();
  const ownerMatch = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+and\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
  if (ownerMatch?.[1]) output.add(ownerMatch[1]);
  if (ownerMatch?.[2]) output.add(ownerMatch[2]);

  const organisation = text.match(/([A-Z][A-Za-z&'’.-]+(?:\s+[A-Z][A-Za-z&'’.-]+){0,3}\s+(?:Caf[eé]|Cafe|Restaurant|Company))(?=\s|[,.!?]|$)/);
  if (organisation?.[1]) output.add(organisation[1]);

  return [...output];
}

function scenarios(text: string): CaseScenario[] {
  const output: CaseScenario[] = [];
  const definitions: Array<{ name: string; regex: RegExp }> = [
    { name: "Best-case scenario", regex: /best[- ]case/i },
    { name: "Worst-case scenario", regex: /worst[- ]case/i },
    { name: "Renovation scenario", regex: /renovation|year\s+5[^\n]{0,100}\$\s*1,?000,?000/i },
    { name: "Cost-of-capital sensitivity", regex: /sensitivity\s+analysis|different\s+costs?\s+of\s+capital/i },
  ];

  for (const definition of definitions) {
    const match = definition.regex.exec(text);
    if (!match) continue;
    const evidence = sentenceForMatch(text, match.index);
    output.push({
      name: definition.name,
      changes: [evidence].filter(Boolean),
      evidence: [evidence].filter(Boolean),
      confidence: 0.9,
    });
  }

  return output;
}

function requiredCalculations(text: string): string[] {
  const lower = text.toLowerCase();
  const checks: Array<[string, RegExp]> = [
    ["Annual revenue", /revenue|selling price/],
    ["Annual operating expenses", /operating expenses?|costs?/],
    ["Depreciation", /depreciation/],
    ["Taxes", /tax rate|taxes/],
    ["Operating cash flow", /operating cash flow/],
    ["Initial investment", /initial investment|capital expenditure/],
    ["Working-capital changes", /working capital/],
    ["Terminal cash flow", /terminal cash flow|salvage value/],
    ["Net Present Value (NPV)", /\bnpv\b|net present value/],
    ["Internal Rate of Return (IRR)", /\birr\b|internal rate of return/],
  ];

  return checks.filter(([, regex]) => regex.test(lower)).map(([label]) => label);
}

function unresolvedAssumptions(text: string, inputs: FinancialInput[]): string[] {
  const output: string[] = [];
  const rents = [...text.matchAll(/\$\s*([\d,]+)[^\n]{0,30}(?:month|monthly)/gi)]
    .map((match) => parseNumber(match[1]))
    .filter(Number.isFinite);

  if (new Set(rents).size > 1) {
    output.push("The monthly rent assumption has more than one possible value and must be selected explicitly.");
  }

  const hasConstruction = inputs.some((input) => input.label.includes("Construction"));
  if (hasConstruction && /straight[- ]line depreciation/i.test(text) && !/construction[^.]{0,100}depreci/i.test(text)) {
    output.push("The depreciation treatment of construction expenditure is not stated clearly.");
  }

  if (/market research/i.test(text) && !/sunk cost/i.test(text)) {
    output.push("The completed market-research cost should be reviewed as a possible sunk cost.");
  }

  return output;
}

export function extractFinancialCaseStudy(
  cleanedText: string,
  rawText: string,
): CaseStudyProfile {
  const financialInputs = extractInputs(cleanedText, rawText);
  const derivedCalculations = deriveCalculations(financialInputs);
  const lower = cleanedText.toLowerCase();
  const methodParts = [
    /cash flow/.test(lower) ? "operating and incremental cash flows" : "cash-flow analysis",
    /\bnpv\b|net present value/.test(lower) ? "NPV" : "",
    /\birr\b|internal rate of return/.test(lower) ? "IRR" : "",
    /scenario analysis|best[- ]case|worst[- ]case/.test(lower) ? "scenario analysis" : "",
    /sensitivity analysis/.test(lower) ? "sensitivity analysis" : "",
  ].filter(Boolean);

  return {
    decisionProblem: decisionProblem(cleanedText),
    actors: actors(cleanedText),
    method: `Capital-budgeting analysis using ${methodParts.join(", ")}.`,
    financialInputs,
    scenarios: scenarios(cleanedText),
    requiredCalculations: requiredCalculations(cleanedText),
    unresolvedAssumptions: unresolvedAssumptions(cleanedText, financialInputs),
    derivedCalculations,
  };
}
