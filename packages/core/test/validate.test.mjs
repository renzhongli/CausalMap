import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateGraph } from "../dist/validate.js";

function makeGraph(overrides = {}) {
  return {
    nodes: [
      { id: "a", timestamp: 1 },
      { id: "b", timestamp: 2 },
      { id: "c", timestamp: 3 },
    ],
    edges: [{ source: "a", target: "b" }],
    clusters: [[["a", "b"], ["c"]]],
    ...overrides,
  };
}

describe("validateGraph", () => {
  it("accepts a valid graph", () => {
    const result = validateGraph(makeGraph());
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  it("rejects missing nodes", () => {
    const result = validateGraph(makeGraph({ nodes: null }));
    assert.ok(!result.valid);
    assert.ok(result.errors[0].includes("nodes"));
  });

  it("rejects missing edges", () => {
    const result = validateGraph(makeGraph({ edges: "not-an-array" }));
    assert.ok(!result.valid);
  });

  it("rejects missing clusters", () => {
    const result = validateGraph(makeGraph({ clusters: undefined }));
    assert.ok(!result.valid);
  });

  it("detects empty nodes array", () => {
    const result = validateGraph(makeGraph({ nodes: [] }));
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("empty")));
  });

  it("detects duplicate node ids", () => {
    const result = validateGraph(
      makeGraph({
        nodes: [
          { id: "a", timestamp: 1 },
          { id: "a", timestamp: 2 },
        ],
      }),
    );
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("Duplicate")));
  });

  it("detects invalid node id", () => {
    const result = validateGraph(
      makeGraph({
        nodes: [{ id: "", timestamp: 1 }],
      }),
    );
    assert.ok(!result.valid);
  });

  it("detects invalid timestamp", () => {
    const result = validateGraph(
      makeGraph({
        nodes: [{ id: "x", timestamp: NaN }],
      }),
    );
    assert.ok(!result.valid);
  });

  it("detects edge referencing unknown node", () => {
    const result = validateGraph(
      makeGraph({
        edges: [{ source: "a", target: "z" }],
      }),
    );
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("z")));
  });

  it("detects cluster referencing unknown node", () => {
    const result = validateGraph(
      makeGraph({
        clusters: [[["a", "missing"]]],
      }),
    );
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("missing")));
  });
});
