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

import type { LanguageId, ExtendedFileAnalysisResult } from './types'

/**
 * Interface for language-specific file parsers
 */
export interface ILanguageParser {
  /** Language identifier */
  readonly languageId: LanguageId

  /**
   * Returns file extensions supported by this parser
   * @example ['.cs'] for C#, ['.ts', '.tsx', '.js', '.jsx'] for TypeScript/JavaScript
   */
  getSupportedExtensions(): string[]

  /**
   * Check if this parser can handle a given file
   * @param filePath Full or relative path to file
   */
  canParse(filePath: string): boolean

  /**
   * Parse a file and extract analysis information
   * @param filePath Full path to file
   */
  parseFile(filePath: string): Promise<ExtendedFileAnalysisResult>
}

/**
 * Interface for language-specific import resolution
 */
export interface IImportResolver {
  /** Language identifier */
  readonly languageId: LanguageId

  /**
   * Resolve an import source to a file ID
   * @param source Import source (e.g., './Button', 'System.Collections.Generic')
   * @param sourceFolder Folder of the importing file
   * @param fileIds Set of all known file IDs in the project
   * @returns Resolved file ID or null if not found
   */
  resolveImport(source: string, sourceFolder: string, fileIds: Set<string>): string | null

  /**
   * Check if an import is external (npm package, .NET framework, etc.)
   * @param source Import source
   */
  isExternalImport(source: string): boolean
}

/**
 * Parser initialization options
 */
export interface ParserOptions {
  /** Enable JSX parsing (TypeScript/JavaScript) */
  jsx?: boolean
  /** Additional file extensions to recognize */
  additionalExtensions?: string[]
}
