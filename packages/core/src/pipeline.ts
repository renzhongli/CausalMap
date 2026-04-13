import { buildRegionsByLevel } from "./hierarchy.js";
import { computeNodeLayout, normalizeLayoutOptions } from "./layout.js";
import type { HierarchicalGraph, LayoutOptions, MapLayout } from "./types.js";
import { validateGraph } from "./validate.js";
import { generateVoronoiCells } from "./voronoi.js";

export function generateCausalMap(
  graph: HierarchicalGraph,
  options: LayoutOptions = {},
): MapLayout {
  const result = validateGraph(graph);
  if (!result.valid) {
    throw new Error(`Invalid graph input:\n${result.errors.join("\n")}`);
  }

  const normalized = normalizeLayoutOptions(options);
  const nodePositions = computeNodeLayout(graph, normalized);
  const nodeCells = generateVoronoiCells(nodePositions, normalized);
  const regionsByLevel = buildRegionsByLevel(graph.clusters, nodeCells, graph.nodes);

  return {
    nodePositions,
    nodeCells,
    regionsByLevel,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: normalized.width,
      maxY: normalized.height,
    },
    edges: graph.edges,
  };
}