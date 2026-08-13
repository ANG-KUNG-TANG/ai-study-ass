import {
  buildFlashcardsFromSource,
  buildQuestionsFromSource,
  retrieveRelevantExcerpts,
} from "@/server/services/symbolic-content.service";

const DOCUMENT = `
Introduction
Machine Learning is a computational approach that learns patterns from data and uses those patterns to make predictions on unseen examples.
Supervised Learning is a learning setting where labeled examples are used to train a predictive model for a defined target variable.
Classification is a predictive task that assigns an input example to one of several predefined categories using learned decision boundaries.
Regression is a predictive task that estimates a continuous numerical value from one or more explanatory variables in the input data.
Precision is an evaluation metric that measures the proportion of predicted positive cases that are actually positive in the labeled dataset.
Recall is an evaluation metric that measures the proportion of actual positive cases that are successfully identified by the predictive model.
F1 Score is a harmonic mean of precision and recall that provides a balanced measure when both types of error matter.
Cross Validation is an evaluation procedure that repeatedly trains and tests a model on different partitions of the available dataset.
Gradient Descent is an optimization algorithm that iteratively updates model parameters to reduce the value of a differentiable loss function.
Regularization is a technique that penalizes excessive model complexity in order to improve generalization to unseen examples.
Feature Engineering is the process of creating or transforming input variables to represent useful predictive information more effectively.
Model Selection is the process of comparing candidate models and choosing the one that best satisfies the evaluation criteria.
Conclusion
The study emphasizes careful evaluation, representative data, and reproducible model selection when developing predictive systems for practical use.
`;

describe("symbolic-content.service", () => {
  it("creates diverse flashcard fronts instead of collapsing generic cards", () => {
    const cards = buildFlashcardsFromSource(DOCUMENT, 10);
    const fronts = new Set(cards.map((card) => card.front.toLowerCase()));

    expect(cards.length).toBeGreaterThanOrEqual(8);
    expect(fronts.size).toBe(cards.length);
  });

  it("creates valid symbolic quiz questions", () => {
    const questions = buildQuestionsFromSource(
      DOCUMENT,
      8,
      ["multiple_choice", "true_false", "short_answer"],
    );

    expect(questions.length).toBeGreaterThanOrEqual(6);
    expect(questions.every((question) => question.question.trim().length > 0)).toBe(
      true,
    );
  });

  it("retrieves relevant evidence from the document", () => {
    const excerpts = retrieveRelevantExcerpts(
      DOCUMENT,
      "How does gradient descent optimize a model?",
      2,
    );

    expect(excerpts.join(" ").toLowerCase()).toContain("gradient descent");
  });
});
