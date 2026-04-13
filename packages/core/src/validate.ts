import type { HierarchicalGraph } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGraph(graph: HierarchicalGraph): ValidationResult {
  const errors: string[] = [];

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    errors.push("graph.nodes must be an array.");
    return { valid: false, errors };
  }

  if (!graph.edges || !Array.isArray(graph.edges)) {
    errors.push("graph.edges must be an array.");
    return { valid: false, errors };
  }

  if (!graph.clusters || !Array.isArray(graph.clusters)) {
    errors.push("graph.clusters must be an array of levels.");
    return { valid: false, errors };
  }

  if (graph.nodes.length === 0) {
    errors.push("graph.nodes is empty; at least one node is required.");
  }

  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  for (const node of graph.nodes) {
    if (typeof node.id !== "string" || node.id === "") {
      errors.push(`Node has invalid id: ${JSON.stringify(node.id)}`);
    }
    if (typeof node.timestamp !== "number" || !isFinite(node.timestamp)) {
      errors.push(`Node "${node.id}" has invalid timestamp.`);
    }
  }

  if (nodeIds.size !== graph.nodes.length) {
    errors.push("Duplicate node ids detected.");
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge source "${edge.source}" is not a known node.`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge target "${edge.target}" is not a known node.`);
    }
  }

  for (let levelIndex = 0; levelIndex < graph.clusters.length; levelIndex += 1) {
    const level = graph.clusters[levelIndex];
    if (!level || !Array.isArray(level)) {
      errors.push(`clusters[${levelIndex}] is not an array.`);
      continue;
    }
    const seen = new Set<string>();
    for (const cluster of level) {
      for (const id of cluster) {
        if (!nodeIds.has(id)) {
          errors.push(`clusters[${levelIndex}] references unknown node "${id}".`);
        }
        if (seen.has(id)) {
          errors.push(`clusters[${levelIndex}] contains duplicate node "${id}".`);
        }
        seen.add(id);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
