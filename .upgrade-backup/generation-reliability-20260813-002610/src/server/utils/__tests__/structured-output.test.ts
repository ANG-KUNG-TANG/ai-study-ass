import {
  parseJsonObject,
  parseStructuredArray,
} from "@/server/utils/structured-output";

interface TestCard {
  front: string;
  back: string;
}

function validateCard(value: unknown): TestCard | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.front !== "string" || typeof record.back !== "string") {
    return null;
  }

  return {
    front: record.front,

    back: record.back,
  };
}

describe("structured-output", () => {
  it("parses normal JSON", () => {
    const result = parseJsonObject(
      JSON.stringify({
        overview: "Hello",
      }),
    );

    expect(result.overview).toBe("Hello");
  });

  it("removes markdown fences", () => {
    const result = parseJsonObject('```json\n{"overview":"Hello"}\n```');

    expect(result.overview).toBe("Hello");
  });

  it("extracts JSON surrounded by prose", () => {
    const result = parseJsonObject('Result:\n{"overview":"Hello"}\nThanks');

    expect(result.overview).toBe("Hello");
  });

  it("removes trailing commas", () => {
    const result = parseJsonObject(
      `{
              "overview":
                "Hello",
            }`,
    );

    expect(result.overview).toBe("Hello");
  });

  it("recovers completed array items from truncated JSON", () => {
    const raw = `{
            "flashcards": [
              {
                "front": "A",
                "back": "B"
              },
              {
                "front": "C",
                "back": "D"
              },
              {
                "front": "broken",
                "back": "unfinished`;

    const result = parseStructuredArray(raw, "flashcards", validateCard);

    expect(result.recovered).toBe(true);

    expect(result.items).toEqual([
      {
        front: "A",

        back: "B",
      },

      {
        front: "C",

        back: "D",
      },
    ]);
  });

  it("drops invalid items without dropping valid items", () => {
    const raw = JSON.stringify({
      flashcards: [
        {
          front: "Valid",
          back: "Answer",
        },

        {
          front: 123,
          back: null,
        },

        {
          front: "Also valid",
          back: "Another answer",
        },
      ],
    });

    const result = parseStructuredArray(raw, "flashcards", validateCard);

    expect(result.items).toHaveLength(2);
  });
});
