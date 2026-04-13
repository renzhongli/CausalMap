import { Delaunay } from "d3-delaunay";
import seedrandom from "seedrandom";

import type { LayoutOptions, Polygon } from "./types.js";
import { normalizeLayoutOptions } from "./layout.js";
import { dedupeClosingPoint } from "./utils/polygon.js";

export function generateVoronoiCells(
  nodePositions: Record<string, { x: number; y: number }>,
  options: LayoutOptions = {},
): Record<string, Polygon> {
  const normalized = normalizeLayoutOptions(options);
  const rng = seedrandom(`voronoi-${normalized.seed}`);
  const entries = Object.entries(nodePositions);
  const basePoints = entries.map(([, position]) => [position.x, position.y] as [number, number]);
  const points = [...basePoints];
  const xmin = 0;
  const ymin = 0;
  const xmax = normalized.width;
  const ymax = normalized.height;
  const extendedPadding = Math.max(normalized.padding * 1.2, 80);

  for (let index = 0; index < normalized.randomPointCount; index += 1) {
    const side = Math.floor(rng() * 4);
    const x = rng() * normalized.width;
    const y = rng() * normalized.height;
    if (side === 0) {
      points.push([x, ymin - extendedPadding]);
    } else if (side === 1) {
      points.push([x, ymax + extendedPadding]);
    } else if (side === 2) {
      points.push([xmin - extendedPadding, y]);
    } else {
      points.push([xmax + extendedPadding, y]);
    }
  }

  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([xmin, ymin, xmax, ymax]);
  const cells: Record<string, Polygon> = {};

  entries.forEach(([nodeId], index) => {
    const polygon = voronoi.cellPolygon(index) as Polygon | null;
    cells[nodeId] = polygon ? dedupeClosingPoint(polygon) : [];
  });

  return cells;
}