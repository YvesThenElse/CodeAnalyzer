// ===== ENUMERATIONS =====

export enum C4Level {
  SYSTEM_CONTEXT = 1,
  CONTAINER = 2,
  COMPONENT = 3,
  CODE = 4
}

export enum C4NodeType {
  PERSON = 'person',
  SYSTEM = 'system',
  EXTERNAL_SYSTEM = 'external_system',
  CLOUD_SERVICE = 'cloud_service',
  CONTAINER_FRONTEND = 'container_frontend',
  CONTAINER_BACKEND = 'container_backend',
  CONTAINER_DATABASE = 'container_database',
  COMPONENT = 'component',
  CODE_FUNCTION = 'code_function',
  CODE_COMPONENT = 'code_component',
  CODE_HOOK = 'code_hook'
}

// ===== METADATA =====

export interface C4Metadata {
  filePath?: string
  lineNumber?: number
  exportType?: 'named' | 'default'
  detectedVia?: DetectionSource[]
}

export interface DetectionSource {
  type: 'import' | 'call' | 'env_variable' | 'config'
  source: string // ex: "axios.get('/api/users')"
  file: string // ex: "src/services/api.ts"
  line: number // ex: 42
}

// ===== MAIN C4 INTERFACES =====

export interface C4Element {
  id: string
  name: string
  description: string
  type: C4NodeType
  level: C4Level
  children?: string[] // IDs of children
  parentId?: string // ID of parent
  metadata?: C4Metadata
}

export interface C4Relation {
  id: string
  sourceId: string
  targetId: string
  label: string // ex: "imports", "calls API", "uses hook"
  technology?: string
}

export interface ExternalSystemDetection {
  name: string
  type: 'api' | 'sdk' | 'database' | 'cloud_service'
  detections: DetectionSource[]
}

// ===== ANALYZED PROJECT =====

export interface AnalyzedProject {
  rootPath: string
  name: string
  analyzedAt: Date
  levels: {
    [C4Level.SYSTEM_CONTEXT]: C4Element[]
    [C4Level.CONTAINER]: C4Element[]
    [C4Level.COMPONENT]: C4Element[]
    [C4Level.CODE]: C4Element[]
  }
  relations: C4Relation[]
  externalSystems: ExternalSystemDetection[]
}

// ===== NAVIGATION STATE =====

export interface BreadcrumbItem {
  id: string
  name: string
  level: C4Level
}

export interface NavigationHistoryItem {
  level: C4Level
  elementId?: string
  timestamp: number
}

export interface C4NavigationState {
  currentLevel: C4Level
  currentElementId?: string
  breadcrumb: BreadcrumbItem[]
  history: NavigationHistoryItem[]
}

// ===== REACT FLOW TYPES =====

export interface C4NodeData {
  element: C4Element
  isClickable: boolean
  hasChildren: boolean
}

export interface C4EdgeData {
  relation: C4Relation
}
