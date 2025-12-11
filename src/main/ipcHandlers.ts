import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import * as fs from 'fs/promises'
import Store from 'electron-store'
import { analyzeProjectDirectory } from './fileAnalyzer'
import type { AnalysisProgress, AnalysisError } from '../renderer/src/types/electron.types'

const store = new Store()
let currentAnalysisController: AbortController | null = null

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // Select directory dialog
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Sélectionner un projet React'
    })

    if (!result.canceled && result.filePaths[0]) {
      const dirPath = result.filePaths[0]
      store.set('lastDirectory', dirPath)
      return dirPath
    }
    return null
  })

  // Get last directory
  ipcMain.handle('store:getLastDirectory', () => {
    return store.get('lastDirectory', null)
  })

  // Start analysis
  ipcMain.handle('analysis:start', async (_event, dirPath: string) => {
    currentAnalysisController = new AbortController()

    const onProgress = (progress: AnalysisProgress): void => {
      mainWindow.webContents.send('analysis:progress', progress)
    }

    const onError = (error: AnalysisError): void => {
      mainWindow.webContents.send('analysis:error', error)
    }

    try {
      const result = await analyzeProjectDirectory(
        dirPath,
        currentAnalysisController.signal,
        onProgress,
        onError
      )
      return result
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null
      }
      throw error
    } finally {
      currentAnalysisController = null
    }
  })

  // Cancel analysis
  ipcMain.handle('analysis:cancel', () => {
    if (currentAnalysisController) {
      currentAnalysisController.abort()
      currentAnalysisController = null
    }
  })

  // Save file dialog
  ipcMain.handle('dialog:saveFile', async (_event, options: {
    defaultPath?: string
    filters: { name: string; extensions: string[] }[]
    data: string | Buffer
  }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultPath,
      filters: options.filters
    })

    if (!result.canceled && result.filePath) {
      await fs.writeFile(result.filePath, options.data)
      return result.filePath
    }
    return null
  })

  // Open file with default application
  ipcMain.handle('shell:openFile', async (_event, filePath: string) => {
    const result = await shell.openPath(filePath)
    return result // Empty string if success, error message otherwise
  })

  // Show file in folder (opens explorer/finder)
  ipcMain.handle('shell:openFolder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}
