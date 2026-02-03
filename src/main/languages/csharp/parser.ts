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
import type { ILanguageParser } from '../core/interfaces'
import type { LanguageId, ExtendedFileAnalysisResult } from '../core/types'
import type {
  DeclarationItem,
  DeclarationType,
  ImportItem,
  ParseError
} from '../../../renderer/src/types/ast.types'
import { parseVisibility, isExported, isFrameworkNamespace } from './nodeTypes'

/**
 * C# parser implementation using regex-based parsing
 * This avoids native module dependencies (tree-sitter) which can be problematic in Electron
 */
export class CSharpParser implements ILanguageParser {
  readonly languageId: LanguageId = 'csharp'

  private readonly supportedExtensions = ['.cs']

  getSupportedExtensions(): string[] {
    return this.supportedExtensions
  }

  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return this.supportedExtensions.includes(ext)
  }

  async parseFile(filePath: string): Promise<ExtendedFileAnalysisResult> {
    const result: ExtendedFileAnalysisResult = {
      filePath,
      exports: [],
      imports: [],
      components: [],
      hooks: [],
      apiCalls: [],
      allDeclarations: [],
      errors: [],
      languageMetadata: {
        language: 'csharp'
      }
    }

    // Read file
    let code: string
    try {
      code = await fs.readFile(filePath, 'utf-8')
    } catch (readError) {
      const err = readError as NodeJS.ErrnoException
      let message = 'Failed to read file'

      if (err.code === 'ENOENT') message = 'File not found'
      else if (err.code === 'EACCES') message = 'Permission denied'
      else if (err.message) message = err.message.slice(0, 200)

      result.errors?.push({
        type: 'read',
        file: filePath,
        line: 0,
        message
      } as ParseError)
      return result
    }

    // Check for binary content
    if (code.includes('\0')) {
      result.errors?.push({
        type: 'encoding',
        file: filePath,
        line: 0,
        message: 'File appears to be binary'
      } as ParseError)
      return result
    }

    try {
      // Parse namespace
      const namespace = this.parseNamespace(code)
      if (namespace) {
        result.languageMetadata!.namespace = namespace
      }

      // Parse using directives
      result.imports = this.parseUsingDirectives(code)

      // Parse declarations
      result.allDeclarations = this.parseDeclarations(code, filePath)

      // Convert exported declarations to exports array (for compatibility)
      for (const decl of result.allDeclarations) {
        if (decl.isExported) {
          result.exports.push({
            name: decl.name,
            type: decl.type === 'function' ? 'function' : decl.type === 'class' ? 'class' : 'const',
            isReactComponent: false,
            isHook: false,
            line: decl.line
          })
        }
      }
    } catch (parseError) {
      const err = parseError as Error
      result.errors?.push({
        type: 'syntax',
        file: filePath,
        line: 0,
        message: `Parse error: ${err.message.slice(0, 200)}`
      } as ParseError)
    }

    return result
  }

  /**
   * Parse namespace declaration from C# code
   * Supports both block-scoped and file-scoped namespaces
   */
  private parseNamespace(code: string): string | undefined {
    // File-scoped namespace (C# 10+): namespace MyApp.Services;
    const fileScopedMatch = code.match(/^\s*namespace\s+([\w.]+)\s*;/m)
    if (fileScopedMatch) {
      return fileScopedMatch[1]
    }

    // Block-scoped namespace: namespace MyApp.Services { ... }
    const blockScopedMatch = code.match(/^\s*namespace\s+([\w.]+)\s*\{/m)
    if (blockScopedMatch) {
      return blockScopedMatch[1]
    }

    return undefined
  }

  /**
   * Parse using directives
   */
  private parseUsingDirectives(code: string): ImportItem[] {
    const imports: ImportItem[] = []
    const usingRegex = /^\s*using\s+(?:static\s+)?([\w.]+)\s*;/gm
    let match: RegExpExecArray | null

    while ((match = usingRegex.exec(code)) !== null) {
      const namespace = match[1]
      const line = this.getLineNumber(code, match.index)

      imports.push({
        source: namespace,
        specifiers: ['*'], // C# using imports everything from namespace
        isExternal: isFrameworkNamespace(namespace),
        line
      })
    }

    // Also parse using aliases: using Alias = Namespace.Type;
    const aliasRegex = /^\s*using\s+(\w+)\s*=\s*([\w.]+)\s*;/gm
    while ((match = aliasRegex.exec(code)) !== null) {
      const alias = match[1]
      const namespace = match[2]
      const line = this.getLineNumber(code, match.index)

      imports.push({
        source: namespace,
        specifiers: [alias],
        isExternal: isFrameworkNamespace(namespace),
        line
      })
    }

    return imports
  }

  /**
   * Parse all declarations from C# code
   */
  private parseDeclarations(code: string, filePath: string): DeclarationItem[] {
    const declarations: DeclarationItem[] = []

    // Remove comments and strings to avoid false matches
    const cleanCode = this.removeCommentsAndStrings(code)

    // Parse classes
    this.parseTypeDeclarations(cleanCode, code, 'class', 'class', declarations, filePath)

    // Parse interfaces
    this.parseTypeDeclarations(cleanCode, code, 'interface', 'interface', declarations, filePath)

    // Parse structs (map to class)
    this.parseTypeDeclarations(cleanCode, code, 'struct', 'class', declarations, filePath)

    // Parse records (map to class)
    this.parseTypeDeclarations(cleanCode, code, 'record', 'class', declarations, filePath)

    // Parse enums
    this.parseTypeDeclarations(cleanCode, code, 'enum', 'enum', declarations, filePath)

    // Parse delegates (map to type)
    this.parseDelegates(cleanCode, code, declarations, filePath)

    // Parse top-level methods (for top-level statements in C# 9+)
    // Note: We don't parse methods inside classes as they're not top-level declarations

    return declarations
  }

  /**
   * Parse type declarations (class, interface, struct, record, enum)
   */
  private parseTypeDeclarations(
    cleanCode: string,
    originalCode: string,
    keyword: string,
    mappedType: DeclarationType,
    declarations: DeclarationItem[],
    filePath: string
  ): void {
    // Pattern: [modifiers] keyword Name [<generics>] [: base] { or ;
    const modifierPattern = '(?:(?:public|private|protected|internal|static|abstract|sealed|partial|readonly|new)\\s+)*'
    const genericPattern = '(?:<[^>]+>)?'
    const basePattern = '(?:\\s*:\\s*[\\w.<>,\\s]+)?'
    const regex = new RegExp(
      `(${modifierPattern})${keyword}\\s+(\\w+)${genericPattern}${basePattern}\\s*[{;]`,
      'g'
    )

    let match: RegExpExecArray | null
    while ((match = regex.exec(cleanCode)) !== null) {
      const modifiersStr = match[1].trim()
      const name = match[2]
      const line = this.getLineNumber(originalCode, match.index)

      const modifiers = modifiersStr.split(/\s+/).filter(Boolean)
      const visibility = parseVisibility(modifiers)

      declarations.push({
        name,
        type: mappedType,
        isExported: isExported(visibility),
        isDefault: false,
        isReactComponent: false,
        isHook: false,
        line
      })
    }
  }

  /**
   * Parse delegate declarations
   */
  private parseDelegates(
    cleanCode: string,
    originalCode: string,
    declarations: DeclarationItem[],
    filePath: string
  ): void {
    // Pattern: [modifiers] delegate ReturnType Name([params]);
    const modifierPattern = '(?:(?:public|private|protected|internal|static|new)\\s+)*'
    const regex = new RegExp(
      `(${modifierPattern})delegate\\s+[\\w.<>\\[\\],\\s]+\\s+(\\w+)\\s*\\([^)]*\\)\\s*;`,
      'g'
    )

    let match: RegExpExecArray | null
    while ((match = regex.exec(cleanCode)) !== null) {
      const modifiersStr = match[1].trim()
      const name = match[2]
      const line = this.getLineNumber(originalCode, match.index)

      const modifiers = modifiersStr.split(/\s+/).filter(Boolean)
      const visibility = parseVisibility(modifiers)

      declarations.push({
        name,
        type: 'type',
        isExported: isExported(visibility),
        isDefault: false,
        isReactComponent: false,
        isHook: false,
        line
      })
    }
  }

  /**
   * Remove comments and string literals from code to avoid false matches
   */
  private removeCommentsAndStrings(code: string): string {
    let result = code

    // Remove multi-line comments /* ... */
    result = result.replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length))

    // Remove single-line comments // ...
    result = result.replace(/\/\/[^\n]*/g, match => ' '.repeat(match.length))

    // Remove verbatim strings @"..."
    result = result.replace(/@"(?:[^"]|"")*"/g, match => ' '.repeat(match.length))

    // Remove interpolated strings $"..."
    result = result.replace(/\$"(?:[^"\\]|\\.)*"/g, match => ' '.repeat(match.length))

    // Remove regular strings "..."
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, match => ' '.repeat(match.length))

    // Remove char literals '...'
    result = result.replace(/'(?:[^'\\]|\\.)*'/g, match => ' '.repeat(match.length))

    return result
  }

  /**
   * Get line number for a character position
   */
  private getLineNumber(code: string, position: number): number {
    const substring = code.substring(0, position)
    return (substring.match(/\n/g) || []).length + 1
  }
}
