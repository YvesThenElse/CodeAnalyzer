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

// ===== ENUMERATIONS =====

export enum GraphLevel {
  FILES = 1,
  CODE = 2
}

export enum FileNodeType {
  SOURCE_FILE = 'source_file',
  INDEX_FILE = 'index_file',
  TEST_FILE = 'test_file',
  CONFIG_FILE = 'config_file'
}

export enum CodeItemType {
  FUNCTION = 'function',
  CLASS = 'class',
  CONST = 'const',
  REACT_COMPONENT = 'react_component',
  HOOK = 'hook',
  TYPE = 'type',
  INTERFACE = 'interface'
}

export enum ClusteringMode {
  FOLDER = 'folder',
  COMMUNITY = 'community'
}

// ===== FILE NODE =====

export interface FileNode {
  id: string
  filePath: string
  relativePath: string
  fileName: string
  folder: string
  folderDepth: number
  rootFolder: string
  type: FileNodeType
  codeItems: CodeItem[]
  imports: FileImport[]
  externalImports: string[]
  communityId?: string
  color: string
}

export interface FileImport {
  targetFileId: string
  specifiers: string[]
  line: number
}

export interface CodeItem {
  id: string
  name: string
  type: CodeItemType
  isExported: boolean
  isDefault: boolean
  line: number
  signature?: string
}

// ===== RELATIONS =====

export interface ImportRelation {
  id: string
  sourceFileId: string
  targetFileId: string
  specifiers: string[]
  label: string
}

// ===== CLUSTERS =====

export interface Cluster {
  id: string
  name: string
  folderPath: string
  fileIds: string[]
  color: string
  depth: number
  mode: ClusteringMode
}

// ===== ANALYZED GRAPH =====

export interface AnalyzedGraph {
  rootPath: string
  name: string
  analyzedAt: Date
  files: Map<string, FileNode>
  relations: ImportRelation[]
  clusters: {
    [ClusteringMode.FOLDER]: Cluster[]
    [ClusteringMode.COMMUNITY]: Cluster[]
  }
  rootFolders: string[]
  stats: GraphStats
}

// Serializable version for IPC
export interface SerializedAnalyzedGraph {
  rootPath: string
  name: string
  analyzedAt: string
  files: [string, FileNode][]
  relations: ImportRelation[]
  clusters: {
    folder: Cluster[]
    community: Cluster[]
  }
  rootFolders: string[]
  stats: GraphStats
}

export interface GraphStats {
  totalFiles: number
  totalCodeItems: number
  totalImports: number
  averageImportsPerFile: number
  mostConnectedFiles: string[]
}

// ===== NAVIGATION STATE =====

export interface GraphNavigationState {
  currentLevel: GraphLevel
  focusedFileId: string | null
  selectedFileId: string | null
  clusteringMode: ClusteringMode
  showClusters: boolean
}

// ===== REACT FLOW TYPES =====

export interface FileNodeData {
  file: FileNode
  cluster?: Cluster
  isPrimary: boolean
  isHighlighted: boolean
  importCount: number
  dependentCount: number
}

export interface CodeItemNodeData {
  item: CodeItem
  file: FileNode
  isExternalRef: boolean
}

export interface ImportEdgeData {
  relation: ImportRelation
  isHighlighted: boolean
}

// ===== COLOR UTILITIES =====

export interface FolderColorMap {
  [folderPath: string]: string
}
