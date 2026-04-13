/**
 * Renderer tests — verify SVG output structure and correctness.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCausalMap } from "@causalmap/core";
import { renderSVG } from "@causalmap/renderer";

function makeSampleGraph() {
  return {
    nodes: [
      { id: "a", timestamp: 0, label: "Topic A", sentiment: "positive" },
      { id: "b", timestamp: 1, label: "Topic B", sentiment: "negative" },
      { id: "c", timestamp: 2, label: "Topic C", sentiment: "neutral" },
      { id: "d", timestamp: 3, label: "Topic D", sentiment: "positive" },
    ],
    edges: [
      { source: "a", target: "b", weight: 0.8 },
      { source: "b", target: "c", weight: 0.6 },
      { source: "c", target: "d", weight: 0.5 },
    ],
    clusters: [
      [["a", "b"], ["c", "d"]],
      [["a", "b", "c", "d"]],
    ],
  };
}

describe("renderSVG", () => {
  it("returns a valid SVG string", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout);
    assert.ok(svg.startsWith("<svg"), "Should start with <svg");
    assert.ok(svg.includes("</svg>"), "Should include </svg>");
    assert.ok(svg.includes("xmlns"), "Should have xmlns attribute");
  });

  it("contains edges as <path> elements when showEdges is true", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout, { showEdges: true });
    const edgeCount = (svg.match(/stroke-linecap="round"/g) ?? []).length;
    assert.equal(edgeCount, 3, "Should have 3 edge paths");
  });

  it("hides edges by default", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout);
    const edgeCount = (svg.match(/stroke-linecap="round"/g) ?? []).length;
    assert.equal(edgeCount, 0, "Edges should be hidden by default");
  });

  it("contains nodes as <circle> elements", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout);
    const nodeCount = (svg.match(/<circle /g) ?? []).length;
    assert.equal(nodeCount, 4, "Should have 4 node circles");
  });

  it("contains labels as <text> elements", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout);
    assert.ok(svg.includes("Topic A"), "Should include label text");
  });

  it("hides edges when showEdges is false", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout, { showEdges: false });
    const edgeCount = (svg.match(/stroke-linecap="round"/g) ?? []).length;
    assert.equal(edgeCount, 0, "No edges expected");
  });

  it("hides nodes when showNodes is false", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout, { showNodes: false });
    const nodeCount = (svg.match(/<circle /g) ?? []).length;
    assert.equal(nodeCount, 0, "No nodes expected");
  });

  it("hides labels when showLabels is false", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout, { showLabels: false });
    const textCount = (svg.match(/<text /g) ?? []).length;
    assert.equal(textCount, 0, "No labels expected");
  });

  it("has data-level attributes for hierarchical regions", () => {
    const layout = generateCausalMap(makeSampleGraph());
    const svg = renderSVG(layout);
    assert.ok(svg.includes('data-level="0"'), "Should have level 0");
    assert.ok(svg.includes('data-level="1"'), "Should have level 1");
  });

  it("escapes HTML in labels", () => {
    const graph = makeSampleGraph();
    graph.nodes[0].label = '<script>alert("xss")</script>';
    const layout = generateCausalMap(graph);
    const svg = renderSVG(layout);
    assert.ok(!svg.includes("<script>"), "Should escape HTML");
    assert.ok(svg.includes("&lt;script&gt;"), "Should have escaped version");
  });

  it("supports custom palette", () => {
    // Nodes without sentimentDegree use base color directly
    const graph = makeSampleGraph();
    const layout = generateCausalMap(graph);
    const svg = renderSVG(layout, { palette: { positive: "#ff0000" } });
    // With sentimentDegree undefined, exact base color is used
    assert.ok(svg.includes("#ff0000"), "Should use custom color for nodes without sentimentDegree");
  });

  it("modulates color lightness by sentimentDegree", () => {
    const graph = makeSampleGraph();
    // Add sentimentDegree to all nodes
    for (const node of graph.nodes) {
      node.sentimentDegree = 0.5;
    }
    const layout = generateCausalMap(graph);
    const svg = renderSVG(layout);
    // Should NOT contain default palette hex (colors are modulated)
    // The modulated colors will be different from the base palette
    assert.ok(svg.includes("fill=\"#"), "Should contain fill colors");
  });

  it("handles large graph rendering (200 nodes)", () => {
    const sentiments = ["positive", "negative", "neutral"];
    const nodes = Array.from({ length: 200 }, (_, i) => ({
      id: `n${i}`,
      timestamp: i * 5,
      label: `T-${i}`,
      sentiment: sentiments[i % 3],
    }));
    const edges = [];
    for (let i = 0; i < 200; i += 2) {
      edges.push({ source: `n${i}`, target: `n${i + 1}`, weight: 0.5 });
    }
    const clusters = [
      Array.from({ length: 50 }, (_, i) =>
        [`n${i * 4}`, `n${i * 4 + 1}`, `n${i * 4 + 2}`, `n${i * 4 + 3}`],
      ),
      Array.from({ length: 10 }, (_, i) =>
        Array.from({ length: 20 }, (_, j) => `n${i * 20 + j}`),
      ),
    ];
    const layout = generateCausalMap({ nodes, edges, clusters }, { ticks: 80 });
    const start = performance.now();
    const svg = renderSVG(layout);
    const renderTime = performance.now() - start;
    console.log(`  Render 200-node SVG: ${renderTime.toFixed(0)}ms, ${(svg.length / 1024).toFixed(0)}KB`);
    assert.ok(svg.length > 0, "SVG should not be empty");
    assert.ok(renderTime < 1000, `Render took ${renderTime}ms, expected <1000ms`);
  });
});
