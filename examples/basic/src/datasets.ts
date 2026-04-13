/**
 * Sample datasets for CausalMap demos.
 */
import type { HierarchicalGraph, LayoutOptions } from "@causalmap/core";
import type { RenderOptions } from "@causalmap/renderer";

export interface Dataset {
  id: string;
  name: string;
  description: string;
  graph: HierarchicalGraph;
  layoutOptions: LayoutOptions;
  renderOptions: RenderOptions;
}

// ── helpers ──

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const sentiments: Array<"positive" | "negative" | "neutral"> = [
  "positive",
  "negative",
  "neutral",
];

// ═══════════════════════════════════════════════
// Dense Network  (200 nodes, 3 levels)
// ═══════════════════════════════════════════════
const denseNetwork: Dataset = (() => {
  const rng = seeded(2026);
  const N = 200;
  const nodes = Array.from({ length: N }, (_, i) => ({
    id: `n${i}`,
    timestamp: i,
    label: i % 20 === 0 ? `Topic ${i}` : `T${i}`,
    sentiment: sentiments[Math.floor(rng() * 3)]!,
    sentimentDegree: 0.2 + rng() * 0.8, // random intensity in [0.2, 1.0]
  }));
  const edges: Array<{ source: string; target: string; weight: number }> = [];
  // Chain within each group of 20
  for (let g = 0; g < 10; g++) {
    for (let i = 0; i < 19; i++) {
      edges.push({
        source: `n${g * 20 + i}`,
        target: `n${g * 20 + i + 1}`,
        weight: 0.4 + rng() * 0.8,
      });
    }
  }
  // Random cross-cluster links
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(rng() * N);
    let b = Math.floor(rng() * N);
    if (b === a) b = (a + 1) % N;
    edges.push({ source: `n${a}`, target: `n${b}`, weight: 0.2 + rng() * 0.6 });
  }
  const ids = nodes.map((n) => n.id);
  return {
    id: "dense-network",
    name: "Dense Network (200 nodes)",
    description:
      "200 nodes in 10 groups with 40 random cross edges — stress-tests polygon merging with 3 hierarchy levels.",
    graph: {
      nodes,
      edges,
      clusters: [
        Array.from({ length: 20 }, (_, i) => ids.slice(i * 10, i * 10 + 10)),
        Array.from({ length: 10 }, (_, i) => ids.slice(i * 20, i * 20 + 20)),
        [ids.slice(0, 100), ids.slice(100, 200)],
      ],
    },
    layoutOptions: {
      width: 1800,
      height: 1000,
      randomPointCount: 500,
      seed: 2026,
      ticks: 300,
      forces: { repulsion: -30, edgeAttraction: 0.1, clusterAttraction: 0.04 },
    },
    renderOptions: {
      background: "#faf8f5",
      regionOpacity: 0.68,
      showNodes: true,
      showEdges: false,
      showLabels: true,
      showLineChart: true,
    },
  };
})();

// ═══════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════
export const datasets: Dataset[] = [
  denseNetwork,
];
