/*
 * CodeAnalyzer - Interactive dependency graph viewer
 * Copyright (C) 2025
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
