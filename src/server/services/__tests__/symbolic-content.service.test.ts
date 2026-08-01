import {
  buildFlashcardsFromSource,
  buildQuestionsFromSource,
  buildSymbolicChatAnswer,
  buildSymbolicSummary,
  extractDefinitions,
} from "@/server/services/symbolic-content.service";

const SOURCE = `
1 Introduction

Software defect prediction is a classification process that predicts whether a
software module is defective or clean. Class imbalance means one class contains
far more examples than another class. SMOTE is an oversampling technique that
creates synthetic minority-class examples.

2 Methodology

The study compares random undersampling, SMOTE, and class balancing. The
evaluation uses precision, recall, F1 score, and ROC.
`;

describe("symbolic-content.service", () => {
  it("extracts definitions without AI", () => {
    const definitions = extractDefinitions(SOURCE);

    expect(definitions.length).toBeGreaterThan(0);
    expect(
      definitions.some((item) =>
        item.term.toLowerCase().includes("smote"),
      ),
    ).toBe(true);
  });

  it("builds a usable symbolic summary", () => {
    const result = buildSymbolicSummary(
      undefined,
      SOURCE,
      "Software Defect Prediction",
    );

    expect(result.summary).toContain(
      "Software Defect Prediction",
    );
    expect(result.keyPoints.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("builds quiz questions from source text", () => {
    const questions = buildQuestionsFromSource(
      SOURCE,
      5,
      ["short_answer", "true_false"],
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(
      questions.every((question) =>
        ["short_answer", "true_false"].includes(
          question.questionType,
        ),
      ),
    ).toBe(true);
  });

  it("builds flashcards from source text", () => {
    const cards = buildFlashcardsFromSource(
      SOURCE,
      5,
    );

    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].front).toBeTruthy();
    expect(cards[0].back).toBeTruthy();
  });

  it("answers direct document questions symbolically", () => {
    const result = buildSymbolicChatAnswer(
      {
        method: "Random undersampling",
        dataset: "PROMISE",
        accuracy: 82,
        problem: "Class imbalance",
        contributions: [],
        keyPoints: [],
        entities: [],
        extras: {},
      } as never,
      SOURCE,
      "Which dataset is used?",
    );

    expect(result.text).toBe("PROMISE");
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});
