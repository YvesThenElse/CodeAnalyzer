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

  // LLM operations
  llm: {
    getConfig: (projectPath: string) => Promise<LLMConfig | null>
    saveConfig: (projectPath: string, config: LLMConfig) => Promise<boolean>
    testConnection: (config: LLMConfig) => Promise<{ success: boolean; error?: string }>
    generateDescriptions: (projectPath: string, forceRegenerate?: boolean) => Promise<void>
    getDescriptions: (projectPath: string) => Promise<Record<string, FileDescription>>
    invalidateCache: (projectPath: string) => Promise<void>
    onProgress: (callback: (progress: LLMProgress) => void) => () => void
    onComplete: (callback: (descriptions: Record<string, FileDescription>) => void) => () => void
    onError: (callback: (error: { message: string; file?: string }) => void) => () => void
    onDescriptionReady: (callback: (data: { fileId: string; description: FileDescription }) => void) => () => void
  }
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

// ===== LLM CONFIGURATION =====

export type LLMProvider = 'openai' | 'anthropic' | 'ollama'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model: string
  ollamaUrl?: string // http://localhost:11434 par défaut
}

export interface LLMProgress {
  current: number
  total: number
  currentFile: string
  phase: 'loading-cache' | 'generating' | 'saving'
}

export interface FileDescription {
  short: string  // ~100 chars for cards
  long: string   // paragraph for details panel
}

export const LLM_MODELS: Record<LLMProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  ollama: ['llama3.1', 'llama3.2', 'codellama', 'mistral', 'deepseek-coder']
}

// ===== WINDOW AUGMENTATION =====

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
