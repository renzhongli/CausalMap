export type SentimentLabel = "positive" | "negative" | "neutral";

export interface CausalNode {
  id: string;
  timestamp: number;
  label?: string;
  sentiment?: SentimentLabel;
  /** Sentiment intensity in [0, 1]. Higher = stronger sentiment. Controls color lightness. */
  sentimentDegree?: number;
  metadata?: Record<string, unknown>;
}

export interface CausalEdge {
  source: string;
  target: string;
  weight?: number;
}

export interface HierarchicalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  clusters: string[][][];
}

export interface LayoutForces {
  repulsion?: number;
  edgeAttraction?: number;
  clusterAttraction?: number;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
  seed?: number;
  randomPointCount?: number;
  ticks?: number;
  forces?: LayoutForces;
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

export type Point = [number, number];
export type Polygon = Point[];

export interface MapRegion {
  id: string;
  level: number;
  label?: string;
  sentiment?: SentimentLabel;
  /** Average sentiment degree across all nodes in this region, in [0, 1]. Only present when nodes provide sentimentDegree. */
  sentimentDegree?: number;
  polygon: Polygon;
  centroid: Point;
  nodeIds: string[];
  children: string[];
}

export interface MapLayout {
  nodePositions: Record<string, NodePosition>;
  nodeCells: Record<string, Polygon>;
  regionsByLevel: MapRegion[][];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  edges: CausalEdge[];
}

export interface NormalizedLayoutOptions {
  width: number;
  height: number;
  padding: number;
  seed: number;
  randomPointCount: number;
  ticks: number;
  forces: Required<LayoutForces>;
}