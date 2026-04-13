/**
 * Large-scale stress test for the CausalMap pipeline.
 * Generates synthetic graphs of increasing size and measures performance.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCausalMap } from "../dist/pipeline.js";

function generateSyntheticGraph(nodeCount, edgeDensity = 0.05, levelCount = 3) {
  const sentiments = ["positive", "negative", "neutral"];
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    timestamp: i * 10 + Math.random() * 5,
    label: `Topic-${i}`,
    sentiment: sentiments[i % 3],
  }));

  const edges = [];
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      if (Math.random() < edgeDensity) {
        edges.push({
          source: `n${i}`,
          target: `n${j}`,
          weight: 0.1 + Math.random() * 0.9,
        });
      }
    }
  }

  // Build hierarchical clusters by progressively grouping
  const clusters = [];
  for (let level = 0; level < levelCount; level++) {
    const groupSize = Math.pow(2, level + 1); // 2, 4, 8, ...
    const groups = [];
    for (let start = 0; start < nodeCount; start += groupSize) {
      const end = Math.min(start + groupSize, nodeCount);
      groups.push(Array.from({ length: end - start }, (_, k) => `n${start + k}`));
    }
    clusters.push(groups);
  }

  return { nodes, edges, clusters };
}

function timeExec(fn) {
  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  return { result, elapsed };
}

describe("stress test: small (30 nodes)", () => {
  it("completes in <2s", () => {
    const graph = generateSyntheticGraph(30, 0.1, 2);
    const { result, elapsed } = timeExec(() =>
      generateCausalMap(graph, { width: 1000, height: 600, ticks: 200 }),
    );
    console.log(`  30 nodes, ${graph.edges.length} edges: ${elapsed.toFixed(0)}ms`);
    assert.equal(Object.keys(result.nodePositions).length, 30);
    assert.ok(result.regionsByLevel.length === 2);
    assert.ok(elapsed < 2000, `Took ${elapsed}ms, expected <2000ms`);
  });
});

describe("stress test: medium (100 nodes)", () => {
  it("completes in <5s", () => {
    const graph = generateSyntheticGraph(100, 0.04, 3);
    const { result, elapsed } = timeExec(() =>
      generateCausalMap(graph, { width: 1400, height: 820, ticks: 200 }),
    );
    console.log(`  100 nodes, ${graph.edges.length} edges: ${elapsed.toFixed(0)}ms`);
    assert.equal(Object.keys(result.nodePositions).length, 100);
    assert.ok(result.regionsByLevel.length === 3);
    assert.ok(elapsed < 5000, `Took ${elapsed}ms, expected <5000ms`);
  });
});

describe("stress test: large (300 nodes)", () => {
  it("completes in <15s", () => {
    const graph = generateSyntheticGraph(300, 0.015, 3);
    const { result, elapsed } = timeExec(() =>
      generateCausalMap(graph, { width: 2000, height: 1200, ticks: 150 }),
    );
    console.log(`  300 nodes, ${graph.edges.length} edges: ${elapsed.toFixed(0)}ms`);
    assert.equal(Object.keys(result.nodePositions).length, 300);
    assert.ok(result.regionsByLevel.length === 3);
    assert.ok(elapsed < 15000, `Took ${elapsed}ms, expected <15000ms`);
  });
});

describe("stress test: very large (500 nodes)", () => {
  it("completes in <30s", () => {
    const graph = generateSyntheticGraph(500, 0.008, 4);
    const { result, elapsed } = timeExec(() =>
      generateCausalMap(graph, { width: 2800, height: 1600, ticks: 100 }),
    );
    console.log(`  500 nodes, ${graph.edges.length} edges: ${elapsed.toFixed(0)}ms`);
    assert.equal(Object.keys(result.nodePositions).length, 500);
    assert.ok(result.regionsByLevel.length === 4);
    assert.ok(elapsed < 30000, `Took ${elapsed}ms, expected <30000ms`);
  });
});

describe("stress test: output validity", () => {
  it("all regions have non-empty polygons (200 nodes)", () => {
    const graph = generateSyntheticGraph(200, 0.02, 3);
    const layout = generateCausalMap(graph, { width: 1800, height: 1000, ticks: 120 });
    let emptyCount = 0;
    let totalRegions = 0;
    for (const level of layout.regionsByLevel) {
      for (const region of level) {
        totalRegions += 1;
        if (region.polygon.length < 3) {
          emptyCount += 1;
        }
      }
    }
    console.log(`  Total regions: ${totalRegions}, empty polygons: ${emptyCount}`);
    // Allow up to 5% empty (degenerate cases from overlapping positions)
    const emptyRatio = emptyCount / Math.max(totalRegions, 1);
    assert.ok(emptyRatio < 0.05, `${(emptyRatio * 100).toFixed(1)}% empty polygons, expected <5%`);
  });

  it("all node positions are within bounds (200 nodes)", () => {
    const graph = generateSyntheticGraph(200, 0.02, 2);
    const layout = generateCausalMap(graph, { width: 1400, height: 800, padding: 50 });
    for (const pos of Object.values(layout.nodePositions)) {
      assert.ok(pos.x >= 50 && pos.x <= 1350, `x=${pos.x} out of bounds`);
      assert.ok(pos.y >= 50 && pos.y <= 750, `y=${pos.y} out of bounds`);
    }
  });

  it("coarsest level has fewer regions than finest level", () => {
    const graph = generateSyntheticGraph(100, 0.03, 3);
    const layout = generateCausalMap(graph, { width: 1000, height: 600 });
    const coarsest = layout.regionsByLevel[0];
    const finest = layout.regionsByLevel[layout.regionsByLevel.length - 1];
    assert.ok(
      coarsest.length <= finest.length,
      `Coarsest (${coarsest.length}) should have ≤ regions than finest (${finest.length})`,
    );
  });
});
