import {
  canonicalStudyConceptKey,
  cleanStudyAnalysisText,
  isIncompleteStudyUnit,
  isStudyNoiseLine,
  looksLikeNavigationCluster,
  looksLikePersonName,
} from "@/server/intelligence/pipeline/source-hygiene";

describe("Intelligence source hygiene", () => {
  it.each([
    "CONTACT US",
    "Home Whiteboard Online Compilers Practice Articles AI Assistant",
    "Register Your Singapore Company Online – 100%",
    "Remote, Fast, and Foreign-Friendly",
    "The following figure shows an activity diagram of a portion of the Automated Trading",
    "SQL HTML CSS Javascript Python Java C C++ PHP Scala C#",
    "Student ID: 240702402543",
    "Course: DTI 411",
  ])("rejects non-learning source noise: %s", (value) => {
    expect(
      isStudyNoiseLine(value),
    ).toBe(true);
  });

  it.each([
    "Object-oriented analysis identifies software requirements in terms of interacting objects.",
    "TCP uses a 32-bit sequence number.",
    "Port 443 is commonly used for HTTPS.",
    "Register Customers",
    "State Transition Diagram",
    "Abstraction means focusing on essential features while ignoring accidental properties.",
  ])("keeps legitimate study content: %s", (value) => {
    expect(
      isStudyNoiseLine(value),
    ).toBe(false);
  });

  it.each([
    "The data stores that will be required are −",
    "There are two primary diagrams that are used for dynamic modelling −",
    "State, which is the situation at a particular condition during the lifetime of an object.",
    "Though the name and purpose of the methods in the classes are same, the internal.",
  ])("rejects incomplete standalone facts: %s", (value) => {
    expect(
      isIncompleteStudyUnit(value),
    ).toBe(true);
  });

  it("keeps complete subordinate-clause sentences", () => {
    expect(
      isIncompleteStudyUnit(
        "Although the diagram is compact, it still shows how the objects interact.",
      ),
    ).toBe(false);
  });

  it("canonicalizes simple concept aliases", () => {
    expect(
      canonicalStudyConceptKey(
        "State Machines",
      ),
    ).toBe("state machine");

    expect(
      canonicalStudyConceptKey(
        "Smart Door (SMART-DOOR)",
      ),
    ).toBe("smart door");
  });

  it("recognizes likely person names without treating technical labels as people", () => {
    expect(
      looksLikePersonName(
        "Grady Booch",
      ),
    ).toBe(true);

    expect(
      looksLikePersonName(
        "System Design",
      ),
    ).toBe(false);

    expect(
      looksLikePersonName(
        "Savings Account",
      ),
    ).toBe(false);
  });

  it("cleans noise while preserving technical content", () => {
    const cleaned =
      cleanStudyAnalysisText(`
SQL HTML CSS Javascript Python Java C C++ PHP Scala C#
CONTACT US
Object-Oriented Analysis (OOA) identifies software requirements in terms of interacting objects.
Register Your Singapore Company Online – 100%
Port 443 is commonly used for HTTPS.
`);

    expect(cleaned).toContain(
      "Object-Oriented Analysis",
    );
    expect(cleaned).toContain(
      "Port 443",
    );
    expect(cleaned).not.toContain(
      "CONTACT US",
    );
    expect(cleaned).not.toContain(
      "Singapore Company",
    );
    expect(
      looksLikeNavigationCluster(
        "Home Whiteboard Online Compilers Practice Articles AI Assistant",
      ),
    ).toBe(true);
  });
});
