import type { Point, Polygon } from "../types.js";

const POINT_PRECISION = 4;

export function polygonArea(polygon: Polygon): number {
  if (polygon.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (!start || !end) {
      continue;
    }
    const [x1, y1] = start;
    const [x2, y2] = end;
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

export function polygonCentroid(polygon: Polygon): Point {
  if (polygon.length === 0) {
    return [0, 0];
  }

  const area = polygonArea(polygon);
  if (Math.abs(area) < 1e-6) {
    const sum = polygon.reduce<[number, number]>(
      (accumulator, [x, y]) => [accumulator[0] + x, accumulator[1] + y],
      [0, 0],
    );
    return [sum[0] / polygon.length, sum[1] / polygon.length];
  }

  let cx = 0;
  let cy = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (!start || !end) {
      continue;
    }
    const [x1, y1] = start;
    const [x2, y2] = end;
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  const scale = 1 / (6 * area);
  return [cx * scale, cy * scale];
}

export function pointKey([x, y]: Point): string {
  return `${x.toFixed(POINT_PRECISION)},${y.toFixed(POINT_PRECISION)}`;
}

export function edgeKey(start: Point, end: Point): string {
  const a = pointKey(start);
  const b = pointKey(end);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function toPoint(key: string): Point {
  const [x, y] = key.split(",").map(Number);
  return [x ?? 0, y ?? 0];
}

export function dedupeClosingPoint(polygon: Polygon): Polygon {
  if (polygon.length <= 1) {
    return polygon;
  }
  const firstPoint = polygon[0];
  const lastPoint = polygon[polygon.length - 1];
  if (!firstPoint || !lastPoint) {
    return polygon;
  }
  const first = pointKey(firstPoint);
  const last = pointKey(lastPoint);
  return first === last ? polygon.slice(0, -1) : polygon;
}

export function isSubsetOf(candidate: string[], parent: string[]): boolean {
  const parentSet = new Set(parent);
  return candidate.every((value) => parentSet.has(value));
}