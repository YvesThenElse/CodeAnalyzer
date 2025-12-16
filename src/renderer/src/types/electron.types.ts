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

import type { SerializedAnalyzedGraph } from './graph.types'

// ===== API EXPOSED TO RENDERER =====

export interface ElectronAPI {
  // Directory selection
  selectDirectory: () => Promise<string | null>
  getLastDirectory: () => Promise<string | null>

  // Analysis
  analyzeProject: (dirPath: string) => Promise<SerializedAnalyzedGraph | null>
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
