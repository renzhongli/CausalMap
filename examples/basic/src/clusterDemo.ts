/**
 * 10 000-node cluster demo.
 *
 * 1. Generate 10 000 random points in [0,1000]×[0,1000] with 2-level
 *    spatial clustering (some outliers).
 * 2. Run Voronoi tessellation + GVMap polygon merging + hierarchy assembly.
 * 3. Render SVG: coarse regions = solid borders, fine regions = dashed borders.
 */

import { generateVoronoiCells, buildRegionsByLevel } from "@causalmap/core";
import type { CausalNode, Polygon, MapRegion } from "@causalmap/core";

// ──────────────────────────────────────────────
// Seeded RNG (simple LCG)
// ──────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Box-Muller for Gaussian distribution
function gaussian(rng: () => number, mean: number, stddev: number): number {
  const u1 = rng() || 1e-10;
  const u2 = rng();
  return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ──────────────────────────────────────────────
// Data generation
// ──────────────────────────────────────────────
const SIZE = 1000;
const TOTAL_POINTS = 10_000;
const rng = lcg(42);

// 6 coarse cluster centres — well-separated via Poisson-disk-ish placement
const coarseCentres: Array<[number, number]> = [];
const COARSE_COUNT = 6;
while (coarseCentres.length < COARSE_COUNT) {
  const cx = 100 + rng() * 800;
  const cy = 100 + rng() * 800;
  const tooClose = coarseCentres.some(
    ([px, py]) => Math.hypot(cx - px, cy - py) < 250,
  );
  if (!tooClose) coarseCentres.push([cx, cy]);
}

// Each coarse cluster has 4-6 fine sub-clusters nearby
interface FineMeta {
  cx: number;
  cy: number;
  coarseIdx: number;
  fineIdx: number;
  count: number;
}

const fineMetas: FineMeta[] = [];
let fineIdx = 0;
for (let ci = 0; ci < COARSE_COUNT; ci++) {
  const [ccx, ccy] = coarseCentres[ci]!;
  const nFine = 4 + Math.floor(rng() * 3); // 4-6
  for (let fi = 0; fi < nFine; fi++) {
    const angle = (2 * Math.PI * fi) / nFine + rng() * 0.5;
    const radius = 40 + rng() * 80;
    const fcx = ccx + Math.cos(angle) * radius;
    const fcy = ccy + Math.sin(angle) * radius;
    fineMetas.push({
      cx: Math.max(5, Math.min(995, fcx)),
      cy: Math.max(5, Math.min(995, fcy)),
      coarseIdx: ci,
      fineIdx: fineIdx++,
      count: 0,
    });
  }
}

// Distribute ~9400 points among fine clusters, ~600 outliers
const OUTLIER_COUNT = 600;
const clusterPointBudget = TOTAL_POINTS - OUTLIER_COUNT;
const perFine = Math.floor(clusterPointBudget / fineMetas.length);
let remainder = clusterPointBudget - perFine * fineMetas.length;

for (const fm of fineMetas) {
  fm.count = perFine + (remainder > 0 ? 1 : 0);
  if (remainder > 0) remainder--;
}

// Generate points
const nodes: CausalNode[] = [];
const positions: Record<string, { x: number; y: number }> = {};
const fineClusterMap: string[][] = fineMetas.map(() => []);
const coarseClusterMap: string[][] = coarseCentres.map(() => []);

let nextId = 0;

for (const fm of fineMetas) {
  const sigma = 18 + rng() * 25; // spread per fine cluster
  for (let i = 0; i < fm.count; i++) {
    const id = `p${nextId++}`;
    const x = Math.max(0, Math.min(SIZE, gaussian(rng, fm.cx, sigma)));
    const y = Math.max(0, Math.min(SIZE, gaussian(rng, fm.cy, sigma)));
    nodes.push({ id, timestamp: x });
    positions[id] = { x, y };
    fineClusterMap[fm.fineIdx]!.push(id);
    coarseClusterMap[fm.coarseIdx]!.push(id);
  }
}

// Outliers — assign to nearest fine (and its coarse parent)
for (let i = 0; i < OUTLIER_COUNT; i++) {
  const id = `p${nextId++}`;
  const x = rng() * SIZE;
  const y = rng() * SIZE;
  nodes.push({ id, timestamp: x });
  positions[id] = { x, y };

  // Nearest fine cluster
  let bestDist = Infinity;
  let bestFine = 0;
  for (let fi = 0; fi < fineMetas.length; fi++) {
    const fm = fineMetas[fi]!;
    const d = Math.hypot(x - fm.cx, y - fm.cy);
    if (d < bestDist) {
      bestDist = d;
      bestFine = fi;
    }
  }
  fineClusterMap[bestFine]!.push(id);
  coarseClusterMap[fineMetas[bestFine]!.coarseIdx]!.push(id);
}

// Build hierarchy: [fine, coarse]
const clusters: string[][][] = [
  fineClusterMap.filter((c) => c.length > 0),
  coarseClusterMap.filter((c) => c.length > 0),
];

console.log(
  `Generated ${nodes.length} nodes, ` +
    `${clusters[0]!.length} fine clusters, ` +
    `${clusters[1]!.length} coarse clusters`,
);

// ──────────────────────────────────────────────
// Pipeline: Voronoi → hierarchy
// ──────────────────────────────────────────────
const totalStart = performance.now();

const tVor0 = performance.now();
const cells = generateVoronoiCells(positions, {
  width: SIZE,
  height: SIZE,
  padding: 0,
  randomPointCount: 600,
  seed: 42,
});
const tVor = performance.now() - tVor0;

const tMerge0 = performance.now();
const regionsByLevel = buildRegionsByLevel(clusters, cells, nodes);
const tMerge = performance.now() - tMerge0;

const totalTime = performance.now() - totalStart;

console.log(`Voronoi: ${tVor.toFixed(0)}ms, Merge: ${tMerge.toFixed(0)}ms, Total: ${totalTime.toFixed(0)}ms`);

// ──────────────────────────────────────────────
// Custom SVG Renderer
// ──────────────────────────────────────────────
const COARSE_COLORS = [
  "#e76f51", // warm red
  "#457b9d", // blue
  "#2a9d8f", // teal
  "#e9c46a", // gold
  "#9b5de5", // purple
  "#6a994e", // green
  "#f4845f", // coral
  "#577590", // slate
  "#f4a261", // orange
];

function polygonD(poly: Polygon): string {
  if (poly.length < 3) return "";
  const [first, ...rest] = poly;
  if (!first) return "";
  return (
    `M ${first[0].toFixed(1)} ${first[1].toFixed(1)} ` +
    rest.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
    " Z"
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderClusterSVG(): string {
  const W = SIZE;
  const H = SIZE;

  // regionsByLevel is coarsest-first after buildRegionsByLevel
  // coarsest = regionsByLevel[0], finest = regionsByLevel[last]
  const coarseRegions = regionsByLevel[0] ?? [];
  const fineRegions = regionsByLevel[regionsByLevel.length - 1] ?? [];

  // Map fine regions → coarse parent for color assignment
  const nodeToCoarseIdx = new Map<string, number>();
  for (let ci = 0; ci < coarseClusterMap.length; ci++) {
    for (const nid of coarseClusterMap[ci]!) {
      nodeToCoarseIdx.set(nid, ci);
    }
  }

  function regionColor(region: MapRegion): string {
    // Use the coarse cluster index of the first node
    const firstNode = region.nodeIds[0];
    if (!firstNode) return "#666";
    const ci = nodeToCoarseIdx.get(firstNode) ?? 0;
    return COARSE_COLORS[ci % COARSE_COLORS.length]!;
  }

  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${W} ${H}" width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">`,
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#0f0f23" rx="0" />`);

  // ── Layer 1: coarse-level regions (solid borders, light fill) ──
  parts.push(`<g id="coarse-regions">`);
  for (const region of coarseRegions) {
    const d = polygonD(region.polygon);
    if (!d) continue;
    const color = regionColor(region);
    parts.push(
      `<path d="${d}" fill="${color}" fill-opacity="0.12" ` +
        `stroke="${color}" stroke-width="2.4" stroke-opacity="0.9" ` +
        `stroke-linejoin="round">` +
        `<title>${esc(region.label ?? region.id)}</title></path>`,
    );
  }
  parts.push(`</g>`);

  // ── Layer 2: fine-level regions (dashed borders, no fill) ──
  parts.push(`<g id="fine-regions">`);
  for (const region of fineRegions) {
    const d = polygonD(region.polygon);
    if (!d) continue;
    const color = regionColor(region);
    parts.push(
      `<path d="${d}" fill="${color}" fill-opacity="0.06" ` +
        `stroke="${color}" stroke-width="0.9" stroke-opacity="0.7" ` +
        `stroke-dasharray="6 4" stroke-linejoin="round" />`,
    );
  }
  parts.push(`</g>`);

  // ── Layer 3: node dots ──
  parts.push(`<g id="nodes" fill-opacity="0.6">`);
  for (const node of nodes) {
    const pos = positions[node.id];
    if (!pos) continue;
    const ci = nodeToCoarseIdx.get(node.id) ?? 0;
    const color = COARSE_COLORS[ci % COARSE_COLORS.length]!;
    parts.push(
      `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="1.3" fill="${color}" />`,
    );
  }
  parts.push(`</g>`);

  // ── Layer 4: coarse-level labels ──
  parts.push(`<g id="labels" font-family="IBM Plex Sans, system-ui, sans-serif">`);
  for (let ci = 0; ci < coarseRegions.length; ci++) {
    const region = coarseRegions[ci]!;
    const [cx, cy] = region.centroid;
    const color = regionColor(region);
    parts.push(
      `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" ` +
        `text-anchor="middle" dominant-baseline="central" ` +
        `font-size="16" font-weight="700" fill="${color}" fill-opacity="0.85">` +
        `Cluster ${ci + 1}</text>`,
    );
  }
  parts.push(`</g>`);

  parts.push(`</svg>`);
  return parts.join("\n");
}

// ──────────────────────────────────────────────
// Mount
// ──────────────────────────────────────────────
const app = document.getElementById("app");
if (app) {
  app.innerHTML = renderClusterSVG();
}

// Stats
const el = (id: string) => document.getElementById(id);
el("n-nodes")!.textContent = String(nodes.length);
el("n-fine")!.textContent = String(clusters[0]!.length);
el("n-coarse")!.textContent = String(clusters[1]!.length);
el("t-voronoi")!.textContent = `${tVor.toFixed(0)}ms`;
el("t-merge")!.textContent = `${tMerge.toFixed(0)}ms`;
el("t-total")!.textContent = `${totalTime.toFixed(0)}ms`;
