import type { CausalNode, MapRegion, Polygon, SentimentLabel } from "./types.js";
import { mergePolygons } from "./gvmap.js";
import { isSubsetOf, polygonCentroid } from "./utils/polygon.js";

function normalizeLevels(levels: string[][][]): string[][][] {
  const indexed = levels.map((level, i) => ({ level, i }));
  indexed.sort((a, b) => {
    const avgA = a.level.reduce((sum, cluster) => sum + cluster.length, 0) / Math.max(a.level.length, 1);
    const avgB = b.level.reduce((sum, cluster) => sum + cluster.length, 0) / Math.max(b.level.length, 1);
    return avgA - avgB || a.i - b.i; // stable: tiebreak by original order
  });
  return indexed.map((entry) => entry.level);
}

function dominantSentiment(nodeIds: string[], nodeMap: Map<string, CausalNode>): SentimentLabel | undefined {
  const counts = new Map<SentimentLabel, number>([
    ["positive", 0],
    ["negative", 0],
    ["neutral", 0],
  ]);

  for (const nodeId of nodeIds) {
    const sentiment = nodeMap.get(nodeId)?.sentiment;
    if (sentiment) {
      counts.set(sentiment, (counts.get(sentiment) ?? 0) + 1);
    }
  }

  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return top && top[1] > 0 ? top[0] : undefined;
}

function pickLabel(nodeIds: string[], nodeMap: Map<string, CausalNode>): string | undefined {
  return nodeIds.map((nodeId) => nodeMap.get(nodeId)?.label).find(Boolean);
}

function averageSentimentDegree(nodeIds: string[], nodeMap: Map<string, CausalNode>): number | undefined {
  let sum = 0;
  let count = 0;
  for (const nodeId of nodeIds) {
    const degree = nodeMap.get(nodeId)?.sentimentDegree;
    if (degree !== undefined) {
      sum += degree;
      count += 1;
    }
  }
  return count > 0 ? sum / count : undefined;
}

export function buildRegionsByLevel(
  levels: string[][][],
  cells: Record<string, Polygon>,
  nodes: CausalNode[],
): MapRegion[][] {
  const normalizedLevels = normalizeLevels(levels);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const regionsByLevel = normalizedLevels.map((clusters, levelIndex) =>
    clusters.map((cluster, clusterIndex) => {
      const polygons = cluster
        .map((nodeId) => cells[nodeId])
        .filter((polygon): polygon is Polygon => Boolean(polygon && polygon.length > 0));
      const polygon = mergePolygons(polygons);
      return {
        id: `L${levelIndex}-C${clusterIndex}`,
        level: levelIndex,
        label: pickLabel(cluster, nodeMap),
        sentiment: dominantSentiment(cluster, nodeMap),
        sentimentDegree: averageSentimentDegree(cluster, nodeMap),
        polygon,
        centroid: polygonCentroid(polygon),
        nodeIds: cluster,
        children: [] as string[],
      } satisfies MapRegion;
    }),
  );

  for (let levelIndex = 1; levelIndex < regionsByLevel.length; levelIndex += 1) {
    const parentLevel = regionsByLevel[levelIndex];
    const childLevel = regionsByLevel[levelIndex - 1];
    if (!parentLevel || !childLevel) {
      continue;
    }
    for (const parentRegion of parentLevel) {
      parentRegion.children = childLevel
        .filter((childRegion) => isSubsetOf(childRegion.nodeIds, parentRegion.nodeIds))
        .map((childRegion) => childRegion.id);
    }
  }

  // regionsByLevel is sorted finest-first (level 0 = smallest clusters).
  // Reverse so output is coarsest-first: level 0 = biggest regions ("countries"),
  // last level = finest regions ("cities"). Renderer draws from index 0 upward.
  return regionsByLevel.reverse();
}