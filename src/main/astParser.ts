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

/**
 * This file is a backward-compatible wrapper for the TypeScript parser.
 * The actual implementation has been moved to languages/typescript/parser.ts
 */

import { TypeScriptParser } from './languages/typescript/parser'
import { getCloudSdkInfo } from './languages/typescript/patterns'
import type { FileAnalysisResult } from '../renderer/src/types/ast.types'

// Create singleton parser instance
const typeScriptParser = new TypeScriptParser()

/**
 * Parse a single file and extract analysis information
 * @deprecated Use ParserRegistry or TypeScriptParser directly
 */
export async function parseFile(filePath: string): Promise<FileAnalysisResult> {
  return typeScriptParser.parseFile(filePath)
}

// Re-export getCloudSdkInfo for backward compatibility
export { getCloudSdkInfo }
