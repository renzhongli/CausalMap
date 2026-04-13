import type { MapLayout, MapRegion, Point, Polygon, SentimentLabel } from "@causalmap/core";

export interface RenderOptions {
  /** Show causal edges. Defaults to false (paper: "we opt not to visualize individual edges directly"). */
  showEdges?: boolean;
  showNodes?: boolean;
  showLabels?: boolean;
  background?: string;
  regionOpacity?: number;
  palette?: Partial<Record<SentimentLabel, string>>;
  /** Region IDs forming a contagion pathway — their boundaries are highlighted. */
  highlightedPathway?: string[];
  /** Show a sentiment line chart below the map. Defaults to false. */
  showLineChart?: boolean;
}

const defaultPalette: Record<SentimentLabel, string> = {
  positive: "#e76f51",
  negative: "#6a994e",
  neutral: "#7b6d8d",
};

function polygonPath(polygon: Polygon): string {
  if (polygon.length === 0) {
    return "";
  }
  const [first, ...rest] = polygon;
  if (!first) {
    return "";
  }
  return [`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`]
    .concat(rest.map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`))
    .concat("Z")
    .join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Parse hex color to [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Convert RGB to HSL (h in [0,360], s/l in [0,1]). */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Convert HSL back to hex string. */
function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Modulate a base sentiment color by sentimentDegree.
 * Paper: "lightness of the color indicates the degree of sentiment —
 * the darker the color, the higher the degree."
 * degree 1 → base lightness; degree 0 → lighter (washed out).
 */
function modulateColor(baseHex: string, degree: number): string {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, baseL] = rgbToHsl(r, g, b);
  // Map degree [0,1] → lightness [0.88 (very light) ... baseL (full color)]
  const lightL = 0.88;
  const l = lightL + (baseL - lightL) * degree;
  return hslToHex(h, s, l);
}

function colorForRegion(region: MapRegion, options: RenderOptions): string {
  const palette = { ...defaultPalette, ...options.palette };
  const baseColor = region.sentiment ? palette[region.sentiment] : "#c9c2b8";
  // If region has sentiment degree, modulate lightness
  if (region.sentimentDegree !== undefined && region.sentiment) {
    return modulateColor(baseColor, region.sentimentDegree);
  }
  return baseColor;
}

function drawEdges(layout: MapLayout): string {
  return layout.edges
    .map((edge) => {
      const source = layout.nodePositions[edge.source];
      const target = layout.nodePositions[edge.target];
      if (!source || !target) {
        return "";
      }
      const midpointX = (source.x + target.x) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const offset = Math.max(distance * 0.08, 18);
      return `<path d="M ${source.x.toFixed(2)} ${source.y.toFixed(2)} C ${midpointX.toFixed(2)} ${(source.y - offset).toFixed(2)} ${midpointX.toFixed(2)} ${(target.y + offset).toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}" fill="none" stroke="rgba(16,37,66,0.18)" stroke-width="${(edge.weight ?? 1).toFixed(2)}" stroke-linecap="round" />`;
    })
    .join("\n");
}

function drawRegions(levels: MapRegion[][], options: RenderOptions): string {
  const levelCount = levels.length;
  const highlightSet = new Set(options.highlightedPathway ?? []);
  return levels
    .map((regions, levelIndex) => {
      // Coarsest level (index 0) gets light fill; finest level gets strongest fill
      const depthOpacity = levelCount <= 1
        ? (options.regionOpacity ?? 0.72)
        : 0.22 + ((options.regionOpacity ?? 0.72) - 0.22) * (levelIndex / (levelCount - 1));
      // Coarsest borders are thickest; finest borders are thinnest
      const strokeWidth = Math.max(2.8 - levelIndex * 0.55, 0.6);
      return `<g data-level="${levelIndex}">${regions
        .map((region) => {
          const d = polygonPath(region.polygon);
          if (!d) {
            return "";
          }
          const isHighlighted = highlightSet.has(region.id);
          const stroke = isHighlighted ? "#d62828" : "rgba(16,37,66,0.72)";
          const sw = isHighlighted ? Math.max(strokeWidth * 2.5, 3) : strokeWidth;
          return `<path d="${d}" fill="${colorForRegion(region, options)}" fill-opacity="${depthOpacity.toFixed(2)}" stroke="${stroke}" stroke-width="${sw.toFixed(2)}" stroke-linejoin="round"${isHighlighted ? ' class="pathway-highlight"' : ""}><title>${escapeHtml(region.label ?? region.id)}</title></path>`;
        })
        .join("\n")}</g>`;
    })
    .join("\n");
}

function drawLabels(levels: MapRegion[][]): string {
  const parts: string[] = [];
  // Draw coarse-level labels (big font) and fine-level labels (small font)
  for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    const regions = levels[levelIndex];
    if (!regions) {
      continue;
    }
    const isFinest = levelIndex === levels.length - 1;
    const fontSize = isFinest ? 11 : Math.max(18 - levelIndex * 3, 11);
    const opacity = isFinest ? 0.85 : 0.55;
    for (const region of regions) {
      const label = region.label ?? region.id;
      const [x, y] = region.centroid;
      parts.push(
        `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="${isFinest ? 600 : 700}" fill="#102542" fill-opacity="${opacity}">${escapeHtml(label)}</text>`,
      );
    }
  }
  return parts.join("\n");
}

function drawNodes(layout: MapLayout): string {
  return Object.values(layout.nodePositions)
    .map(
      (position) =>
        `<circle cx="${position.x.toFixed(2)}" cy="${position.y.toFixed(2)}" r="4.5" fill="#102542" fill-opacity="0.8" />`,
    )
    .join("\n");
}

function drawLineChart(layout: MapLayout, chartWidth: number): string {
  // Group nodes by time interval and sentiment
  const positions = Object.values(layout.nodePositions);
  if (positions.length === 0) return "";

  const allNodes = layout.regionsByLevel.flatMap((level) => level.flatMap((r) => r.nodeIds));
  // Build a map nodeId → sentiment from finest level regions
  const nodeSentiment = new Map<string, SentimentLabel>();
  const finestLevel = layout.regionsByLevel[layout.regionsByLevel.length - 1];
  if (finestLevel) {
    for (const region of finestLevel) {
      if (region.sentiment) {
        for (const nid of region.nodeIds) {
          nodeSentiment.set(nid, region.sentiment);
        }
      }
    }
  }

  // Bucket by x-position (proxy for time)
  const xs = positions.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const bucketCount = Math.min(20, Math.max(5, Math.floor(positions.length / 5)));
  const bucketWidth = (xMax - xMin) / bucketCount || 1;

  const counts: Record<SentimentLabel, number[]> = {
    positive: new Array(bucketCount).fill(0) as number[],
    negative: new Array(bucketCount).fill(0) as number[],
    neutral: new Array(bucketCount).fill(0) as number[],
  };

  for (const pos of positions) {
    const bucket = Math.min(Math.floor((pos.x - xMin) / bucketWidth), bucketCount - 1);
    const sent = nodeSentiment.get(pos.id) ?? "neutral";
    const arr = counts[sent];
    if (arr) arr[bucket] = (arr[bucket] ?? 0) + 1;
  }

  const chartHeight = 80;
  const maxCount = Math.max(1, ...Object.values(counts).flatMap((c) => c));
  const barW = chartWidth / bucketCount;

  const sentimentOrder: SentimentLabel[] = ["positive", "neutral", "negative"];
  const colors: Record<SentimentLabel, string> = defaultPalette;

  // Stacked area chart
  const paths: string[] = [];
  for (const sent of sentimentOrder) {
    const pts = counts[sent].map((c, i) => {
      const x = (i + 0.5) * barW;
      const y = chartHeight - (c / maxCount) * (chartHeight - 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    paths.push(
      `<polyline points="${pts.join(" ")}" fill="none" stroke="${colors[sent]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />`,
    );
  }

  // X-axis line
  const axisLine = `<line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="#888" stroke-width="0.5" />`;

  return `<g transform="translate(0, 0)">${axisLine}\n${paths.join("\n")}</g>`;
}

export function renderSVG(layout: MapLayout, options: RenderOptions = {}): string {
  const width = layout.bounds.maxX - layout.bounds.minX;
  const height = layout.bounds.maxY - layout.bounds.minY;
  const chartHeight = options.showLineChart ? 100 : 0;
  const totalHeight = height + chartHeight;
  return `
<svg viewBox="0 0 ${width} ${totalHeight}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CausalMap output">
  <rect width="${width}" height="${height}" fill="${options.background ?? "#f8f4ec"}" rx="28" ry="28" />
  ${options.showEdges ? drawEdges(layout) : ""}
  ${drawRegions(layout.regionsByLevel, options)}
  ${options.showNodes === false ? "" : drawNodes(layout)}
  ${options.showLabels === false ? "" : drawLabels(layout.regionsByLevel)}
  ${options.showLineChart ? `<g transform="translate(0, ${height + 10})">${drawLineChart(layout, width)}</g>` : ""}
</svg>`.trim();
}

export type { MapLayout, MapRegion, Point, Polygon, SentimentLabel };