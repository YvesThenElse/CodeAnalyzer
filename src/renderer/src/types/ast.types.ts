// ===== FILE ANALYSIS RESULT =====

export interface FileAnalysisResult {
  filePath: string
  exports: ExportedItem[]
  imports: ImportItem[]
  components: ReactComponentInfo[]
  hooks: HookInfo[]
  apiCalls: ApiCallInfo[]
  allDeclarations: DeclarationItem[]
  errors?: ParseError[]
}

// ===== ALL DECLARATIONS (exported and non-exported) =====

export type DeclarationType =
  | 'function'
  | 'class'
  | 'const'
  | 'let'
  | 'var'
  | 'type'
  | 'interface'
  | 'enum'

export interface DeclarationItem {
  name: string
  type: DeclarationType
  isExported: boolean
  isDefault: boolean
  isReactComponent: boolean
  isHook: boolean
  line: number
  signature?: string
}

// ===== EXPORTS =====

export interface ExportedItem {
  name: string
  type: 'function' | 'class' | 'const' | 'default'
  isReactComponent: boolean
  isHook: boolean
  line: number
}

// ===== IMPORTS =====

export interface ImportItem {
  source: string
  specifiers: string[]
  isExternal: boolean // true if not starting with '.' or '/'
  line: number
}

// ===== REACT COMPONENTS =====

export interface ReactComponentInfo {
  name: string
  type: 'function' | 'class' | 'arrow'
  line: number
  hasJSX: boolean
  usedHooks: string[]
}

// ===== HOOKS =====

export interface HookInfo {
  name: string
  line: number
  isCustom: boolean
}

// ===== API CALLS =====

export interface ApiCallInfo {
  method: string // 'get', 'post', 'fetch', etc.
  url?: string
  library: string // 'fetch', 'axios', 'ky'
  line: number
}

// ===== ERRORS =====

export interface ParseError {
  file: string
  line: number
  message: string
}

// ===== DIRECTORY STRUCTURE =====

export interface DirectoryStructure {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: DirectoryStructure[]
  fileInfo?: FileAnalysisResult
}

// ===== DETECTION PATTERNS =====

export interface ExternalApiPattern {
  name: string
  pattern: RegExp
  library: string
}

export interface CloudSdkImport {
  packageNames: string[]
  serviceName: string
  type: 'cloud_service' | 'sdk' | 'database'
}
