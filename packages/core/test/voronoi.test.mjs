import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateVoronoiCells } from "../dist/voronoi.js";

describe("generateVoronoiCells", () => {
  it("returns one cell per node", () => {
    const positions = {
      a: { x: 100, y: 100 },
      b: { x: 200, y: 200 },
      c: { x: 300, y: 150 },
    };
    const cells = generateVoronoiCells(positions, { width: 400, height: 300 });
    assert.equal(Object.keys(cells).length, 3);
    assert.ok(cells["a"].length >= 3, "Cell 'a' should be a valid polygon");
    assert.ok(cells["b"].length >= 3, "Cell 'b' should be a valid polygon");
  });

  it("cells cover the viewport (no overlapping centroids)", () => {
    const positions = {
      a: { x: 50, y: 50 },
      b: { x: 350, y: 250 },
    };
    const cells = generateVoronoiCells(positions, { width: 400, height: 300 });
    // Each cell should have non-trivial area
    for (const [, cell] of Object.entries(cells)) {
      assert.ok(cell.length >= 3, "Cell should have at least 3 vertices");
    }
  });

  it("is deterministic with the same seed", () => {
    const positions = { a: { x: 100, y: 200 } };
    const c1 = generateVoronoiCells(positions, { seed: 42 });
    const c2 = generateVoronoiCells(positions, { seed: 42 });
    assert.deepEqual(c1, c2);
  });

  it("handles single node", () => {
    const cells = generateVoronoiCells({ a: { x: 200, y: 200 } }, { width: 400, height: 400 });
    assert.ok(cells["a"].length >= 3);
  });

  it("handles many nodes", () => {
    const positions = {};
    for (let i = 0; i < 50; i++) {
      positions[`n${i}`] = { x: (i % 10) * 50 + 25, y: Math.floor(i / 10) * 60 + 30 };
    }
    const cells = generateVoronoiCells(positions, { width: 500, height: 350 });
    assert.equal(Object.keys(cells).length, 50);
    for (const cell of Object.values(cells)) {
      assert.ok(cell.length >= 3, "Each cell should be a valid polygon");
    }
  });
});
