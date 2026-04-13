import type { Polygon } from "./types.js";
import { edgeKey, pointKey, polygonArea, toPoint } from "./utils/polygon.js";

type BoundaryEdge = {
  start: string;
  end: string;
};

function extractBoundaryLoops(polygons: Polygon[]): Polygon[] {
  const edgeCounts = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if (!start || !end) {
        continue;
      }
      const key = edgeKey(start, end);
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  const boundaryEdges: BoundaryEdge[] = [];
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if (!start || !end) {
        continue;
      }
      const key = edgeKey(start, end);
      if (edgeCounts.get(key) !== 1) {
        continue;
      }
      const startKey = pointKey(start);
      const endKey = pointKey(end);
      boundaryEdges.push({ start: startKey, end: endKey });
      if (!adjacency.has(startKey)) {
        adjacency.set(startKey, new Set());
      }
      if (!adjacency.has(endKey)) {
        adjacency.set(endKey, new Set());
      }
      adjacency.get(startKey)?.add(endKey);
      adjacency.get(endKey)?.add(startKey);
    }
  }

  const usedEdges = new Set<string>();
  const loops: Polygon[] = [];

  function markEdge(a: string, b: string): void {
    usedEdges.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }

  function edgeWasUsed(a: string, b: string): boolean {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    return usedEdges.has(key);
  }

  for (const edge of boundaryEdges) {
    if (edgeWasUsed(edge.start, edge.end)) {
      continue;
    }

    const loop: string[] = [edge.start, edge.end];
    markEdge(edge.start, edge.end);
    let previous = edge.start;
    let current = edge.end;

    while (current !== loop[0]) {
      const neighbors = [...(adjacency.get(current) ?? [])].filter(
        (neighbor) => neighbor !== previous,
      );
      const next = neighbors.find((neighbor) => !edgeWasUsed(current, neighbor));
      if (!next) {
        break;
      }
      loop.push(next);
      markEdge(current, next);
      previous = current;
      current = next;
    }

    const polygon = loop.slice(0, -1).map(toPoint);
    if (polygon.length >= 3) {
      loops.push(polygon);
    }
  }

  return loops;
}

export function mergePolygons(polygons: Polygon[]): Polygon {
  if (polygons.length === 0) {
    return [];
  }
  if (polygons.length === 1) {
    return polygons[0] ?? [];
  }

  const loops = extractBoundaryLoops(polygons);
  if (loops.length === 0) {
    return polygons[0] ?? [];
  }

  return loops.reduce((largest, current) =>
    Math.abs(polygonArea(current)) > Math.abs(polygonArea(largest)) ? current : largest,
  );
}