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

import * as path from 'path'
import type { ILanguageParser, IImportResolver } from './interfaces'
import type { LanguageId, ExtendedFileAnalysisResult } from './types'

/**
 * Registry for language parsers and resolvers
 * Manages multi-language support by delegating to appropriate parser based on file extension
 */
export class ParserRegistry {
  private parsers: Map<LanguageId, ILanguageParser> = new Map()
  private resolvers: Map<LanguageId, IImportResolver> = new Map()
  private extensionToParser: Map<string, ILanguageParser> = new Map()
  private extensionToLanguage: Map<string, LanguageId> = new Map()

  /**
   * Register a language parser
   */
  registerParser(parser: ILanguageParser): void {
    this.parsers.set(parser.languageId, parser)

    for (const ext of parser.getSupportedExtensions()) {
      const normalizedExt = ext.toLowerCase()
      this.extensionToParser.set(normalizedExt, parser)
      this.extensionToLanguage.set(normalizedExt, parser.languageId)
    }
  }

  /**
   * Register an import resolver
   */
  registerResolver(resolver: IImportResolver): void {
    this.resolvers.set(resolver.languageId, resolver)
  }

  /**
   * Get parser for a specific language
   */
  getParser(languageId: LanguageId): ILanguageParser | undefined {
    return this.parsers.get(languageId)
  }

  /**
   * Get resolver for a specific language
   */
  getResolver(languageId: LanguageId): IImportResolver | undefined {
    return this.resolvers.get(languageId)
  }

  /**
   * Get parser for a file based on its extension
   */
  getParserForFile(filePath: string): ILanguageParser | undefined {
    const ext = path.extname(filePath).toLowerCase()
    return this.extensionToParser.get(ext)
  }

  /**
   * Get language ID for a file based on its extension
   */
  getLanguageForFile(filePath: string): LanguageId | undefined {
    const ext = path.extname(filePath).toLowerCase()
    return this.extensionToLanguage.get(ext)
  }

  /**
   * Get resolver for a file based on its extension
   */
  getResolverForFile(filePath: string): IImportResolver | undefined {
    const languageId = this.getLanguageForFile(filePath)
    if (languageId) {
      return this.resolvers.get(languageId)
    }
    return undefined
  }

  /**
   * Check if a file can be parsed by any registered parser
   */
  canParse(filePath: string): boolean {
    const parser = this.getParserForFile(filePath)
    return parser !== undefined && parser.canParse(filePath)
  }

  /**
   * Parse a file using the appropriate parser
   */
  async parseFile(filePath: string): Promise<ExtendedFileAnalysisResult | null> {
    const parser = this.getParserForFile(filePath)
    if (!parser) {
      return null
    }
    return parser.parseFile(filePath)
  }

  /**
   * Get all supported file extensions
   */
  getAllSupportedExtensions(): string[] {
    return Array.from(this.extensionToParser.keys())
  }

  /**
   * Get all registered language IDs
   */
  getRegisteredLanguages(): LanguageId[] {
    return Array.from(this.parsers.keys())
  }

  /**
   * Check if a specific language is registered
   */
  hasLanguage(languageId: LanguageId): boolean {
    return this.parsers.has(languageId)
  }

  /**
   * Check if a file extension is supported
   */
  isExtensionSupported(ext: string): boolean {
    const normalizedExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    return this.extensionToParser.has(normalizedExt)
  }
}

// Singleton instance
let registryInstance: ParserRegistry | null = null

/**
 * Get the global parser registry instance
 */
export function getParserRegistry(): ParserRegistry {
  if (!registryInstance) {
    registryInstance = new ParserRegistry()
  }
  return registryInstance
}

/**
 * Reset the global registry (mainly for testing)
 */
export function resetParserRegistry(): void {
  registryInstance = null
}
