import type { AnalyzedProject } from './c4.types'

// ===== API EXPOSED TO RENDERER =====

export interface ElectronAPI {
  // Directory selection
  selectDirectory: () => Promise<string | null>
  getLastDirectory: () => Promise<string | null>

  // Analysis
  analyzeProject: (dirPath: string) => Promise<AnalyzedProject | null>
  cancelAnalysis: () => Promise<void>

  // Progress callbacks
  onAnalysisProgress: (callback: (progress: AnalysisProgress) => void) => () => void
  onAnalysisError: (callback: (error: AnalysisError) => void) => () => void

  // Export
  saveFile: (options: SaveFileOptions) => Promise<string | null>

  // Shell operations
  openFile: (filePath: string) => Promise<string>
  openFolder: (filePath: string) => Promise<void>
}

// ===== ANALYSIS PROGRESS =====

export interface AnalysisProgress {
  phase: 'scanning' | 'parsing' | 'analyzing' | 'building'
  current: number
  total: number
  currentFile?: string
}

// ===== ANALYSIS ERROR =====

export interface AnalysisError {
  type: 'parse' | 'io' | 'timeout' | 'unknown'
  message: string
  file?: string
  recoverable: boolean
}

// ===== SAVE FILE OPTIONS =====

export interface SaveFileOptions {
  defaultPath?: string
  filters: { name: string; extensions: string[] }[]
  data: string | Buffer
}

// ===== WINDOW AUGMENTATION =====

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
