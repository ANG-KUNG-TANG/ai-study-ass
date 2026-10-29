import { describe, expect, it } from "@jest/globals";
import { PrologEngine } from "./prolog.engine";
import { InMemoryKnowledgeGraph } from "../graph/graph.engine";

describe("PrologEngine", () => {
  it("loads a graph and resolves a direct method fact", async () => {
    const graph = new InMemoryKnowledgeGraph();

    graph.addNode({
      id: "paper:note1",
      type: "paper",
      label: "Test Paper",
    });

    graph.addNode({
      id: "method:resnet",
      type: "method",
      label: "ResNet",
    });

    graph.addEdge({
      from: "paper:note1",
      to: "method:resnet",
      type: "uses",
      weight: 1,
    });

    const engine = new PrologEngine();
    await engine.load(graph, "note1");

    const result = await engine.query("method(note1, X)");

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0].bindings.X).toBe("resnet");
    expect(result.confidence).toBe(1);
    expect(result.resolvedBy).toBe("prolog");
  });

  it("infers a relationship using a Prolog rule", async () => {
    const graph = new InMemoryKnowledgeGraph();

    graph.addNode({
      id: "method:resnet",
      type: "method",
      label: "ResNet",
    });

    graph.addNode({
      id: "concept:computer_vision",
      type: "concept",
      label: "Computer Vision",
    });

    graph.addEdge({
      from: "method:resnet",
      to: "concept:computer_vision",
      type: "is_a",
      weight: 1,
    });

    const engine = new PrologEngine();
    await engine.load(graph, "note1");

    const result = await engine.query("belongs_to(resnet, computer_vision)");

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0].evidence).toContainEqual({
      functor: "is_a",
      args: ["resnet", "computer_vision"],
    });
    expect(result.confidence).toBe(0.7);
    expect(result.resolvedBy).toBe("prolog");
  });

  it("returns zero confidence and fallback when no answer exists", async () => {
    const graph = new InMemoryKnowledgeGraph();

    graph.addNode({
      id: "paper:note1",
      type: "paper",
      label: "Test Paper",
    });

    graph.addNode({
      id: "method:resnet",
      type: "method",
      label: "ResNet",
    });

    graph.addEdge({
      from: "paper:note1",
      to: "method:resnet",
      type: "uses",
      weight: 1,
    });

    const engine = new PrologEngine();
    await engine.load(graph, "note1");

    const result = await engine.query("method(note1, missing_method)");

    expect(result.answers).toHaveLength(0);
    expect(result.confidence).toBe(0);
    expect(result.resolvedBy).toBe("fallback");
  });

  it("extracts accuracy from a reported result node", async () => {
    const graph = new InMemoryKnowledgeGraph();

    graph.addNode({
      id: "paper:note1",
      type: "paper",
      label: "Test Paper",
    });

    graph.addNode({
      id: "claim:result1",
      type: "result",
      label: "96 percent accuracy",
      properties: {
        claimType: "result",
        numericValue: 96,
        metric: "accuracy",
      },
    });

    graph.addEdge({
      from: "paper:note1",
      to: "claim:result1",
      type: "reports",
      weight: 1,
    });

    const engine = new PrologEngine();
    await engine.load(graph, "note1");

    expect(engine.getFacts()).toContainEqual({
      functor: "accuracy",
      args: ["note1", "96"],
    });
  });

  it("does not attach unrelated facts merely because they share a query value", async () => {
    const graph = new InMemoryKnowledgeGraph();

    graph.addNode({
      id: "method:resnet",
      type: "method",
      label: "ResNet",
    });

    graph.addNode({
      id: "concept:computer_vision",
      type: "concept",
      label: "Computer Vision",
    });

    graph.addNode({
      id: "concept:image_processing",
      type: "concept",
      label: "Image Processing",
    });

    graph.addEdge({
      from: "method:resnet",
      to: "concept:computer_vision",
      type: "is_a",
      weight: 1,
    });

    graph.addEdge({
      from: "concept:computer_vision",
      to: "concept:image_processing",
      type: "is_a",
      weight: 1,
    });

    const engine = new PrologEngine();
    await engine.load(graph, "note1");

    const result = await engine.query("belongs_to(resnet, computer_vision)");

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0].evidence).toContainEqual({
      functor: "is_a",
      args: ["resnet", "computer_vision"],
    });
    expect(result.answers[0].evidence).not.toContainEqual({
      functor: "is_a",
      args: ["computer_vision", "image_processing"],
    });
  });

  it("includes only the facts on a recursive belongs_to evidence path", async () => {
    const graph = new InMemoryKnowledgeGraph();

    graph.addNode({
      id: "method:resnet",
      type: "method",
      label: "ResNet",
    });

    graph.addNode({
      id: "concept:computer_vision",
      type: "concept",
      label: "Computer Vision",
    });

    graph.addNode({
      id: "concept:artificial_intelligence",
      type: "concept",
      label: "Artificial Intelligence",
    });

    graph.addNode({
      id: "concept:image_processing",
      type: "concept",
      label: "Image Processing",
    });

    // Valid path: ResNet -> Computer Vision -> Artificial Intelligence.
    graph.addEdge({
      from: "method:resnet",
      to: "concept:computer_vision",
      type: "is_a",
      weight: 1,
    });

    graph.addEdge({
      from: "concept:computer_vision",
      to: "concept:artificial_intelligence",
      type: "is_a",
      weight: 1,
    });

    // Unrelated branch: this must not appear in the evidence.
    graph.addEdge({
      from: "concept:computer_vision",
      to: "concept:image_processing",
      type: "is_a",
      weight: 1,
    });

    const engine = new PrologEngine();
    await engine.load(graph, "note1");

    const result = await engine.query(
      "belongs_to(resnet, artificial_intelligence)",
    );

    expect(result.answers).toHaveLength(1);

    expect(result.answers[0].evidence).toContainEqual({
      functor: "is_a",
      args: ["resnet", "computer_vision"],
    });

    expect(result.answers[0].evidence).toContainEqual({
      functor: "is_a",
      args: ["computer_vision", "artificial_intelligence"],
    });

    expect(result.answers[0].evidence).not.toContainEqual({
      functor: "is_a",
      args: ["computer_vision", "image_processing"],
    });
  });
});
