import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import {
  GraphLevel,
  ClusteringMode,
  type AnalyzedGraph,
  type SerializedAnalyzedGraph,
  type FileNode,
  type CodeItem,
  type FileNodeData,
  type CodeItemNodeData,
  type ImportRelation,
  type Cluster
} from '../types/graph.types'
import type { AnalysisProgress } from '../types/electron.types'
import { calculateLayout } from '../utils/layoutUtils'

// Define types for our custom nodes
type GraphFileNode = Node<FileNodeData, 'fileNode'>
type GraphCodeNode = Node<CodeItemNodeData, 'codeItemNode'>
type GraphNode = GraphFileNode | GraphCodeNode

interface GraphState {
  // Project data
  graph: AnalyzedGraph | null
  isLoading: boolean
  error: string | null
  progress: AnalysisProgress | null

  // Navigation
  currentLevel: GraphLevel
  focusedFileId: string | null
  selectedFileId: string | null

  // Clustering
  clusteringMode: ClusteringMode
  showClusters: boolean

  // Selection & Highlight
  selectedNodeId: string | null
  highlightedFileIds: Set<string>

  // Actions
  setGraph: (graph: SerializedAnalyzedGraph) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setProgress: (progress: AnalysisProgress | null) => void

  // Navigation actions
  focusOnFile: (fileId: string) => void
  drillDownToCode: (fileId: string) => void
  goBackToFiles: () => void

  // Clustering actions
  setClusteringMode: (mode: ClusteringMode) => void
  setShowClusters: (show: boolean) => void

  // Selection actions
  setSelectedNodeId: (id: string | null) => void
  highlightRelatedFiles: (fileId: string) => void
  clearHighlight: () => void

  // Reset
  reset: () => void

  // Selectors
  getVisibleNodesAndEdges: () => { nodes: GraphNode[]; edges: Edge[] }
  getSelectedFile: () => FileNode | null
  getSelectedCodeItem: () => CodeItem | null
  getFileCodeItems: (fileId: string) => CodeItem[]
  getClustersForCurrentMode: () => Cluster[]
  getRelatedFiles: (fileId: string) => { imports: FileNode[]; importedBy: FileNode[] }
  getAllFilePaths: () => Set<string>
  getFocusedFilePath: () => string | null
}

/**
 * Deserialize graph from IPC transfer with defensive checks
 */
function deserializeGraph(serialized: SerializedAnalyzedGraph): AnalyzedGraph {
  // Defensive checks for malformed data
  if (!serialized) {
    throw new Error('No graph data received from analysis')
  }

  if (!serialized.files || !Array.isArray(serialized.files)) {
    throw new Error('Invalid graph data: files is missing or not an array')
  }

  // Safely create the files Map, filtering out any invalid entries
  const validFiles: [string, FileNode][] = serialized.files.filter(
    (entry): entry is [string, FileNode] =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      entry[1] !== null &&
      typeof entry[1] === 'object'
  )

  return {
    rootPath: serialized.rootPath || '',
    name: serialized.name || 'Unknown Project',
    analyzedAt: serialized.analyzedAt ? new Date(serialized.analyzedAt) : new Date(),
    files: new Map(validFiles),
    relations: Array.isArray(serialized.relations) ? serialized.relations : [],
    clusters: {
      [ClusteringMode.FOLDER]: serialized.clusters?.folder || [],
      [ClusteringMode.COMMUNITY]: serialized.clusters?.community || []
    },
    rootFolders: Array.isArray(serialized.rootFolders) ? serialized.rootFolders : [],
    stats: serialized.stats || {
      totalFiles: validFiles.length,
      totalCodeItems: 0,
      totalImports: 0,
      averageImportsPerFile: 0,
      mostConnectedFiles: []
    }
  }
}

export const useGraphStore = create<GraphState>((set, get) => ({
  // Initial state
  graph: null,
  isLoading: false,
  error: null,
  progress: null,
  currentLevel: GraphLevel.FILES,
  focusedFileId: null,
  selectedFileId: null,
  clusteringMode: ClusteringMode.FOLDER,
  showClusters: true,
  selectedNodeId: null,
  highlightedFileIds: new Set(),

  // Actions
  setGraph: (serialized) => {
    try {
      const graph = deserializeGraph(serialized)
      // Auto-focus on first file if any
      const firstFileId = graph.files.size > 0 ? Array.from(graph.files.keys())[0] : null
      set({
        graph,
        error: null,
        focusedFileId: firstFileId,
        currentLevel: GraphLevel.FILES
      })
    } catch (error) {
      console.error('Failed to deserialize graph:', error)
      set({
        graph: null,
        error: `Failed to process analysis results: ${(error as Error).message}`,
        isLoading: false
      })
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setProgress: (progress) => set({ progress }),

  // Navigation actions
  focusOnFile: (fileId) => {
    const { graph } = get()
    if (!graph || !graph.files.has(fileId)) return

    set({
      focusedFileId: fileId,
      currentLevel: GraphLevel.FILES,
      selectedNodeId: fileId,
      highlightedFileIds: new Set()
    })
  },

  drillDownToCode: (fileId) => {
    const { graph } = get()
    if (!graph || !graph.files.has(fileId)) return

    set({
      currentLevel: GraphLevel.CODE,
      selectedFileId: fileId,
      selectedNodeId: null,
      highlightedFileIds: new Set()
    })
  },

  goBackToFiles: () => {
    const { selectedFileId } = get()
    set({
      currentLevel: GraphLevel.FILES,
      focusedFileId: selectedFileId,
      selectedFileId: null,
      selectedNodeId: selectedFileId,
      highlightedFileIds: new Set()
    })
  },

  // Clustering actions
  setClusteringMode: (mode) => set({ clusteringMode: mode }),
  setShowClusters: (show) => set({ showClusters: show }),

  // Selection actions
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  highlightRelatedFiles: (fileId) => {
    const { graph } = get()
    if (!graph) return

    const highlighted = new Set<string>()
    highlighted.add(fileId)

    // Find files that this file imports
    for (const rel of graph.relations) {
      if (rel.sourceFileId === fileId) {
        highlighted.add(rel.targetFileId)
      }
      if (rel.targetFileId === fileId) {
        highlighted.add(rel.sourceFileId)
      }
    }

    set({ highlightedFileIds: highlighted })
  },

  clearHighlight: () => set({ highlightedFileIds: new Set() }),

  reset: () =>
    set({
      graph: null,
      isLoading: false,
      error: null,
      progress: null,
      currentLevel: GraphLevel.FILES,
      focusedFileId: null,
      selectedFileId: null,
      clusteringMode: ClusteringMode.FOLDER,
      showClusters: true,
      selectedNodeId: null,
      highlightedFileIds: new Set()
    }),

  // Selectors
  getVisibleNodesAndEdges: () => {
    const { graph, currentLevel, focusedFileId, selectedFileId, highlightedFileIds } = get()

    if (!graph) {
      return { nodes: [], edges: [] }
    }

    if (currentLevel === GraphLevel.FILES) {
      return getFileNodesAndEdges(graph, focusedFileId, highlightedFileIds)
    } else {
      return getCodeNodesAndEdges(graph, selectedFileId)
    }
  },

  getSelectedFile: () => {
    const { graph, selectedNodeId, currentLevel } = get()
    if (!graph || !selectedNodeId || currentLevel !== GraphLevel.FILES) return null
    return graph.files.get(selectedNodeId) || null
  },

  getSelectedCodeItem: () => {
    const { graph, selectedNodeId, currentLevel, selectedFileId } = get()
    if (!graph || !selectedNodeId || currentLevel !== GraphLevel.CODE || !selectedFileId) return null

    const file = graph.files.get(selectedFileId)
    if (!file) return null

    return file.codeItems.find((item) => item.id === selectedNodeId) || null
  },

  getFileCodeItems: (fileId) => {
    const { graph } = get()
    if (!graph) return []

    const file = graph.files.get(fileId)
    return file?.codeItems || []
  },

  getClustersForCurrentMode: () => {
    const { graph, clusteringMode } = get()
    if (!graph) return []

    return graph.clusters[clusteringMode] || []
  },

  getRelatedFiles: (fileId) => {
    const { graph } = get()
    if (!graph) return { imports: [], importedBy: [] }

    const imports: FileNode[] = []
    const importedBy: FileNode[] = []

    for (const rel of graph.relations) {
      if (rel.sourceFileId === fileId) {
        const targetFile = graph.files.get(rel.targetFileId)
        if (targetFile) imports.push(targetFile)
      }
      if (rel.targetFileId === fileId) {
        const sourceFile = graph.files.get(rel.sourceFileId)
        if (sourceFile) importedBy.push(sourceFile)
      }
    }

    return { imports, importedBy }
  },

  getAllFilePaths: () => {
    const { graph } = get()
    const paths = new Set<string>()

    if (!graph) return paths

    for (const file of graph.files.values()) {
      paths.add(file.filePath)
    }

    return paths
  },

  getFocusedFilePath: () => {
    const { graph, focusedFileId } = get()
    if (!graph || !focusedFileId) return null

    const file = graph.files.get(focusedFileId)
    return file?.filePath || null
  }
}))

/**
 * Get file-level nodes and edges centered on focused file
 */
function getFileNodesAndEdges(
  graph: AnalyzedGraph,
  focusedFileId: string | null,
  highlightedFileIds: Set<string>
): { nodes: GraphNode[]; edges: Edge[] } {
  const nodes: GraphFileNode[] = []
  const edges: Edge[] = []
  const visibleFileIds = new Set<string>()

  if (!focusedFileId) {
    // No focus - show all files (may be many!)
    for (const file of graph.files.values()) {
      visibleFileIds.add(file.id)
    }
  } else {
    // Show focused file and its direct relations
    visibleFileIds.add(focusedFileId)

    for (const rel of graph.relations) {
      if (rel.sourceFileId === focusedFileId) {
        visibleFileIds.add(rel.targetFileId)
      }
      if (rel.targetFileId === focusedFileId) {
        visibleFileIds.add(rel.sourceFileId)
      }
    }
  }

  // Create nodes
  for (const fileId of visibleFileIds) {
    const file = graph.files.get(fileId)
    if (!file) continue

    // Count imports and dependents
    let importCount = 0
    let dependentCount = 0
    for (const rel of graph.relations) {
      if (rel.sourceFileId === fileId) importCount++
      if (rel.targetFileId === fileId) dependentCount++
    }

    nodes.push({
      id: file.id,
      type: 'fileNode',
      position: { x: 0, y: 0 },
      data: {
        file,
        isPrimary: file.id === focusedFileId,
        isHighlighted: highlightedFileIds.has(file.id),
        importCount,
        dependentCount
      }
    })
  }

  // Create edges for visible files
  for (const rel of graph.relations) {
    if (visibleFileIds.has(rel.sourceFileId) && visibleFileIds.has(rel.targetFileId)) {
      edges.push({
        id: rel.id,
        source: rel.sourceFileId,
        target: rel.targetFileId,
        type: 'importEdge',
        label: rel.label,
        animated: rel.sourceFileId === focusedFileId || rel.targetFileId === focusedFileId,
        data: {
          relation: rel,
          isHighlighted: highlightedFileIds.has(rel.sourceFileId) && highlightedFileIds.has(rel.targetFileId)
        }
      })
    }
  }

  // Calculate layout
  const layoutedNodes = calculateLayout(nodes, edges)

  return { nodes: layoutedNodes as GraphNode[], edges }
}

/**
 * Get code-level nodes for a specific file
 */
function getCodeNodesAndEdges(
  graph: AnalyzedGraph,
  selectedFileId: string | null
): { nodes: GraphNode[]; edges: Edge[] } {
  if (!selectedFileId) {
    return { nodes: [], edges: [] }
  }

  const file = graph.files.get(selectedFileId)
  if (!file) {
    return { nodes: [], edges: [] }
  }

  const nodes: GraphCodeNode[] = file.codeItems.map((item, index) => ({
    id: item.id,
    type: 'codeItemNode',
    position: { x: 0, y: index * 80 }, // Simple vertical layout
    data: {
      item,
      file,
      isExternalRef: false
    }
  }))

  // No edges at code level (for now - could add internal call graph later)
  const edges: Edge[] = []

  // Calculate layout
  const layoutedNodes = calculateLayout(nodes, edges)

  return { nodes: layoutedNodes as GraphNode[], edges }
}
