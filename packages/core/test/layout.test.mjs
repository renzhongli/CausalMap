import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeNodeLayout, normalizeLayoutOptions } from "../dist/layout.js";

describe("normalizeLayoutOptions", () => {
  it("fills in all defaults", () => {
    const opts = normalizeLayoutOptions();
    assert.equal(opts.width, 1400);
    assert.equal(opts.height, 820);
    assert.equal(opts.padding, 70);
    assert.equal(opts.seed, 233);
    assert.equal(opts.ticks, 260);
    assert.equal(typeof opts.forces.repulsion, "number");
  });

  it("respects user overrides", () => {
    const opts = normalizeLayoutOptions({ width: 800, seed: 42 });
    assert.equal(opts.width, 800);
    assert.equal(opts.seed, 42);
  });
});

describe("computeNodeLayout", () => {
  it("returns empty object for empty graph", () => {
    const result = computeNodeLayout({
      nodes: [],
      edges: [],
      clusters: [],
    });
    assert.deepEqual(result, {});
  });

  it("positions nodes within bounds", () => {
    const graph = {
      nodes: [
        { id: "a", timestamp: 0 },
        { id: "b", timestamp: 1 },
        { id: "c", timestamp: 2 },
      ],
      edges: [{ source: "a", target: "b" }],
      clusters: [[["a", "b"], ["c"]]],
    };
    const options = { width: 500, height: 300, padding: 30 };
    const positions = computeNodeLayout(graph, options);

    assert.equal(Object.keys(positions).length, 3);
    for (const pos of Object.values(positions)) {
      assert.ok(pos.x >= 30, `x=${pos.x} < 30`);
      assert.ok(pos.x <= 470, `x=${pos.x} > 470`);
      assert.ok(pos.y >= 30, `y=${pos.y} < 30`);
      assert.ok(pos.y <= 270, `y=${pos.y} > 270`);
    }
  });

  it("is deterministic with the same seed", () => {
    const graph = {
      nodes: [
        { id: "a", timestamp: 0 },
        { id: "b", timestamp: 5 },
      ],
      edges: [{ source: "a", target: "b" }],
      clusters: [[["a", "b"]]],
    };
    const pos1 = computeNodeLayout(graph, { seed: 99 });
    const pos2 = computeNodeLayout(graph, { seed: 99 });
    assert.deepEqual(pos1, pos2);
  });

  it("produces different results with different seeds", () => {
    const graph = {
      nodes: [
        { id: "a", timestamp: 0 },
        { id: "b", timestamp: 5 },
        { id: "c", timestamp: 10 },
      ],
      edges: [],
      clusters: [[["a"], ["b"], ["c"]]],
    };
    const pos1 = computeNodeLayout(graph, { seed: 1 });
    const pos2 = computeNodeLayout(graph, { seed: 2 });
    const y1a = pos1["a"]?.y ?? 0;
    const y2a = pos2["a"]?.y ?? 0;
    assert.notEqual(y1a, y2a);
  });

  it("handles single-node graph", () => {
    const graph = {
      nodes: [{ id: "x", timestamp: 100 }],
      edges: [],
      clusters: [[["x"]]],
    };
    const pos = computeNodeLayout(graph);
    assert.ok(pos["x"]);
  });

  it("handles large cluster with star topology path (>12 nodes)", () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      timestamp: i,
    }));
    const cluster = nodes.map((n) => n.id);
    const graph = {
      nodes,
      edges: [],
      clusters: [[cluster]],
    };
    // Should not throw or hang
    const positions = computeNodeLayout(graph, { ticks: 30 });
    assert.equal(Object.keys(positions).length, 20);
  });
});
