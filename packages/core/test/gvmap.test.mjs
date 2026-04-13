import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergePolygons } from "../dist/gvmap.js";

describe("mergePolygons", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(mergePolygons([]), []);
  });

  it("returns the single polygon for 1-polygon input", () => {
    const poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
    assert.deepEqual(mergePolygons([poly]), poly);
  });

  it("merges two adjacent squares into a rectangle", () => {
    // Two squares sharing edge x=1
    const left = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const right = [[1, 0], [2, 0], [2, 1], [1, 1]];
    const merged = mergePolygons([left, right]);
    // Merged should be a polygon with area 2
    assert.ok(merged.length >= 4, `Merged polygon has ${merged.length} vertices`);
    // Calculate area
    let area = 0;
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i];
      const b = merged[(i + 1) % merged.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    area = Math.abs(area / 2);
    assert.ok(Math.abs(area - 2) < 0.01, `Expected area 2, got ${area}`);
  });

  it("merges L-shaped configuration", () => {
    const a = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const b = [[1, 0], [2, 0], [2, 1], [1, 1]];
    const c = [[0, 1], [1, 1], [1, 2], [0, 2]];
    const merged = mergePolygons([a, b, c]);
    let area = 0;
    for (let i = 0; i < merged.length; i++) {
      const p = merged[i];
      const q = merged[(i + 1) % merged.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    area = Math.abs(area / 2);
    assert.ok(Math.abs(area - 3) < 0.01, `Expected area 3, got ${area}`);
  });

  it("handles disjoint polygons (returns largest)", () => {
    const small = [[0, 0], [1, 0], [1, 1], [0, 1]]; // area 1
    const big = [[5, 5], [10, 5], [10, 10], [5, 10]]; // area 25
    const merged = mergePolygons([small, big]);
    let area = 0;
    for (let i = 0; i < merged.length; i++) {
      const p = merged[i];
      const q = merged[(i + 1) % merged.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    area = Math.abs(area / 2);
    assert.ok(area >= 20, `Expected area ≥ 20, got ${area}`);
  });
});
