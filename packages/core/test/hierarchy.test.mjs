import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRegionsByLevel } from "../dist/hierarchy.js";

function makeCells() {
  // 6 adjacent Voronoi-like cells on a 3×2 grid
  return {
    a: [[0, 0], [50, 0], [50, 50], [0, 50]],
    b: [[50, 0], [100, 0], [100, 50], [50, 50]],
    c: [[100, 0], [150, 0], [150, 50], [100, 50]],
    d: [[0, 50], [50, 50], [50, 100], [0, 100]],
    e: [[50, 50], [100, 50], [100, 100], [50, 100]],
    f: [[100, 50], [150, 50], [150, 100], [100, 100]],
  };
}

function makeNodes() {
  return [
    { id: "a", timestamp: 0, label: "A" },
    { id: "b", timestamp: 1, label: "B" },
    { id: "c", timestamp: 2, label: "C" },
    { id: "d", timestamp: 3, label: "D" },
    { id: "e", timestamp: 4, label: "E" },
    { id: "f", timestamp: 5, label: "F" },
  ];
}

describe("buildRegionsByLevel", () => {
  it("returns one level for one cluster level", () => {
    const clusters = [[["a", "b", "c"], ["d", "e", "f"]]];
    const regions = buildRegionsByLevel(clusters, makeCells(), makeNodes());
    assert.equal(regions.length, 1);
    assert.equal(regions[0].length, 2);
  });

  it("handles 2 levels with correct parent-child nesting", () => {
    const clusters = [
      [["a", "b"], ["c"], ["d", "e"], ["f"]],     // fine: 4 clusters
      [["a", "b", "c"], ["d", "e", "f"]],          // coarse: 2 clusters
    ];
    const regions = buildRegionsByLevel(clusters, makeCells(), makeNodes());
    assert.equal(regions.length, 2);
    // Coarsest level first
    const coarse = regions[0];
    const fine = regions[1];
    assert.equal(coarse.length, 2);
    assert.equal(fine.length, 4);

    // Each coarse region should have children referencing fine regions
    const allChildIds = coarse.flatMap((r) => r.children);
    assert.ok(allChildIds.length > 0, "Coarse regions should have children");
  });

  it("assigns labels from node labels", () => {
    const clusters = [[["a"], ["b"]]];
    const regions = buildRegionsByLevel(clusters, makeCells(), makeNodes());
    const labels = regions[0].map((r) => r.label);
    assert.ok(labels.includes("A"));
    assert.ok(labels.includes("B"));
  });

  it("each region polygon has valid centroid", () => {
    const clusters = [[["a", "b", "c", "d", "e", "f"]]];
    const regions = buildRegionsByLevel(clusters, makeCells(), makeNodes());
    const region = regions[0][0];
    const [cx, cy] = region.centroid;
    assert.ok(cx >= 0 && cx <= 150, `cx=${cx} out of range`);
    assert.ok(cy >= 0 && cy <= 100, `cy=${cy} out of range`);
  });

  it("handles 3 levels", () => {
    const clusters = [
      [["a"], ["b"], ["c"], ["d"], ["e"], ["f"]],   // 6 individual clusters
      [["a", "b"], ["c", "d"], ["e", "f"]],          // 3 pairs
      [["a", "b", "c", "d", "e", "f"]],              // 1 big cluster
    ];
    const regions = buildRegionsByLevel(clusters, makeCells(), makeNodes());
    assert.equal(regions.length, 3);
    // Coarsest first
    assert.equal(regions[0].length, 1);  // 1 big cluster
    assert.equal(regions[1].length, 3);  // 3 pairs
    assert.equal(regions[2].length, 6);  // 6 individual
  });
});
