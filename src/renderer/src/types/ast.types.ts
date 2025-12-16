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

export type ParseErrorType = 'read' | 'encoding' | 'syntax' | 'traversal' | 'unknown'

export interface ParseError {
  type?: ParseErrorType
  file: string
  line: number
  column?: number
  message: string
  details?: string
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
