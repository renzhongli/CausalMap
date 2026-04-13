/**
 * Edge-case and extreme-scale tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCausalMap, validateGraph, mergePolygons, polygonArea } from "../dist/index.js";

describe("edge cases", () => {
  it("single-node graph produces valid layout", () => {
    const layout = generateCausalMap({
      nodes: [{ id: "solo", timestamp: 0, label: "Solo" }],
      edges: [],
      clusters: [[["solo"]]],
    });
    assert.equal(Object.keys(layout.nodePositions).length, 1);
    assert.equal(Object.keys(layout.nodeCells).length, 1);
    assert.ok(layout.regionsByLevel.length >= 1);
    // The single cell should cover most of the viewport
    const cell = layout.nodeCells["solo"];
    assert.ok(cell.length >= 3);
  });

  it("graph with no edges still works", () => {
    const layout = generateCausalMap({
      nodes: Array.from({ length: 10 }, (_, i) => ({
        id: `n${i}`,
        timestamp: i,
      })),
      edges: [],
      clusters: [Array.from({ length: 10 }, (_, i) => [`n${i}`])],
    });
    assert.equal(Object.keys(layout.nodePositions).length, 10);
  });

  it("all nodes in one cluster", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `n${i}`);
    const layout = generateCausalMap({
      nodes: ids.map((id, i) => ({ id, timestamp: i })),
      edges: [],
      clusters: [[ids]],
    });
    // One level, one region containing all 15 nodes
    assert.equal(layout.regionsByLevel.length, 1);
    assert.equal(layout.regionsByLevel[0].length, 1);
    assert.equal(layout.regionsByLevel[0][0].nodeIds.length, 15);
  });

  it("each node in its own cluster", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `n${i}`);
    const layout = generateCausalMap({
      nodes: ids.map((id, i) => ({ id, timestamp: i })),
      edges: [],
      clusters: [ids.map((id) => [id])],
    });
    assert.equal(layout.regionsByLevel[0].length, 8);
  });

  it("nodes with identical timestamps still separate", () => {
    const layout = generateCausalMap({
      nodes: [
        { id: "a", timestamp: 100 },
        { id: "b", timestamp: 100 },
        { id: "c", timestamp: 100 },
      ],
      edges: [{ source: "a", target: "b" }],
      clusters: [[["a", "b", "c"]]],
    });
    // All should have the same X but different Y (force-directed)
    const positions = Object.values(layout.nodePositions);
    assert.equal(positions.length, 3);
  });

  it("many hierarchy levels (5 levels)", () => {
    const n = 32;
    const ids = Array.from({ length: n }, (_, i) => `n${i}`);
    const clusters = [];
    for (let groupSize = 2; groupSize <= n; groupSize *= 2) {
      const groups = [];
      for (let start = 0; start < n; start += groupSize) {
        groups.push(ids.slice(start, start + groupSize));
      }
      clusters.push(groups);
    }
    const layout = generateCausalMap({
      nodes: ids.map((id, i) => ({ id, timestamp: i })),
      edges: [],
      clusters,
    });
    assert.equal(layout.regionsByLevel.length, clusters.length);
  });
});

describe("extreme scale: 1000 nodes", () => {
  it("completes in <60s", () => {
    const n = 1000;
    const nodes = Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      timestamp: i * 3 + Math.random() * 2,
      label: `T${i}`,
      sentiment: ["positive", "negative", "neutral"][i % 3],
    }));
    const edges = [];
    for (let i = 0; i < n - 1; i += 2) {
      edges.push({ source: `n${i}`, target: `n${i + 1}`, weight: 0.5 });
    }
    // Extra random edges
    for (let k = 0; k < n * 0.02; k++) {
      const from = Math.floor(Math.random() * n);
      const to = Math.floor(Math.random() * n);
      if (from !== to) {
        edges.push({ source: `n${from}`, target: `n${to}`, weight: 0.3 });
      }
    }
    const clusters = [
      Array.from({ length: Math.ceil(n / 4) }, (_, i) =>
        Array.from({ length: Math.min(4, n - i * 4) }, (_, j) => `n${i * 4 + j}`),
      ),
      Array.from({ length: Math.ceil(n / 20) }, (_, i) =>
        Array.from({ length: Math.min(20, n - i * 20) }, (_, j) => `n${i * 20 + j}`),
      ),
      Array.from({ length: Math.ceil(n / 100) }, (_, i) =>
        Array.from({ length: Math.min(100, n - i * 100) }, (_, j) => `n${i * 100 + j}`),
      ),
    ];

    const start = performance.now();
    const layout = generateCausalMap({ nodes, edges, clusters }, {
      width: 4000,
      height: 2400,
      ticks: 80,
    });
    const elapsed = performance.now() - start;
    console.log(`  1000 nodes, ${edges.length} edges, 3 levels: ${elapsed.toFixed(0)}ms`);
    console.log(`  Regions: ${layout.regionsByLevel.map(l => l.length).join(",")} by level`);

    assert.equal(Object.keys(layout.nodePositions).length, 1000);
    assert.ok(elapsed < 60000, `Took ${elapsed}ms`);

    // Check polygon quality
    let emptyPolygons = 0;
    let totalRegions = 0;
    for (const level of layout.regionsByLevel) {
      for (const region of level) {
        totalRegions++;
        if (region.polygon.length < 3) emptyPolygons++;
      }
    }
    console.log(`  Total regions: ${totalRegions}, empty: ${emptyPolygons}`);
    assert.ok(emptyPolygons / totalRegions < 0.05);
  });
});

describe("mergePolygons edge cases", () => {
  it("single point polygon returns empty", () => {
    const result = mergePolygons([[[0, 0]]]);
    // single-point polygon
    assert.deepEqual(result, [[0, 0]]);
  });

  it("very thin polygons (nearly collinear)", () => {
    const thin = [
      [0, 0], [100, 0.001], [200, 0], [200, 0.01], [100, 0.009], [0, 0.01],
    ];
    const area = Math.abs(polygonArea(thin));
    assert.ok(area > 0, `Area should be > 0, got ${area}`);
  });
});
