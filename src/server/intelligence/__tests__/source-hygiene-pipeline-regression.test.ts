import {
  runPipeline,
} from "@/server/intelligence/pipeline";

const NOISY_OOAD_SOURCE = `
SQL HTML CSS Javascript Python Java C C++ PHP Scala C#

OOAD - Quick Guide

BBCIncorp
Register Your Singapore Company Online – 100%
Remote, Fast, and Foreign-Friendly

CONTACT US

Object-Oriented Analysis
Object-Oriented Analysis (OOA) is the procedure of identifying software engineering requirements in terms of a software system's object model.

Home Whiteboard Online Compilers Practice Articles AI Assistant
The main difference between object-oriented analysis and other forms of analysis is that requirements are organized around objects that integrate both data and functions.

Dynamic Modelling
There are two primary diagrams that are used for dynamic modelling −
Interaction diagrams depict interactions of objects and their relationships.
State transition diagrams describe the dynamic behavior of a single object.

Example
The following figure shows an activity diagram of a portion of the Automated Trading

State Machine
A state machine represents the changing states of an object in response to events.

State Machines
State machines describe dynamic behavior by showing states and transitions.

System Design
System design defines the context and architecture of the desired system.

Grady Booch
In Grady Booch's words, hierarchy is the ranking or ordering of abstraction.
`;

describe("source hygiene pipeline regression", () => {
  const result =
    runPipeline({
      rawText: NOISY_OOAD_SOURCE,
      fileName: "ooad-quick-guide.pdf",
      mimeType: "application/pdf",
      fileSize: Buffer.byteLength(
        NOISY_OOAD_SOURCE,
      ),
    });

  it("marks regenerated knowledge with the hygiene-aware pipeline version", () => {
    expect(
      result.grounding.pipelineVersion,
    ).toBe("intelligence-v2.7");
  });

  it("removes navigation, promotion, and presentation artifacts before NLP knowledge extraction", () => {
    const nlpText =
      result.nlp.sentences
        .map((sentence) => sentence.text)
        .join("\n");

    expect(nlpText).not.toMatch(
      /BBCIncorp|CONTACT US|Singapore Company|Foreign-Friendly|Whiteboard Online Compilers/i,
    );
    expect(nlpText).not.toMatch(
      /following figure shows an activity diagram/i,
    );
    expect(nlpText).toContain(
      "Object-Oriented Analysis",
    );
  });

  it("does not promote incomplete parent statements into grounded facts", () => {
    const factText =
      result.grounding.facts
        .map((fact) => fact.content)
        .join("\n");

    expect(factText).not.toContain(
      "There are two primary diagrams that are used for dynamic modelling −",
    );
    expect(factText).toContain(
      "Interaction diagrams depict interactions of objects and their relationships.",
    );
  });

  it("removes empty/noisy headings and exact duplicate generic sections", () => {
    const headings =
      result.document.sections
        .map((section) => section.rawHeading);

    expect(headings).not.toEqual(
      expect.arrayContaining([
        "BBCIncorp",
        "CONTACT US",
        "Home Whiteboard Online Compilers Practice Articles AI Assistant",
        "Example",
      ]),
    );
  });

  it("deduplicates singular/plural concept aliases and rejects likely person-name concepts", () => {
    const concepts =
      result.grounding.concepts
        .map((concept) => concept.name);

    const stateMachineAliases =
      concepts.filter((concept) =>
        /^state machines?$/i.test(
          concept,
        ),
      );

    expect(
      stateMachineAliases.length,
    ).toBeLessThanOrEqual(1);

    expect(concepts).not.toContain(
      "Grady Booch",
    );
    expect(concepts).not.toContain(
      "Figure Shows",
    );
  });

  it("does not use the navigation language cluster as the resolved document title", () => {
    expect(
      result.reliabilityProfile
        .title.value,
    ).not.toMatch(
      /^SQL HTML CSS Javascript Python Java/i,
    );
  });
});
