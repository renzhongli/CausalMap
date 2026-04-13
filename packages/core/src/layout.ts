import { forceLink, forceManyBody, forceSimulation } from "d3-force";
import seedrandom from "seedrandom";

import type {
  CausalEdge,
  HierarchicalGraph,
  LayoutOptions,
  NodePosition,
  NormalizedLayoutOptions,
} from "./types.js";

type SimulationNode = NodePosition & {
  fx?: number;
  fy?: number;
  vx?: number;
  vy?: number;
};

type SimulationLink = {
  source: string;
  target: string;
  strength: number;
  distance: number;
};

export function normalizeLayoutOptions(options: LayoutOptions = {}): NormalizedLayoutOptions {
  return {
    width: options.width ?? 1400,
    height: options.height ?? 820,
    padding: options.padding ?? 70,
    seed: options.seed ?? 233,
    randomPointCount: options.randomPointCount ?? 300,
    ticks: options.ticks ?? 260,
    forces: {
      repulsion: options.forces?.repulsion ?? -45,
      edgeAttraction: options.forces?.edgeAttraction ?? 0.12,
      clusterAttraction: options.forces?.clusterAttraction ?? 0.04,
    },
  };
}

/**
 * Build cluster cohesion links with per-level strength decay.
 *
 * Paper: "topics that share the same ancestor topics are attracted to each
 * other, with the strength diminishing as the level of the ancestor topic
 * in the hierarchical structure increases."
 *
 * levelIndex = 0 → finest clusters (strongest attraction)
 * levelIndex = N-1 → coarsest clusters (weakest attraction)
 *
 * Strength multiplier = 1 / (levelIndex + 1).
 *
 * For small clusters (≤12) we use all-pairs; for larger ones we switch to
 * a star topology (hub = first node) to keep the link count linear.
 */
function buildClusterLinksWithDecay(
  levels: string[][][],
  maxDistance: number,
): SimulationLink[] {
  const STAR_THRESHOLD = 12;
  const links: SimulationLink[] = [];

  for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    const clusters = levels[levelIndex];
    if (!clusters) {
      continue;
    }
    // Strength decays as levels get coarser (higher index = coarser).
    const levelStrength = 1 / (levelIndex + 1);

    for (const cluster of clusters) {
      if (cluster.length <= STAR_THRESHOLD) {
        for (let i = 0; i < cluster.length; i += 1) {
          for (let j = i + 1; j < cluster.length; j += 1) {
            const source = cluster[i];
            const target = cluster[j];
            if (!source || !target) {
              continue;
            }
            links.push({ source, target, strength: levelStrength, distance: maxDistance });
          }
        }
      } else {
        const hub = cluster[0];
        if (!hub) {
          continue;
        }
        for (let i = 1; i < cluster.length; i += 1) {
          const spoke = cluster[i];
          if (!spoke) {
            continue;
          }
          links.push({ source: hub, target: spoke, strength: levelStrength, distance: maxDistance });
        }
      }
    }
  }

  // When the same node pair appears at multiple levels, keep the link with
  // the strongest attraction (= finest level where they co-cluster).
  const bestLink = new Map<string, SimulationLink>();
  for (const link of links) {
    const key = link.source < link.target
      ? `${link.source}|${link.target}`
      : `${link.target}|${link.source}`;
    const existing = bestLink.get(key);
    if (!existing || link.strength > existing.strength) {
      bestLink.set(key, link);
    }
  }
  return [...bestLink.values()];
}

function buildEdgeLinks(edges: CausalEdge[]): SimulationLink[] {
  return edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    strength: Math.max(edge.weight ?? 1, 0.1),
    distance: 90,
  }));
}

export function computeNodeLayout(
  graph: HierarchicalGraph,
  options: LayoutOptions = {},
): Record<string, NodePosition> {
  if (graph.nodes.length === 0) {
    return {};
  }
  const normalized = normalizeLayoutOptions(options);
  const rng = seedrandom(String(normalized.seed));
  const timestamps = graph.nodes.map((node) => node.timestamp);
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const xSpan = Math.max(maxTimestamp - minTimestamp, 1);
  const innerWidth = normalized.width - normalized.padding * 2;
  const innerHeight = normalized.height - normalized.padding * 2;

  const nodes: SimulationNode[] = graph.nodes.map((node) => {
    const x =
      normalized.padding +
      ((node.timestamp - minTimestamp) / xSpan) * innerWidth;
    return {
      id: node.id,
      x,
      y: normalized.padding + innerHeight * (0.3 + rng() * 0.4),
      fx: x,
    };
  });

  // Sort cluster levels from finest to coarsest by average cluster size.
  // Finest level gets strongest attraction (1/1), coarsest gets weakest (1/N).
  const sortedLevels = [...graph.clusters].sort((a, b) => {
    const avgA = a.reduce((s, c) => s + c.length, 0) / Math.max(a.length, 1);
    const avgB = b.reduce((s, c) => s + c.length, 0) / Math.max(b.length, 1);
    return avgA - avgB;
  });

  const simulation = forceSimulation(nodes)
    .alpha(1)
    .alphaDecay(0.035)
    .force("charge", forceManyBody<SimulationNode>().strength(normalized.forces.repulsion))
    .force(
      "edges",
      forceLink<SimulationNode, SimulationLink>(buildEdgeLinks(graph.edges))
        .id((node: SimulationNode) => node.id)
        .distance((link: SimulationLink) => link.distance)
        .strength((link: SimulationLink) => link.strength * normalized.forces.edgeAttraction),
    )
    .force(
      "clusters",
      forceLink<SimulationNode, SimulationLink>(buildClusterLinksWithDecay(sortedLevels, 55))
        .id((node: SimulationNode) => node.id)
        .distance((link: SimulationLink) => link.distance)
        .strength((link: SimulationLink) => link.strength * normalized.forces.clusterAttraction),
    );

  for (let tick = 0; tick < normalized.ticks; tick += 1) {
    simulation.tick();
  }
  simulation.stop();

  const positionedNodes = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        id: node.id,
        x: node.x,
        y: Math.min(Math.max(node.y, normalized.padding), normalized.height - normalized.padding),
      },
    ]),
  );

  return positionedNodes;
}