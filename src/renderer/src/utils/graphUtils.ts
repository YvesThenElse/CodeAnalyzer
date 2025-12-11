import {
  type AnalyzedGraph,
  type SerializedAnalyzedGraph,
  ClusteringMode
} from '../types/graph.types'

/**
 * Deserialize a graph received from IPC (converts files array back to Map)
 */
export function deserializeGraph(serialized: SerializedAnalyzedGraph): AnalyzedGraph {
  return {
    rootPath: serialized.rootPath,
    name: serialized.name,
    analyzedAt: new Date(serialized.analyzedAt),
    files: new Map(serialized.files),
    relations: serialized.relations,
    clusters: {
      [ClusteringMode.FOLDER]: serialized.clusters.folder,
      [ClusteringMode.COMMUNITY]: serialized.clusters.community
    },
    rootFolders: serialized.rootFolders,
    stats: serialized.stats
  }
}
