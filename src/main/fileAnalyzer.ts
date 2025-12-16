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

import * as fs from 'fs/promises'
import * as path from 'path'
import { Worker } from 'worker_threads'
import type { AnalysisProgress, AnalysisError } from '../renderer/src/types/electron.types'
import type { SerializedAnalyzedGraph } from '../renderer/src/types/graph.types'
import type { DirectoryStructure, FileAnalysisResult } from '../renderer/src/types/ast.types'
import { buildDependencyGraph } from './graphBuilder'
import { parseFile } from './astParser'

// Directories to ignore during scan
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '.cache', 'out']

// Valid file extensions for analysis
const VALID_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

export interface ScanResult {
  structure: DirectoryStructure
  files: string[]
}

/**
 * Scan directory recursively and collect file paths
 */
async function scanDirectory(
  dirPath: string,
  signal: AbortSignal,
  onProgress: (progress: AnalysisProgress) => void
): Promise<ScanResult> {
  const files: string[] = []

  async function scan(currentPath: string): Promise<DirectoryStructure> {
    if (signal.aborted) {
      throw new Error('Analysis cancelled')
    }

    const stat = await fs.stat(currentPath)
    const name = path.basename(currentPath)

    if (stat.isDirectory()) {
      // Skip ignored directories
      if (IGNORE_DIRS.includes(name)) {
        return { path: currentPath, name, type: 'directory', children: [] }
      }

      const entries = await fs.readdir(currentPath)
      const children: DirectoryStructure[] = []

      for (const entry of entries) {
        if (signal.aborted) {
          throw new Error('Analysis cancelled')
        }
        const child = await scan(path.join(currentPath, entry))
        children.push(child)
      }

      return { path: currentPath, name, type: 'directory', children }
    }

    // Check if file has valid extension
    const ext = path.extname(currentPath).toLowerCase()
    if (VALID_EXTENSIONS.includes(ext)) {
      files.push(currentPath)
    }

    return { path: currentPath, name, type: 'file' }
  }

  onProgress({
    phase: 'scanning',
    current: 0,
    total: 0,
    currentFile: dirPath
  })

  const structure = await scan(dirPath)

  return { structure, files }
}

/**
 * Parse files directly (fallback when worker is not available)
 */
async function parseFilesDirect(
  files: string[],
  signal: AbortSignal,
  onProgress: (progress: AnalysisProgress) => void,
  onError: (error: AnalysisError) => void
): Promise<Map<string, FileAnalysisResult>> {
  const results = new Map<string, FileAnalysisResult>()
  const total = files.length

  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) {
      throw new Error('Analysis cancelled')
    }

    const file = files[i]

    onProgress({
      phase: 'parsing',
      current: i + 1,
      total,
      currentFile: file
    })

    try {
      const result = await parseFile(file)
      results.set(file, result)
    } catch (error) {
      onError({
        type: 'parse',
        message: (error as Error).message,
        file,
        recoverable: true
      })
    }
  }

  return results
}

/**
 * Parse files using worker thread (with fallback to direct parsing)
 */
async function parseFilesWithWorker(
  files: string[],
  signal: AbortSignal,
  onProgress: (progress: AnalysisProgress) => void,
  onError: (error: AnalysisError) => void
): Promise<Map<string, FileAnalysisResult>> {
  // Try to use worker, fallback to direct parsing if it fails
  const workerPath = path.join(__dirname, 'workers', 'analyzerWorker.js')

  try {
    // Check if worker file exists
    await fs.access(workerPath)
  } catch {
    // Worker not available, use direct parsing
    console.log('Worker not available, using direct parsing')
    return parseFilesDirect(files, signal, onProgress, onError)
  }

  return new Promise((resolve, reject) => {
    const results = new Map<string, FileAnalysisResult>()

    // Create worker
    const worker = new Worker(workerPath, {
      workerData: { files }
    })

    // Handle abort
    const abortHandler = (): void => {
      worker.postMessage('cancel')
    }
    signal.addEventListener('abort', abortHandler)

    worker.on('message', (message) => {
      if (message.type === 'progress') {
        onProgress({
          phase: 'parsing',
          current: message.current,
          total: message.total,
          currentFile: message.file
        })

        if (message.result) {
          results.set(message.file, message.result)
        }

        if (message.error) {
          onError({
            type: 'parse',
            message: message.error.message,
            file: message.file,
            recoverable: true
          })
        }
      } else if (message.type === 'done') {
        signal.removeEventListener('abort', abortHandler)
        resolve(results)
      }
    })

    worker.on('error', (error) => {
      signal.removeEventListener('abort', abortHandler)
      // Fallback to direct parsing on worker error
      console.log('Worker error, falling back to direct parsing:', error.message)
      parseFilesDirect(files, signal, onProgress, onError)
        .then(resolve)
        .catch(reject)
    })

    worker.on('exit', (code) => {
      signal.removeEventListener('abort', abortHandler)
      if (code !== 0 && !signal.aborted) {
        // Fallback to direct parsing on worker exit error
        console.log('Worker exited with error, falling back to direct parsing')
        parseFilesDirect(files, signal, onProgress, onError)
          .then(resolve)
          .catch(reject)
      }
    })
  })
}

/**
 * Main entry point for project analysis
 */
export async function analyzeProjectDirectory(
  dirPath: string,
  signal: AbortSignal,
  onProgress: (progress: AnalysisProgress) => void,
  onError: (error: AnalysisError) => void
): Promise<SerializedAnalyzedGraph> {
  // Phase 1: Scan directory structure
  const { structure, files } = await scanDirectory(dirPath, signal, onProgress)

  if (files.length === 0) {
    throw new Error('No TypeScript or JavaScript files found in the selected directory')
  }

  // Phase 2: Parse files with worker
  const parseResults = await parseFilesWithWorker(files, signal, onProgress, onError)

  // Phase 3: Build dependency graph
  onProgress({
    phase: 'building',
    current: 0,
    total: 1,
    currentFile: 'Building dependency graph...'
  })

  // Attach parse results to directory structure
  attachParseResults(structure, parseResults)

  // Build and return dependency graph
  const projectName = path.basename(dirPath)
  const graph = buildDependencyGraph(structure, projectName, dirPath)

  onProgress({
    phase: 'building',
    current: 1,
    total: 1
  })

  return graph
}

/**
 * Attach parse results to directory structure
 */
function attachParseResults(
  structure: DirectoryStructure,
  results: Map<string, FileAnalysisResult>
): void {
  if (structure.type === 'file') {
    const result = results.get(structure.path)
    if (result) {
      structure.fileInfo = result
    }
    return
  }

  if (structure.children) {
    for (const child of structure.children) {
      attachParseResults(child, results)
    }
  }
}
