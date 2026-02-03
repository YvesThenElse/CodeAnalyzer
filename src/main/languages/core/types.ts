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

import type { FileAnalysisResult } from '../../../renderer/src/types/ast.types'

/**
 * Supported language identifiers
 */
export type LanguageId = 'typescript' | 'javascript' | 'csharp'

/**
 * Language-specific metadata attached to FileNode
 */
export interface LanguageMetadata {
  language: LanguageId
  /** C# namespace (C# only) */
  namespace?: string
  /** Assembly references from .csproj (C# only) */
  assemblyReferences?: string[]
}

/**
 * Extended file analysis result with language metadata
 */
export interface ExtendedFileAnalysisResult extends FileAnalysisResult {
  languageMetadata?: LanguageMetadata
}

/**
 * C# specific visibility modifiers
 */
export type CSharpVisibility = 'public' | 'private' | 'protected' | 'internal' | 'protected internal' | 'private protected'

/**
 * Result of parsing a .csproj file
 */
export interface CsprojParseResult {
  projectName: string
  targetFramework?: string
  assemblyReferences: string[]
  packageReferences: Array<{
    name: string
    version?: string
  }>
  projectReferences: string[]
}
