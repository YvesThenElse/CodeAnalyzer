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

import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronAPI,
  AnalysisProgress,
  AnalysisError,
  SaveFileOptions,
  LLMConfig,
  LLMProgress,
  FileDescription
} from '../renderer/src/types/electron.types'

const electronAPI: ElectronAPI = {
  // Select directory dialog
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // Get last directory
  getLastDirectory: () => ipcRenderer.invoke('store:getLastDirectory'),

  // Start project analysis
  analyzeProject: (dirPath: string) => ipcRenderer.invoke('analysis:start', dirPath),

  // Cancel ongoing analysis
  cancelAnalysis: () => ipcRenderer.invoke('analysis:cancel'),

  // Listen to analysis progress (with cleanup function)
  onAnalysisProgress: (callback: (progress: AnalysisProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: AnalysisProgress): void => {
      callback(progress)
    }
    ipcRenderer.on('analysis:progress', handler)
    return () => {
      ipcRenderer.removeListener('analysis:progress', handler)
    }
  },

  // Listen to analysis errors (with cleanup function)
  onAnalysisError: (callback: (error: AnalysisError) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: AnalysisError): void => {
      callback(error)
    }
    ipcRenderer.on('analysis:error', handler)
    return () => {
      ipcRenderer.removeListener('analysis:error', handler)
    }
  },

  // Save file dialog
  saveFile: (options: SaveFileOptions) => ipcRenderer.invoke('dialog:saveFile', options),

  // Open file with default application
  openFile: (filePath: string) => ipcRenderer.invoke('shell:openFile', filePath),

  // Show file in folder (opens explorer/finder)
  openFolder: (filePath: string) => ipcRenderer.invoke('shell:openFolder', filePath),

  // LLM operations
  llm: {
    // Get LLM configuration for a project
    getConfig: (projectPath: string) => ipcRenderer.invoke('llm:getConfig', projectPath),

    // Save LLM configuration for a project
    saveConfig: (projectPath: string, config: LLMConfig) =>
      ipcRenderer.invoke('llm:saveConfig', projectPath, config),

    // Test LLM connection
    testConnection: (config: LLMConfig) => ipcRenderer.invoke('llm:testConnection', config),

    // Generate descriptions for files
    generateDescriptions: (projectPath: string, forceRegenerate?: boolean) =>
      ipcRenderer.invoke('llm:generateDescriptions', projectPath, forceRegenerate),

    // Get cached descriptions
    getDescriptions: (projectPath: string) => ipcRenderer.invoke('llm:getDescriptions', projectPath),

    // Invalidate description cache
    invalidateCache: (projectPath: string) => ipcRenderer.invoke('llm:invalidateCache', projectPath),

    // Listen to LLM progress (with cleanup function)
    onProgress: (callback: (progress: LLMProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: LLMProgress): void => {
        callback(progress)
      }
      ipcRenderer.on('llm:progress', handler)
      return () => {
        ipcRenderer.removeListener('llm:progress', handler)
      }
    },

    // Listen to LLM completion (with cleanup function)
    onComplete: (callback: (descriptions: Record<string, FileDescription>) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        descriptions: Record<string, FileDescription>
      ): void => {
        callback(descriptions)
      }
      ipcRenderer.on('llm:complete', handler)
      return () => {
        ipcRenderer.removeListener('llm:complete', handler)
      }
    },

    // Listen to LLM errors (with cleanup function)
    onError: (callback: (error: { message: string; file?: string }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        error: { message: string; file?: string }
      ): void => {
        callback(error)
      }
      ipcRenderer.on('llm:error', handler)
      return () => {
        ipcRenderer.removeListener('llm:error', handler)
      }
    },

    // Listen to individual description ready (with cleanup function)
    onDescriptionReady: (callback: (data: { fileId: string; description: FileDescription }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { fileId: string; description: FileDescription }
      ): void => {
        callback(data)
      }
      ipcRenderer.on('llm:descriptionReady', handler)
      return () => {
        ipcRenderer.removeListener('llm:descriptionReady', handler)
      }
    }
  }
}

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
