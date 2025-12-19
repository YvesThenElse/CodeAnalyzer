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

import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import * as fs from 'fs/promises'
import Store from 'electron-store'
import { analyzeProjectDirectory } from './fileAnalyzer'
import { parseFunctionLogic } from './functionLogicParser'
import type { AnalysisProgress, AnalysisError, LLMConfig } from '../renderer/src/types/electron.types'
import {
  loadLLMConfig,
  saveLLMConfig,
  loadDescriptionCache,
  saveDescriptionCache,
  getFilesNeedingDescriptions,
  setCachedDescription,
  invalidateCache,
  cacheToDescriptionRecord,
  generateFileHash
} from './descriptionCache'
import {
  generateFileDescription,
  testLLMConnection,
  getLanguageFromPath,
  type FileContext
} from './llmService'

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

  // ===== FUNCTION LOGIC HANDLER =====

  // Get function logic (flowchart data)
  ipcMain.handle('logic:getFunctionLogic', async (_event, filePath: string, functionName: string, functionLine: number) => {
    try {
      return await parseFunctionLogic(filePath, functionName, functionLine)
    } catch (error) {
      console.error('Error parsing function logic:', error)
      return null
    }
  })

  // ===== LLM HANDLERS =====

  // Get LLM configuration for a project
  ipcMain.handle('llm:getConfig', async (_event, projectPath: string) => {
    return loadLLMConfig(projectPath)
  })

  // Save LLM configuration for a project
  ipcMain.handle('llm:saveConfig', async (_event, projectPath: string, config: LLMConfig) => {
    return saveLLMConfig(projectPath, config)
  })

  // Test LLM connection
  ipcMain.handle('llm:testConnection', async (_event, config: LLMConfig) => {
    return testLLMConnection(config)
  })

  // Get cached descriptions for a project
  ipcMain.handle('llm:getDescriptions', async (_event, projectPath: string) => {
    const cache = loadDescriptionCache(projectPath)
    return cacheToDescriptionRecord(cache)
  })

  // Invalidate description cache
  ipcMain.handle('llm:invalidateCache', async (_event, projectPath: string) => {
    return invalidateCache(projectPath)
  })

  // Count files needing description updates
  ipcMain.handle('llm:countPendingFiles', async (_event, projectPath: string) => {
    const config = loadLLMConfig(projectPath)
    if (!config) {
      return 0
    }

    const cache = loadDescriptionCache(projectPath)
    const sourceFiles = await scanProjectFiles(projectPath)

    const filesWithContent = sourceFiles.map(file => ({
      id: file.relativePath,
      content: file.content
    }))

    const filesToGenerate = getFilesNeedingDescriptions(cache, filesWithContent)
    return filesToGenerate.length
  })

  // Generate descriptions for files
  ipcMain.handle('llm:generateDescriptions', async (_event, projectPath: string, forceRegenerate?: boolean) => {
    const config = loadLLMConfig(projectPath)
    if (!config) {
      mainWindow.webContents.send('llm:error', {
        message: 'Configuration LLM non trouvée. Veuillez configurer le LLM.'
      })
      return
    }

    // Load existing cache
    let cache = loadDescriptionCache(projectPath)

    // If force regenerate, clear the cache
    if (forceRegenerate) {
      invalidateCache(projectPath)
      cache = loadDescriptionCache(projectPath)
    }

    // Scan for files in the project
    mainWindow.webContents.send('llm:progress', {
      current: 0,
      total: 0,
      currentFile: '',
      phase: 'loading-cache' as const
    })

    // Get all source files from the project
    const sourceFiles = await scanProjectFiles(projectPath)

    // Prepare files with content for hash comparison
    const filesWithContent = sourceFiles.map(file => ({
      id: file.relativePath,
      content: file.content
    }))

    // Get files that need description generation
    const filesToGenerate = getFilesNeedingDescriptions(cache, filesWithContent)

    if (filesToGenerate.length === 0) {
      mainWindow.webContents.send('llm:complete', cacheToDescriptionRecord(cache))
      return
    }

    // Generate descriptions in parallel with concurrency limit
    const total = filesToGenerate.length
    const CONCURRENCY = 3
    let completedCount = 0
    let saveCounter = 0

    await processWithConcurrency(filesToGenerate, CONCURRENCY, async (file) => {
      const sourceFile = sourceFiles.find(f => f.relativePath === file.id)!

      try {
        const context: FileContext = {
          fileName: sourceFile.fileName,
          relativePath: sourceFile.relativePath,
          content: sourceFile.content,
          imports: sourceFile.imports,
          usedBy: [],
          language: getLanguageFromPath(sourceFile.relativePath)
        }

        const description = await generateFileDescription(config, context)

        // Update cache
        setCachedDescription(cache, file.id, {
          hash: file.hash,
          short: description.short,
          long: description.long,
          model: config.model,
          generatedAt: new Date().toISOString()
        })

        // Send description immediately to renderer
        mainWindow.webContents.send('llm:descriptionReady', {
          fileId: file.id,
          description: { short: description.short, long: description.long }
        })

        completedCount++
        saveCounter++

        // Update progress
        mainWindow.webContents.send('llm:progress', {
          current: completedCount,
          total,
          currentFile: file.id,
          phase: 'generating' as const
        })

        // Save cache periodically (every 5 files)
        if (saveCounter >= 5) {
          saveDescriptionCache(projectPath, cache)
          saveCounter = 0
        }
      } catch (error) {
        completedCount++
        const rawMessage = error instanceof Error ? error.message : 'Unknown error'
        const message = formatLLMError(rawMessage)
        mainWindow.webContents.send('llm:error', {
          message,
          file: file.id
        })
      }
    })

    // Final save
    mainWindow.webContents.send('llm:progress', {
      current: total,
      total,
      currentFile: '',
      phase: 'saving' as const
    })

    saveDescriptionCache(projectPath, cache)
    mainWindow.webContents.send('llm:complete', cacheToDescriptionRecord(cache))
  })
}

// ===== CONCURRENCY UTILITY =====

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items]
  const active = new Set<Promise<void>>()

  function startNext(): void {
    if (queue.length === 0) return

    const item = queue.shift()!
    const promise = processor(item).finally(() => {
      active.delete(promise)
    })
    active.add(promise)
  }

  // Start initial batch (synchronously, no await)
  const initialBatch = Math.min(concurrency, items.length)
  for (let i = 0; i < initialBatch; i++) {
    startNext()
  }

  // Process remaining items as slots become available
  while (active.size > 0) {
    await Promise.race(active)
    // Fill up slots after one completes
    while (active.size < concurrency && queue.length > 0) {
      startNext()
    }
  }
}

// ===== ERROR FORMATTING =====

function formatLLMError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase()

  // Authentication errors
  if (lower.includes('401') || lower.includes('invalid_api_key') || lower.includes('incorrect api key')) {
    return 'Clé API invalide. Vérifiez votre configuration.'
  }

  // Authorization errors
  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'Accès refusé. Vérifiez les permissions de votre clé API.'
  }

  // Quota/billing errors
  if (lower.includes('429') || lower.includes('rate_limit') || lower.includes('rate limit')) {
    return 'Limite de requêtes atteinte. Réessayez plus tard.'
  }

  if (lower.includes('insufficient_quota') || lower.includes('quota') || lower.includes('billing')) {
    return 'Quota épuisé ou problème de facturation. Vérifiez votre compte.'
  }

  if (lower.includes('credit') || lower.includes('payment')) {
    return 'Crédit insuffisant. Rechargez votre compte.'
  }

  // Server errors
  if (lower.includes('overloaded') || lower.includes('503') || lower.includes('service unavailable')) {
    return 'Service surchargé. Réessayez plus tard.'
  }

  if (lower.includes('500') || lower.includes('internal server error')) {
    return 'Erreur serveur. Réessayez plus tard.'
  }

  // Network errors
  if (lower.includes('econnrefused') || lower.includes('connection refused')) {
    return 'Connexion refusée. Vérifiez que le service est démarré (Ollama?).'
  }

  if (lower.includes('enotfound') || lower.includes('getaddrinfo')) {
    return 'Serveur introuvable. Vérifiez votre connexion internet.'
  }

  if (lower.includes('timeout') || lower.includes('etimedout')) {
    return 'Délai d\'attente dépassé. Réessayez.'
  }

  // Model errors
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return 'Modèle non trouvé. Vérifiez le nom du modèle.'
  }

  // Context length errors
  if (lower.includes('context_length') || lower.includes('token') && lower.includes('limit')) {
    return 'Fichier trop volumineux pour le modèle.'
  }

  // Return original message if no match (truncated if too long)
  return rawMessage.length > 100 ? rawMessage.substring(0, 100) + '...' : rawMessage
}

// ===== HELPER FUNCTIONS =====

interface SourceFile {
  fileName: string
  relativePath: string
  content: string
  imports: string[]
}

const IGNORED_DIRS = [
  'node_modules',
  'dist',
  'build',
  'out',
  '.git',
  '.svn',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.codeanalyzer'
]

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

async function scanProjectFiles(projectPath: string): Promise<SourceFile[]> {
  const files: SourceFile[] = []

  async function scanDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      const relativePath = fullPath.replace(projectPath + '/', '').replace(projectPath + '\\', '')

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.includes(entry.name)) {
          await scanDir(fullPath)
        }
      } else if (entry.isFile()) {
        const ext = entry.name.substring(entry.name.lastIndexOf('.'))
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8')
            const imports = extractImports(content)
            files.push({
              fileName: entry.name,
              relativePath: relativePath.replace(/\\/g, '/'),
              content,
              imports
            })
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }
  }

  await scanDir(projectPath)
  return files
}

function extractImports(content: string): string[] {
  const imports: string[] = []
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g

  let match
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1]
    // Only include relative imports (not node_modules)
    if (importPath.startsWith('.') || importPath.startsWith('@/') || importPath.startsWith('~/')) {
      imports.push(importPath)
    }
  }

  return imports
}
