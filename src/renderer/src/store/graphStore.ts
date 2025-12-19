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

import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import {
  GraphLevel,
  ClusteringMode,
  CodeItemType,
  LogicNodeType,
  type AnalyzedGraph,
  type SerializedAnalyzedGraph,
  type FileNode,
  type CodeItem,
  type FileNodeData,
  type CodeItemNodeData,
  type CodeGroupNodeData,
  type ImportRelation,
  type Cluster,
  type FunctionLogic,
  type LogicNodeData
} from '../types/graph.types'
import type { AnalysisProgress, LLMConfig, LLMProgress, FileDescription } from '../types/electron.types'
import { calculateLayout } from '../utils/layoutUtils'
import { getUniqueFolderColor } from '../utils/colorUtils'

// Define types for our custom nodes
type GraphFileNode = Node<FileNodeData, 'fileNode'>
type GraphCodeNode = Node<CodeItemNodeData, 'codeItemNode'>
type GraphCodeGroupNode = Node<CodeGroupNodeData, 'codeGroupNode'>
type GraphLogicNode = Node<LogicNodeData, 'logicNode'>
type GraphNode = GraphFileNode | GraphCodeNode | GraphCodeGroupNode | GraphLogicNode

interface GraphState {
  // Project data
  graph: AnalyzedGraph | null
  isLoading: boolean
  error: string | null
  progress: AnalysisProgress | null

  // Folder colors mapping (folder path -> HSL color)
  folderColors: Map<string, string>

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
  hoveredFileId: string | null

  // Code view state
  collapsedCodeGroups: Set<string>

  // Function logic state
  functionLogic: FunctionLogic | null
  selectedFunction: { name: string; line: number; fileId: string } | null
  loadingFunctionLogic: boolean
  hoveredLogicNodeId: string | null
  selectedLogicNodeId: string | null

  // LLM State
  llmConfig: LLMConfig | null
  descriptions: Record<string, FileDescription>
  llmLoading: boolean
  llmProgress: LLMProgress | null
  llmError: string | null

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
  setHoveredFileId: (fileId: string | null) => void

  // Code view actions
  toggleCodeGroup: (groupType: string) => void

  // Function logic actions
  drillDownToFunctionLogic: (functionName: string, functionLine: number) => Promise<void>
  goBackToCode: () => void
  setFunctionLogic: (logic: FunctionLogic | null) => void
  setHoveredLogicNodeId: (id: string | null) => void
  setSelectedLogicNodeId: (id: string | null) => void
  getLogicNodeLine: (nodeId: string) => number | null

  // Reset
  reset: () => void

  // LLM Actions
  setLLMConfig: (config: LLMConfig | null) => void
  setDescriptions: (descriptions: Record<string, FileDescription>) => void
  addDescription: (fileId: string, description: FileDescription) => void
  setLLMLoading: (loading: boolean) => void
  setLLMProgress: (progress: LLMProgress | null) => void
  setLLMError: (error: string | null) => void
  getFileDescription: (fileId: string) => FileDescription | null

  // Selectors
  getVisibleNodesAndEdges: () => { nodes: GraphNode[]; edges: Edge[] }
  getSelectedFile: () => FileNode | null
  getSelectedCodeItem: () => CodeItem | null
  getFileCodeItems: (fileId: string) => CodeItem[]
  getClustersForCurrentMode: () => Cluster[]
  getRelatedFiles: (fileId: string) => { imports: FileNode[]; importedBy: FileNode[] }
  getAllFilePaths: () => Set<string>
  getFocusedFilePath: () => string | null
  getFolderColor: (folderPath: string) => string | undefined
  getVisibleFilesInfo: () => Map<string, 'primary' | 'import' | 'usedBy'>
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

/**
 * Compute unique colors for all folders in the graph.
 * Folders are sorted alphabetically to ensure consistent colors across sessions.
 */
function computeFolderColors(graph: AnalyzedGraph): Map<string, string> {
  const folderColors = new Map<string, string>()

  // Collect all unique folder paths
  const folders = new Set<string>()
  for (const file of graph.files.values()) {
    if (file.folder) {
      folders.add(file.folder)
      // Also add parent folders
      const parts = file.folder.split('/')
      let current = ''
      for (const part of parts) {
        current = current ? `${current}/${part}` : part
        folders.add(current)
      }
    }
  }

  // Sort folders alphabetically for consistent color assignment
  const sortedFolders = Array.from(folders).sort()

  // Assign unique colors using the golden ratio algorithm
  sortedFolders.forEach((folder, index) => {
    folderColors.set(folder, getUniqueFolderColor(index))
  })

  return folderColors
}

export const useGraphStore = create<GraphState>((set, get) => ({
  // Initial state
  graph: null,
  isLoading: false,
  error: null,
  progress: null,
  folderColors: new Map(),
  currentLevel: GraphLevel.FILES,
  focusedFileId: null,
  selectedFileId: null,
  clusteringMode: ClusteringMode.FOLDER,
  showClusters: true,
  selectedNodeId: null,
  highlightedFileIds: new Set(),
  hoveredFileId: null,
  collapsedCodeGroups: new Set(),
  functionLogic: null,
  selectedFunction: null,
  loadingFunctionLogic: false,
  hoveredLogicNodeId: null,
  selectedLogicNodeId: null,
  llmConfig: null,
  descriptions: {},
  llmLoading: false,
  llmProgress: null,
  llmError: null,

  // Actions
  setGraph: (serialized) => {
    try {
      const graph = deserializeGraph(serialized)

      // Compute unique folder colors
      const folderColors = computeFolderColors(graph)

      // Update file colors to use the new folder-based colors
      for (const file of graph.files.values()) {
        const folderColor = folderColors.get(file.folder)
        if (folderColor) {
          file.color = folderColor
        }
      }

      // Auto-focus on first file if any
      const firstFileId = graph.files.size > 0 ? Array.from(graph.files.keys())[0] : null
      set({
        graph,
        folderColors,
        error: null,
        focusedFileId: firstFileId,
        currentLevel: GraphLevel.FILES
      })
    } catch (error) {
      console.error('Failed to deserialize graph:', error)
      set({
        graph: null,
        folderColors: new Map(),
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

  clearHighlight: () => set({ highlightedFileIds: new Set(), hoveredFileId: null }),

  setHoveredFileId: (fileId) => set({ hoveredFileId: fileId }),

  toggleCodeGroup: (groupType) =>
    set((state) => {
      const newCollapsed = new Set(state.collapsedCodeGroups)
      if (newCollapsed.has(groupType)) {
        newCollapsed.delete(groupType)
      } else {
        newCollapsed.add(groupType)
      }
      return { collapsedCodeGroups: newCollapsed }
    }),

  // Function logic actions
  drillDownToFunctionLogic: async (functionName, functionLine) => {
    const { graph, selectedFileId } = get()
    if (!graph || !selectedFileId) return

    const file = graph.files.get(selectedFileId)
    if (!file) return

    set({
      loadingFunctionLogic: true,
      selectedFunction: { name: functionName, line: functionLine, fileId: selectedFileId }
    })

    try {
      const logic = await window.electronAPI.getFunctionLogic(file.filePath, functionName, functionLine)
      if (logic) {
        set({
          functionLogic: logic,
          currentLevel: GraphLevel.FUNCTION_LOGIC,
          loadingFunctionLogic: false
        })
      } else {
        console.error('Could not parse function logic')
        set({
          loadingFunctionLogic: false,
          selectedFunction: null
        })
      }
    } catch (error) {
      console.error('Error loading function logic:', error)
      set({
        loadingFunctionLogic: false,
        selectedFunction: null
      })
    }
  },

  goBackToCode: () => {
    const { selectedFunction } = get()
    set({
      currentLevel: GraphLevel.CODE,
      functionLogic: null,
      selectedFileId: selectedFunction?.fileId || null,
      selectedFunction: null
    })
  },

  setFunctionLogic: (logic) => set({ functionLogic: logic }),

  setHoveredLogicNodeId: (id) => set({ hoveredLogicNodeId: id }),

  setSelectedLogicNodeId: (id) => set({ selectedLogicNodeId: id }),

  getLogicNodeLine: (nodeId) => {
    const { functionLogic } = get()
    if (!functionLogic) return null
    const node = functionLogic.nodes.find(n => n.id === nodeId)
    return node?.line ?? null
  },

  reset: () =>
    set({
      graph: null,
      isLoading: false,
      error: null,
      progress: null,
      folderColors: new Map(),
      currentLevel: GraphLevel.FILES,
      focusedFileId: null,
      selectedFileId: null,
      clusteringMode: ClusteringMode.FOLDER,
      showClusters: true,
      selectedNodeId: null,
      highlightedFileIds: new Set(),
      hoveredFileId: null,
      collapsedCodeGroups: new Set(),
      functionLogic: null,
      selectedFunction: null,
      loadingFunctionLogic: false,
      hoveredLogicNodeId: null,
      selectedLogicNodeId: null,
      llmConfig: null,
      descriptions: {},
      llmLoading: false,
      llmProgress: null,
      llmError: null
    }),

  // LLM Actions
  setLLMConfig: (config) => set({ llmConfig: config }),
  setDescriptions: (descriptions) => set({ descriptions }),
  addDescription: (fileId, description) =>
    set((state) => ({
      descriptions: { ...state.descriptions, [fileId]: description }
    })),
  setLLMLoading: (loading) => set({ llmLoading: loading }),
  setLLMProgress: (progress) => set({ llmProgress: progress }),
  setLLMError: (error) => set({ llmError: error, llmLoading: false }),

  getFileDescription: (fileId) => {
    const { descriptions } = get()
    return descriptions[fileId] || null
  },

  // Selectors
  getVisibleNodesAndEdges: () => {
    const { graph, currentLevel, focusedFileId, selectedFileId, highlightedFileIds, collapsedCodeGroups, functionLogic } = get()

    if (!graph) {
      return { nodes: [], edges: [] }
    }

    if (currentLevel === GraphLevel.FILES) {
      return getFileNodesAndEdges(graph, focusedFileId, highlightedFileIds)
    } else if (currentLevel === GraphLevel.CODE) {
      return getCodeNodesAndEdges(graph, selectedFileId, collapsedCodeGroups)
    } else if (currentLevel === GraphLevel.FUNCTION_LOGIC) {
      return getFunctionLogicNodesAndEdges(functionLogic)
    }
    return { nodes: [], edges: [] }
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
  },

  getFolderColor: (folderPath: string) => {
    const { folderColors } = get()
    return folderColors.get(folderPath)
  },

  getVisibleFilesInfo: () => {
    const { graph, focusedFileId, currentLevel } = get()
    const visibleFiles = new Map<string, 'primary' | 'import' | 'usedBy'>()

    if (!graph || !focusedFileId || currentLevel !== GraphLevel.FILES) {
      return visibleFiles
    }

    // Primary file
    visibleFiles.set(focusedFileId, 'primary')

    // Find related files
    for (const rel of graph.relations) {
      if (rel.sourceFileId === focusedFileId) {
        // Files that the focused file imports
        if (!visibleFiles.has(rel.targetFileId)) {
          visibleFiles.set(rel.targetFileId, 'import')
        }
      }
      if (rel.targetFileId === focusedFileId) {
        // Files that import the focused file (used by)
        if (!visibleFiles.has(rel.sourceFileId)) {
          visibleFiles.set(rel.sourceFileId, 'usedBy')
        }
      }
    }

    return visibleFiles
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
 * Get code-level nodes for a specific file (grouped by type)
 * Layout: 2x2 grid with fixed positions + extra types to the right
 */
function getCodeNodesAndEdges(
  graph: AnalyzedGraph,
  selectedFileId: string | null,
  collapsedCodeGroups: Set<string>
): { nodes: GraphNode[]; edges: Edge[] } {
  if (!selectedFileId) {
    return { nodes: [], edges: [] }
  }

  const file = graph.files.get(selectedFileId)
  if (!file) {
    return { nodes: [], edges: [] }
  }

  // Group code items by type
  const groupedItems = new Map<CodeItemType, CodeItem[]>()
  for (const item of file.codeItems) {
    const existing = groupedItems.get(item.type) || []
    existing.push(item)
    groupedItems.set(item.type, existing)
  }

  // Fixed positions for the 4 main types (col, row)
  const fixedPositions: Partial<Record<CodeItemType, { col: number; row: number }>> = {
    [CodeItemType.INTERFACE]: { col: 0, row: 0 },  // top-left
    [CodeItemType.TYPE]: { col: 1, row: 0 },       // top-right
    [CodeItemType.FUNCTION]: { col: 0, row: 1 },   // bottom-left
    [CodeItemType.CONST]: { col: 1, row: 1 }       // bottom-right
  }

  // Extra types that go to the right, alternating top/bottom
  const extraTypeOrder: CodeItemType[] = [
    CodeItemType.REACT_COMPONENT,
    CodeItemType.HOOK,
    CodeItemType.CLASS
  ]

  // Layout constants
  const CARD_WIDTH = 320
  const CARD_SPACING = 30
  const HEADER_HEIGHT = 48
  const ITEM_HEIGHT = 36

  // Helper to calculate node height
  const getNodeHeight = (items: CodeItem[], isCollapsed: boolean): number => {
    return isCollapsed ? HEADER_HEIGHT : HEADER_HEIGHT + items.length * ITEM_HEIGHT
  }

  // First pass: collect all nodes with their grid positions
  interface NodeInfo {
    type: CodeItemType
    items: CodeItem[]
    isCollapsed: boolean
    col: number
    row: number
    height: number
  }

  const nodeInfos: NodeInfo[] = []

  // Add fixed position types
  for (const [type, pos] of Object.entries(fixedPositions)) {
    const items = groupedItems.get(type as CodeItemType)
    if (!items || items.length === 0) continue

    const isCollapsed = collapsedCodeGroups.has(type)
    nodeInfos.push({
      type: type as CodeItemType,
      items,
      isCollapsed,
      col: pos.col,
      row: pos.row,
      height: getNodeHeight(items, isCollapsed)
    })
  }

  // Add extra types to the right, alternating rows
  let extraCol = 2
  let extraRow = 0 // Start with top row
  for (const type of extraTypeOrder) {
    const items = groupedItems.get(type)
    if (!items || items.length === 0) continue

    const isCollapsed = collapsedCodeGroups.has(type)
    nodeInfos.push({
      type,
      items,
      isCollapsed,
      col: extraCol,
      row: extraRow,
      height: getNodeHeight(items, isCollapsed)
    })

    // Alternate row, increment column every 2 items
    if (extraRow === 1) {
      extraCol++
    }
    extraRow = extraRow === 0 ? 1 : 0
  }

  // Calculate max height per row for proper Y positioning
  const maxHeightPerRow = new Map<number, number>()
  for (const info of nodeInfos) {
    const currentMax = maxHeightPerRow.get(info.row) || 0
    maxHeightPerRow.set(info.row, Math.max(currentMax, info.height))
  }

  // Calculate Y offset for each row
  const rowYOffset = new Map<number, number>()
  let cumulativeY = 0
  const sortedRows = Array.from(maxHeightPerRow.keys()).sort()
  for (const row of sortedRows) {
    rowYOffset.set(row, cumulativeY)
    cumulativeY += (maxHeightPerRow.get(row) || 0) + CARD_SPACING
  }

  // Create nodes with calculated positions
  const nodes: GraphCodeGroupNode[] = nodeInfos.map((info) => ({
    id: `group-${info.type}`,
    type: 'codeGroupNode',
    position: {
      x: info.col * (CARD_WIDTH + CARD_SPACING),
      y: rowYOffset.get(info.row) || 0
    },
    data: {
      type: info.type,
      items: info.items,
      file,
      isCollapsed: info.isCollapsed
    }
  }))

  // No edges at code level
  const edges: Edge[] = []

  return { nodes: nodes as GraphNode[], edges }
}

/**
 * Get function logic nodes and edges for flowchart view
 */
function getFunctionLogicNodesAndEdges(
  functionLogic: FunctionLogic | null
): { nodes: GraphNode[]; edges: Edge[] } {
  if (!functionLogic) {
    return { nodes: [], edges: [] }
  }

  // Layout constants
  const NODE_WIDTH = 200
  const NODE_HEIGHT_BASE = 60
  const HORIZONTAL_SPACING = 100
  const VERTICAL_SPACING = 80

  // Build adjacency for layout calculation
  const inDegree = new Map<string, number>()
  const outEdges = new Map<string, string[]>()

  for (const node of functionLogic.nodes) {
    inDegree.set(node.id, 0)
    outEdges.set(node.id, [])
  }

  for (const edge of functionLogic.edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    outEdges.get(edge.source)?.push(edge.target)
  }

  // Calculate levels using topological sort (BFS)
  const levels = new Map<string, number>()
  const queue: string[] = []

  // Find entry node (or nodes with in-degree 0)
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId)
      levels.set(nodeId, 0)
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const currentLevel = levels.get(nodeId) || 0

    for (const targetId of outEdges.get(nodeId) || []) {
      const existingLevel = levels.get(targetId)
      if (existingLevel === undefined || existingLevel < currentLevel + 1) {
        levels.set(targetId, currentLevel + 1)
      }

      // Decrease in-degree for this traversal
      const remaining = inDegree.get(targetId)! - 1
      inDegree.set(targetId, remaining)
      if (remaining === 0) {
        queue.push(targetId)
      }
    }
  }

  // Group nodes by level
  const nodesByLevel = new Map<number, string[]>()
  for (const [nodeId, level] of levels) {
    const existing = nodesByLevel.get(level) || []
    existing.push(nodeId)
    nodesByLevel.set(level, existing)
  }

  // Calculate positions
  const nodePositions = new Map<string, { x: number; y: number }>()

  for (const [level, nodeIds] of nodesByLevel) {
    const y = level * (NODE_HEIGHT_BASE + VERTICAL_SPACING)
    const totalWidth = nodeIds.length * NODE_WIDTH + (nodeIds.length - 1) * HORIZONTAL_SPACING
    const startX = -totalWidth / 2

    nodeIds.forEach((nodeId, index) => {
      nodePositions.set(nodeId, {
        x: startX + index * (NODE_WIDTH + HORIZONTAL_SPACING),
        y
      })
    })
  }

  // Create React Flow nodes
  const nodes: GraphLogicNode[] = functionLogic.nodes.map((logicNode) => {
    const position = nodePositions.get(logicNode.id) || { x: 0, y: 0 }

    return {
      id: logicNode.id,
      type: 'logicNode',
      position,
      data: {
        node: logicNode,
        functionName: functionLogic.functionName
      }
    }
  })

  // Create React Flow edges
  const edges: Edge[] = functionLogic.edges.map((logicEdge) => ({
    id: logicEdge.id,
    source: logicEdge.source,
    target: logicEdge.target,
    label: logicEdge.label,
    type: 'smoothstep',
    animated: logicEdge.label === 'true' || logicEdge.label === 'false',
    style: {
      stroke: logicEdge.label === 'true' ? '#22c55e' :
              logicEdge.label === 'false' ? '#ef4444' : '#64748b'
    },
    labelStyle: {
      fill: logicEdge.label === 'true' ? '#22c55e' :
            logicEdge.label === 'false' ? '#ef4444' : '#64748b',
      fontWeight: 600
    }
  }))

  return { nodes: nodes as GraphNode[], edges }
}
