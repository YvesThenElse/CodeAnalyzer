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

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ===== TYPES =====

export interface CachedDescription {
  hash: string
  short: string
  long: string
  model: string
  generatedAt: string
}

export interface DescriptionCacheFile {
  version: number
  projectPath: string
  descriptions: Record<string, CachedDescription>
}

export interface LLMConfigFile {
  version: number
  llm: {
    provider: 'openai' | 'anthropic' | 'ollama'
    apiKey: string
    model: string
    ollamaUrl?: string
  }
}

// ===== CONSTANTS =====

const CODEANALYZER_DIR = '.codeanalyzer'
const CONFIG_FILE = 'config.json'
const DESCRIPTIONS_FILE = 'descriptions.json'
const CACHE_VERSION = 1

// ===== UTILITY FUNCTIONS =====

/**
 * Generate MD5 hash of file content for change detection
 */
export function generateFileHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

/**
 * Ensure .codeanalyzer directory exists
 */
function ensureCodeAnalyzerDir(projectPath: string): string {
  const dirPath = path.join(projectPath, CODEANALYZER_DIR)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  return dirPath
}

// ===== CONFIG MANAGEMENT =====

/**
 * Load LLM configuration from project
 */
export function loadLLMConfig(projectPath: string): LLMConfigFile['llm'] | null {
  try {
    const configPath = path.join(projectPath, CODEANALYZER_DIR, CONFIG_FILE)
    if (!fs.existsSync(configPath)) {
      return null
    }
    const content = fs.readFileSync(configPath, 'utf-8')
    const config: LLMConfigFile = JSON.parse(content)
    return config.llm
  } catch (error) {
    console.error('Error loading LLM config:', error)
    return null
  }
}

/**
 * Save LLM configuration to project
 */
export function saveLLMConfig(
  projectPath: string,
  config: LLMConfigFile['llm']
): boolean {
  try {
    const dirPath = ensureCodeAnalyzerDir(projectPath)
    const configPath = path.join(dirPath, CONFIG_FILE)
    const configFile: LLMConfigFile = {
      version: CACHE_VERSION,
      llm: config
    }
    fs.writeFileSync(configPath, JSON.stringify(configFile, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving LLM config:', error)
    return false
  }
}

// ===== DESCRIPTION CACHE MANAGEMENT =====

/**
 * Load description cache from project
 */
export function loadDescriptionCache(projectPath: string): DescriptionCacheFile {
  try {
    const cachePath = path.join(projectPath, CODEANALYZER_DIR, DESCRIPTIONS_FILE)
    if (!fs.existsSync(cachePath)) {
      return {
        version: CACHE_VERSION,
        projectPath,
        descriptions: {}
      }
    }
    const content = fs.readFileSync(cachePath, 'utf-8')
    const cache: DescriptionCacheFile = JSON.parse(content)

    // Version migration if needed
    if (cache.version !== CACHE_VERSION) {
      return {
        version: CACHE_VERSION,
        projectPath,
        descriptions: {}
      }
    }

    return cache
  } catch (error) {
    console.error('Error loading description cache:', error)
    return {
      version: CACHE_VERSION,
      projectPath,
      descriptions: {}
    }
  }
}

/**
 * Save description cache to project
 */
export function saveDescriptionCache(
  projectPath: string,
  cache: DescriptionCacheFile
): boolean {
  try {
    const dirPath = ensureCodeAnalyzerDir(projectPath)
    const cachePath = path.join(dirPath, DESCRIPTIONS_FILE)
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving description cache:', error)
    return false
  }
}

/**
 * Get cached description for a file if hash matches
 */
export function getCachedDescription(
  cache: DescriptionCacheFile,
  fileId: string,
  currentHash: string
): CachedDescription | null {
  const cached = cache.descriptions[fileId]
  if (cached && cached.hash === currentHash) {
    return cached
  }
  return null
}

/**
 * Set description in cache
 */
export function setCachedDescription(
  cache: DescriptionCacheFile,
  fileId: string,
  description: CachedDescription
): void {
  cache.descriptions[fileId] = description
}

/**
 * Invalidate all cached descriptions
 */
export function invalidateCache(projectPath: string): boolean {
  try {
    const cachePath = path.join(projectPath, CODEANALYZER_DIR, DESCRIPTIONS_FILE)
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath)
    }
    return true
  } catch (error) {
    console.error('Error invalidating cache:', error)
    return false
  }
}

/**
 * Get list of files that need description generation
 * (either not in cache or hash changed)
 */
export function getFilesNeedingDescriptions(
  cache: DescriptionCacheFile,
  files: Array<{ id: string; content: string }>
): Array<{ id: string; content: string; hash: string }> {
  const needsGeneration: Array<{ id: string; content: string; hash: string }> = []

  for (const file of files) {
    const hash = generateFileHash(file.content)
    const cached = cache.descriptions[file.id]

    if (!cached || cached.hash !== hash) {
      needsGeneration.push({ ...file, hash })
    }
  }

  return needsGeneration
}

/**
 * Convert cache to record format for IPC transfer
 */
export function cacheToDescriptionRecord(
  cache: DescriptionCacheFile
): Record<string, { short: string; long: string }> {
  const result: Record<string, { short: string; long: string }> = {}

  for (const [fileId, desc] of Object.entries(cache.descriptions)) {
    result[fileId] = {
      short: desc.short,
      long: desc.long
    }
  }

  return result
}
