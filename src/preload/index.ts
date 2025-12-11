import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, AnalysisProgress, AnalysisError, SaveFileOptions } from '../renderer/src/types/electron.types'

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
  openFolder: (filePath: string) => ipcRenderer.invoke('shell:openFolder', filePath)
}

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
