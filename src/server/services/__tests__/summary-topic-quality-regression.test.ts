import {
  isSummaryTopicHeadingEligible,
} from "@/server/services/summary/summary-topic-learning.service";

describe("summary v3.2 learner topic qualification", () => {
  it("rejects source fragments that are supported but are not useful learner topics", () => {
    for (const heading of [
      "Data from previous projects",
      "The BN in Figure 1",
      "Many of the factors",
      "Toolset provided by AgenaRisk",
      "Two probabilities",
    ]) {
      expect(isSummaryTopicHeadingEligible(heading)).toBe(false);
    }
  });

  it("keeps real learner concepts and comparison topics eligible", () => {
    for (const heading of [
      "Causal Model",
      "Bayesian Network",
      "Testing and Rework",
      "Incremental and Waterfall Models",
      "Phase BN",
    ]) {
      expect(isSummaryTopicHeadingEligible(heading)).toBe(true);
    }
  });
});
