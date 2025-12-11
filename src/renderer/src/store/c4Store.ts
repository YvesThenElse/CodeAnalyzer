import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import {
  C4Level,
  C4NodeType,
  type AnalyzedProject,
  type BreadcrumbItem,
  type C4Element,
  type C4NodeData
} from '../types/c4.types'
import type { AnalysisProgress } from '../types/electron.types'
import { calculateLayout } from '../utils/layoutUtils'

// Define a type for our custom nodes
type C4Node = Node<C4NodeData, string>

interface C4State {
  // Project data
  project: AnalyzedProject | null
  isLoading: boolean
  error: string | null
  progress: AnalysisProgress | null

  // Navigation
  currentLevel: C4Level
  currentElementId: string | null
  breadcrumb: BreadcrumbItem[]

  // Selection
  selectedNodeId: string | null

  // Actions
  setProject: (project: AnalyzedProject) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setProgress: (progress: AnalysisProgress | null) => void
  setCurrentLevel: (level: C4Level) => void
  setCurrentElementId: (id: string | null) => void
  addToBreadcrumb: (elementId: string) => void
  navigateToBreadcrumb: (elementId: string) => void
  setSelectedNodeId: (id: string | null) => void
  reset: () => void

  // Selectors
  getVisibleNodesAndEdges: () => { nodes: C4Node[]; edges: Edge[] }
  getSelectedElement: () => C4Element | null
  getVisibleFilePaths: () => Set<string>
  getSelectedFilePath: () => string | null
  getAllFilePaths: () => Set<string>
}

// Helper to find element by ID
function findElementById(project: AnalyzedProject, id: string): C4Element | undefined {
  for (const level of Object.values(project.levels)) {
    const found = level.find((el) => el.id === id)
    if (found) return found
  }
  return undefined
}

// Helper to get node type for React Flow
function getReactFlowNodeType(c4Type: C4NodeType): string {
  switch (c4Type) {
    case C4NodeType.PERSON:
    case C4NodeType.SYSTEM:
    case C4NodeType.EXTERNAL_SYSTEM:
    case C4NodeType.CLOUD_SERVICE:
      return 'c4System'
    case C4NodeType.CONTAINER_FRONTEND:
    case C4NodeType.CONTAINER_BACKEND:
    case C4NodeType.CONTAINER_DATABASE:
      return 'c4Container'
    case C4NodeType.COMPONENT:
      return 'c4Component'
    case C4NodeType.CODE_FUNCTION:
    case C4NodeType.CODE_COMPONENT:
    case C4NodeType.CODE_HOOK:
      return 'c4Code'
    default:
      return 'c4System'
  }
}

const initialBreadcrumb: BreadcrumbItem[] = [
  { id: 'root', name: 'System Context', level: C4Level.SYSTEM_CONTEXT }
]

export const useC4Store = create<C4State>((set, get) => ({
  // Initial state
  project: null,
  isLoading: false,
  error: null,
  progress: null,
  currentLevel: C4Level.SYSTEM_CONTEXT,
  currentElementId: null,
  breadcrumb: initialBreadcrumb,
  selectedNodeId: null,

  // Actions
  setProject: (project) => {
    // Normalize levels keys from string to number (IPC serialization converts numeric keys to strings)
    if (project && project.levels) {
      const normalizedLevels: Record<C4Level, C4Element[]> = {
        [C4Level.SYSTEM_CONTEXT]: [],
        [C4Level.CONTAINER]: [],
        [C4Level.COMPONENT]: [],
        [C4Level.CODE]: []
      }
      for (const key of Object.keys(project.levels)) {
        const numKey = parseInt(key, 10) as C4Level
        normalizedLevels[numKey] = project.levels[key as unknown as C4Level] || []
      }
      project.levels = normalizedLevels
    }
    set({ project, error: null })
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setProgress: (progress) => set({ progress }),

  setCurrentLevel: (level) => set({ currentLevel: level }),
  setCurrentElementId: (id) => set({ currentElementId: id }),

  addToBreadcrumb: (elementId) => {
    const { project, breadcrumb, currentLevel } = get()
    if (!project) return

    const element = findElementById(project, elementId)
    if (!element) return

    set({
      breadcrumb: [
        ...breadcrumb,
        {
          id: elementId,
          name: element.name,
          level: currentLevel
        }
      ]
    })
  },

  navigateToBreadcrumb: (elementId) => {
    const { breadcrumb } = get()
    const index = breadcrumb.findIndex((b) => b.id === elementId)
    if (index === -1) return

    const item = breadcrumb[index]
    set({
      currentLevel: item.level,
      currentElementId: item.id === 'root' ? null : item.id,
      breadcrumb: breadcrumb.slice(0, index + 1),
      selectedNodeId: null
    })
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  reset: () =>
    set({
      project: null,
      isLoading: false,
      error: null,
      progress: null,
      currentLevel: C4Level.SYSTEM_CONTEXT,
      currentElementId: null,
      breadcrumb: initialBreadcrumb,
      selectedNodeId: null
    }),

  // Selectors
  getVisibleNodesAndEdges: () => {
    const { project, currentLevel, currentElementId } = get()

    if (!project) {
      return { nodes: [], edges: [] }
    }

    // Get elements for current level (handle both number and string keys from IPC serialization)
    const levelElements = project.levels[currentLevel] || project.levels[currentLevel.toString() as unknown as C4Level] || []

    // Filter by parent if we're viewing a specific element's children
    const elements = currentElementId
      ? levelElements.filter((el) => el.parentId === currentElementId)
      : levelElements

    // Convert to React Flow nodes
    const nodes: C4Node[] = elements.map((el) => ({
      id: el.id,
      type: getReactFlowNodeType(el.type),
      position: { x: 0, y: 0 }, // Will be calculated by layout
      data: {
        element: el,
        isClickable: currentLevel < C4Level.CODE,
        hasChildren: (el.children?.length ?? 0) > 0
      }
    }))

    // Get relations for visible elements
    const elementIds = new Set(elements.map((e) => e.id))
    const edges: Edge[] = project.relations
      .filter((r) => elementIds.has(r.sourceId) && elementIds.has(r.targetId))
      .map((r) => ({
        id: r.id,
        source: r.sourceId,
        target: r.targetId,
        type: 'c4Edge',
        label: r.label,
        data: { relation: r }
      }))

    // Calculate layout
    const layoutedNodes = calculateLayout(nodes, edges)

    return { nodes: layoutedNodes, edges }
  },

  getSelectedElement: () => {
    const { project, selectedNodeId } = get()
    if (!project || !selectedNodeId) return null
    return findElementById(project, selectedNodeId) || null
  },

  getVisibleFilePaths: () => {
    const { project, currentLevel, currentElementId } = get()
    const paths = new Set<string>()

    if (!project) return paths

    const levelElements = project.levels[currentLevel] || []
    const elements = currentElementId
      ? levelElements.filter((el) => el.parentId === currentElementId)
      : levelElements

    for (const el of elements) {
      if (el.metadata?.filePath) {
        paths.add(el.metadata.filePath)
      }
    }

    return paths
  },

  getSelectedFilePath: () => {
    const { project, selectedNodeId } = get()
    if (!project || !selectedNodeId) return null
    const element = findElementById(project, selectedNodeId)
    return element?.metadata?.filePath || null
  },

  getAllFilePaths: () => {
    const { project } = get()
    const paths = new Set<string>()

    if (!project) return paths

    for (const level of Object.values(project.levels)) {
      for (const el of level) {
        if (el.metadata?.filePath) {
          paths.add(el.metadata.filePath)
        }
      }
    }

    return paths
  }
}))
