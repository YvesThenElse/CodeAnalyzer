import type { FileNode, ImportRelation } from '../renderer/src/types/graph.types'

/**
 * Detect communities in the file dependency graph using a simplified Louvain algorithm
 * Returns a map of fileId -> communityId
 */
export function detectCommunities(
  files: Map<string, FileNode>,
  relations: ImportRelation[]
): Map<string, string> {
  const communities = new Map<string, string>()

  // If no files or relations, each file is its own community
  if (files.size === 0 || relations.length === 0) {
    let i = 0
    for (const fileId of files.keys()) {
      communities.set(fileId, `community-${i++}`)
    }
    return communities
  }

  // Build adjacency list
  const adjacency = buildAdjacencyList(files, relations)

  // Initialize: each node is its own community
  const nodeToCommunity = new Map<string, string>()
  for (const fileId of files.keys()) {
    nodeToCommunity.set(fileId, fileId)
  }

  // Simplified Louvain: iterate until no improvement
  let improved = true
  let iterations = 0
  const maxIterations = 10

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    for (const nodeId of files.keys()) {
      const currentCommunity = nodeToCommunity.get(nodeId)!
      const neighbors = adjacency.get(nodeId) || new Set()

      // Find the best community among neighbors
      const communityCounts = new Map<string, number>()

      for (const neighborId of neighbors) {
        const neighborCommunity = nodeToCommunity.get(neighborId)!
        communityCounts.set(neighborCommunity, (communityCounts.get(neighborCommunity) || 0) + 1)
      }

      // Find community with most connections
      let bestCommunity = currentCommunity
      let bestCount = communityCounts.get(currentCommunity) || 0

      for (const [community, count] of communityCounts) {
        if (count > bestCount) {
          bestCount = count
          bestCommunity = community
        }
      }

      // Move to best community if different
      if (bestCommunity !== currentCommunity) {
        nodeToCommunity.set(nodeId, bestCommunity)
        improved = true
      }
    }
  }

  // Normalize community IDs (rename to consecutive numbers)
  const uniqueCommunities = new Set(nodeToCommunity.values())
  const communityRemap = new Map<string, string>()
  let communityIndex = 0

  for (const comm of uniqueCommunities) {
    communityRemap.set(comm, `community-${communityIndex++}`)
  }

  // Build final result with normalized IDs
  for (const [nodeId, community] of nodeToCommunity) {
    communities.set(nodeId, communityRemap.get(community)!)
  }

  return communities
}

/**
 * Build adjacency list from relations (bidirectional)
 */
function buildAdjacencyList(
  files: Map<string, FileNode>,
  relations: ImportRelation[]
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()

  // Initialize empty sets for all files
  for (const fileId of files.keys()) {
    adjacency.set(fileId, new Set())
  }

  // Add edges (bidirectional for community detection)
  for (const rel of relations) {
    if (adjacency.has(rel.sourceFileId) && adjacency.has(rel.targetFileId)) {
      adjacency.get(rel.sourceFileId)!.add(rel.targetFileId)
      adjacency.get(rel.targetFileId)!.add(rel.sourceFileId)
    }
  }

  return adjacency
}

/**
 * Calculate modularity score for the current community assignment
 * (For potential future use in more sophisticated algorithms)
 */
export function calculateModularity(
  files: Map<string, FileNode>,
  relations: ImportRelation[],
  communities: Map<string, string>
): number {
  const m = relations.length
  if (m === 0) return 0

  const degree = new Map<string, number>()

  // Calculate degree for each node
  for (const fileId of files.keys()) {
    degree.set(fileId, 0)
  }

  for (const rel of relations) {
    degree.set(rel.sourceFileId, (degree.get(rel.sourceFileId) || 0) + 1)
    degree.set(rel.targetFileId, (degree.get(rel.targetFileId) || 0) + 1)
  }

  // Calculate modularity
  let q = 0

  for (const rel of relations) {
    const ci = communities.get(rel.sourceFileId)
    const cj = communities.get(rel.targetFileId)

    if (ci === cj) {
      const ki = degree.get(rel.sourceFileId) || 0
      const kj = degree.get(rel.targetFileId) || 0
      q += 1 - (ki * kj) / (2 * m)
    }
  }

  return q / (2 * m)
}
