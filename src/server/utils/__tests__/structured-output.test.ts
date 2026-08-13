import {
  parseJsonObject,
  parseStructuredArray,
} from "@/server/utils/structured-output";

interface TestCard {
  front: string;
  back: string;
}

function validateCard(value: unknown): TestCard | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (typeof record.front !== "string" || typeof record.back !== "string") {
    return null;
  }

  return { front: record.front, back: record.back };
}

describe("structured-output", () => {
  it("parses normal JSON", () => {
    expect(parseJsonObject('{"overview":"Hello"}').overview).toBe("Hello");
  });

  it("removes markdown fences", () => {
    expect(
      parseJsonObject('```json\n{"overview":"Hello"}\n```').overview,
    ).toBe("Hello");
  });

  it("extracts JSON surrounded by prose", () => {
    expect(parseJsonObject('Result:\n{"overview":"Hello"}\nThanks').overview).toBe(
      "Hello",
    );
  });

  it("removes trailing commas", () => {
    expect(parseJsonObject('{"overview":"Hello",}').overview).toBe("Hello");
  });

  it("recovers completed array items from truncated JSON", () => {
    const raw = `{
      "flashcards": [
        {"front":"A","back":"B"},
        {"front":"C","back":"D"},
        {"front":"broken","back":"unfinished
    `;

    const result = parseStructuredArray(raw, "flashcards", validateCard);

    expect(result.recovered).toBe(true);
    expect(result.items).toEqual([
      { front: "A", back: "B" },
      { front: "C", back: "D" },
    ]);
  });

  it("drops invalid items without dropping valid items", () => {
    const raw = JSON.stringify({
      flashcards: [
        { front: "Valid", back: "Answer" },
        { front: 123, back: null },
        { front: "Also valid", back: "Another answer" },
      ],
    });

    expect(parseStructuredArray(raw, "flashcards", validateCard).items).toHaveLength(
      2,
    );
  });
});
