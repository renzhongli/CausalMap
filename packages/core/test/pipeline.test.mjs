import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCausalMap } from "../dist/pipeline.js";

function makeSampleGraph() {
  return {
    nodes: [
      { id: "a", timestamp: 0, label: "Topic A", sentiment: "positive" },
      { id: "b", timestamp: 1, label: "Topic B", sentiment: "negative" },
      { id: "c", timestamp: 2, label: "Topic C", sentiment: "neutral" },
      { id: "d", timestamp: 3, label: "Topic D", sentiment: "positive" },
      { id: "e", timestamp: 4, label: "Topic E", sentiment: "negative" },
      { id: "f", timestamp: 5, label: "Topic F", sentiment: "neutral" },
    ],
    edges: [
      { source: "a", target: "b", weight: 0.8 },
      { source: "b", target: "c", weight: 0.6 },
      { source: "c", target: "d", weight: 0.5 },
      { source: "d", target: "e", weight: 0.7 },
      { source: "a", target: "f", weight: 0.4 },
    ],
    clusters: [
      [["a", "b"], ["c", "d"], ["e", "f"]],
      [["a", "b", "c", "d", "e", "f"]],
    ],
  };
}

describe("generateCausalMap (pipeline)", () => {
  it("returns a complete MapLayout", () => {
    const layout = generateCausalMap(makeSampleGraph());
    assert.ok(layout.nodePositions, "should have nodePositions");
    assert.ok(layout.nodeCells, "should have nodeCells");
    assert.ok(layout.regionsByLevel, "should have regionsByLevel");
    assert.ok(layout.bounds, "should have bounds");
    assert.ok(layout.edges, "should have edges");
  });

  it("positions match node count", () => {
    const layout = generateCausalMap(makeSampleGraph());
    assert.equal(Object.keys(layout.nodePositions).length, 6);
  });

  it("cells match node count", () => {
    const layout = generateCausalMap(makeSampleGraph());
    assert.equal(Object.keys(layout.nodeCells).length, 6);
  });

  it("has correct number of hierarchy levels", () => {
    const layout = generateCausalMap(makeSampleGraph());
    assert.equal(layout.regionsByLevel.length, 2);
  });

  it("bounds are correct", () => {
    const layout = generateCausalMap(makeSampleGraph(), { width: 800, height: 600 });
    assert.equal(layout.bounds.maxX, 800);
    assert.equal(layout.bounds.maxY, 600);
  });

  it("is deterministic", () => {
    const graph = makeSampleGraph();
    const l1 = generateCausalMap(graph, { seed: 777 });
    const l2 = generateCausalMap(graph, { seed: 777 });
    assert.deepEqual(l1.nodePositions, l2.nodePositions);
  });

  it("throws on invalid input", () => {
    assert.throws(
      () => generateCausalMap({ nodes: null, edges: [], clusters: [] }),
      /Invalid graph input/,
    );
  });

  it("throws on empty nodes", () => {
    assert.throws(
      () => generateCausalMap({ nodes: [], edges: [], clusters: [] }),
      /Invalid graph input/,
    );
  });

  it("throws on edge referencing non-existent node", () => {
    assert.throws(
      () =>
        generateCausalMap({
          nodes: [{ id: "a", timestamp: 0 }],
          edges: [{ source: "a", target: "z" }],
          clusters: [[["a"]]],
        }),
      /Invalid graph input/,
    );
  });
});
