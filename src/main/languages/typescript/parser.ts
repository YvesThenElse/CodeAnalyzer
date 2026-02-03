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

import { parse } from '@typescript-eslint/typescript-estree'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { ILanguageParser } from '../core/interfaces'
import type { LanguageId, ExtendedFileAnalysisResult } from '../core/types'
import type {
  FileAnalysisResult,
  ExportedItem,
  ImportItem,
  ApiCallInfo,
  ReactComponentInfo,
  HookInfo,
  DeclarationItem,
  DeclarationType,
  ParseError
} from '../../../renderer/src/types/ast.types'
import { isPathAlias } from './patterns'

/**
 * Parse error with detailed information
 */
interface ParseErrorInfo {
  type: 'read' | 'encoding' | 'syntax' | 'traversal' | 'unknown'
  file: string
  line: number
  column?: number
  message: string
  details?: string
}

/**
 * TypeScript/JavaScript parser implementation
 */
export class TypeScriptParser implements ILanguageParser {
  readonly languageId: LanguageId = 'typescript'

  private readonly supportedExtensions = ['.ts', '.tsx', '.js', '.jsx']

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
        language: filePath.endsWith('.js') || filePath.endsWith('.jsx') ? 'javascript' : 'typescript'
      }
    }

    // Step 1: Read file with error handling
    let code: string
    try {
      code = await fs.readFile(filePath, 'utf-8')
    } catch (readError) {
      const err = readError as NodeJS.ErrnoException
      let message = 'Failed to read file'

      if (err.code === 'ENOENT') {
        message = 'File not found'
      } else if (err.code === 'EACCES') {
        message = 'Permission denied'
      } else if (err.code === 'EISDIR') {
        message = 'Path is a directory, not a file'
      } else if (err.code === 'EMFILE' || err.code === 'ENFILE') {
        message = 'Too many open files'
      } else if (err.message) {
        message = this.sanitizeErrorMessage(err.message)
      }

      return this.createEmptyResultWithError(filePath, {
        type: 'read',
        file: filePath,
        line: 0,
        message,
        details: err.code
      })
    }

    // Step 2: Check for encoding issues
    if (code.includes('\0')) {
      return this.createEmptyResultWithError(filePath, {
        type: 'encoding',
        file: filePath,
        line: 0,
        message: 'File appears to be binary or has invalid encoding'
      })
    }

    // Step 3: Parse AST
    let ast: ReturnType<typeof parse>
    try {
      ast = parse(code, {
        jsx: true,
        loc: true,
        range: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false
      })
    } catch (parseError) {
      const err = parseError as Error
      const location = this.extractLocationFromError(err)

      let contextLine = ''
      if (location.line > 0) {
        const lines = code.split('\n')
        if (location.line <= lines.length) {
          contextLine = lines[location.line - 1]?.trim().slice(0, 50)
        }
      }

      result.errors?.push({
        type: 'syntax',
        file: filePath,
        line: location.line,
        column: location.column,
        message: this.sanitizeErrorMessage(err.message),
        details: contextLine ? `Near: "${contextLine}"` : undefined
      } as ParseError)

      return result
    }

    // Step 4: Traverse AST
    try {
      this.traverseAST(ast, result)
    } catch (traverseError) {
      const err = traverseError as Error
      result.errors?.push({
        type: 'traversal',
        file: filePath,
        line: 0,
        message: `AST traversal error: ${this.sanitizeErrorMessage(err.message)}`
      } as ParseError)
    }

    // Step 5: Post-process
    try {
      this.identifyReactElements(result)
    } catch (postProcessError) {
      const err = postProcessError as Error
      result.errors?.push({
        type: 'unknown',
        file: filePath,
        line: 0,
        message: `Post-processing error: ${this.sanitizeErrorMessage(err.message)}`
      } as ParseError)
    }

    return result
  }

  private createEmptyResultWithError(filePath: string, error: ParseErrorInfo): ExtendedFileAnalysisResult {
    return {
      filePath,
      exports: [],
      imports: [],
      components: [],
      hooks: [],
      apiCalls: [],
      allDeclarations: [],
      errors: [error as ParseError],
      languageMetadata: {
        language: filePath.endsWith('.js') || filePath.endsWith('.jsx') ? 'javascript' : 'typescript'
      }
    }
  }

  private extractLocationFromError(error: Error): { line: number; column?: number } {
    const lineColMatch = error.message.match(/line\s+(\d+)/i)
    const parenMatch = error.message.match(/\((\d+):(\d+)\)/)

    if (parenMatch) {
      return { line: parseInt(parenMatch[1], 10), column: parseInt(parenMatch[2], 10) }
    }
    if (lineColMatch) {
      const colMatch = error.message.match(/column\s+(\d+)/i)
      return {
        line: parseInt(lineColMatch[1], 10),
        column: colMatch ? parseInt(colMatch[1], 10) : undefined
      }
    }

    if ('lineNumber' in error && typeof error.lineNumber === 'number') {
      return {
        line: error.lineNumber,
        column: 'column' in error && typeof error.column === 'number' ? error.column : undefined
      }
    }

    return { line: 0 }
  }

  private sanitizeErrorMessage(message: string): string {
    return message
      .replace(/at\s+.*:\d+:\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
  }

  private traverseAST(node: TSESTree.Node, result: FileAnalysisResult, isExported = false): void {
    switch (node.type) {
      case 'ImportDeclaration':
        this.handleImport(node, result)
        break

      case 'ExportNamedDeclaration':
        this.handleExportNamed(node, result)
        break

      case 'ExportDefaultDeclaration':
        this.handleExportDefault(node, result)
        break

      case 'CallExpression':
        this.handleCallExpression(node, result)
        break

      case 'FunctionDeclaration':
        this.handleFunctionDeclaration(node, result, isExported)
        break

      case 'ClassDeclaration':
        this.handleClassDeclaration(node, result, isExported)
        break

      case 'VariableDeclaration':
        this.handleVariableDeclaration(node, result, isExported)
        break

      case 'TSTypeAliasDeclaration':
        this.handleTypeAlias(node, result, isExported)
        break

      case 'TSInterfaceDeclaration':
        this.handleInterface(node, result, isExported)
        break

      case 'TSEnumDeclaration':
        this.handleEnum(node, result, isExported)
        break
    }

    // Recursively traverse children
    for (const key of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[key]
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object' && 'type' in item) {
              this.traverseAST(item as TSESTree.Node, result)
            }
          }
        } else if ('type' in child) {
          this.traverseAST(child as TSESTree.Node, result)
        }
      }
    }
  }

  private handleImport(node: TSESTree.ImportDeclaration, result: FileAnalysisResult): void {
    const source = node.source.value as string
    const isRelative = source.startsWith('.') || source.startsWith('/')
    const isAlias = isPathAlias(source)
    const isExternal = !isRelative && !isAlias

    const specifiers = node.specifiers.map((spec) => {
      if (spec.type === 'ImportDefaultSpecifier') {
        return 'default'
      } else if (spec.type === 'ImportNamespaceSpecifier') {
        return '*'
      } else {
        return spec.local.name
      }
    })

    result.imports.push({
      source,
      specifiers,
      isExternal,
      line: node.loc.start.line
    })
  }

  private handleExportNamed(node: TSESTree.ExportNamedDeclaration, result: FileAnalysisResult): void {
    if (!node.declaration) return

    const declaration = node.declaration

    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      const name = declaration.id.name
      result.exports.push({
        name,
        type: 'function',
        isReactComponent: false,
        isHook: this.isHookName(name),
        line: declaration.loc.start.line
      })
      result.allDeclarations.push({
        name,
        type: 'function',
        isExported: true,
        isDefault: false,
        isReactComponent: this.isComponentName(name),
        isHook: this.isHookName(name),
        line: declaration.loc.start.line,
        signature: this.buildFunctionSignature(declaration)
      })
    } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
      const name = declaration.id.name
      result.exports.push({
        name,
        type: 'class',
        isReactComponent: false,
        isHook: false,
        line: declaration.loc.start.line
      })
      result.allDeclarations.push({
        name,
        type: 'class',
        isExported: true,
        isDefault: false,
        isReactComponent: this.isComponentName(name),
        isHook: false,
        line: declaration.loc.start.line
      })
    } else if (declaration.type === 'VariableDeclaration') {
      for (const decl of declaration.declarations) {
        if (decl.id.type === 'Identifier') {
          const name = decl.id.name
          const isArrowFunction =
            decl.init?.type === 'ArrowFunctionExpression' ||
            decl.init?.type === 'FunctionExpression'

          result.exports.push({
            name,
            type: isArrowFunction ? 'function' : 'const',
            isReactComponent: false,
            isHook: this.isHookName(name),
            line: decl.loc.start.line
          })

          const declType: DeclarationType = isArrowFunction ? 'function' : 'const'
          result.allDeclarations.push({
            name,
            type: declType,
            isExported: true,
            isDefault: false,
            isReactComponent: isArrowFunction && this.isComponentName(name),
            isHook: isArrowFunction && this.isHookName(name),
            line: decl.loc.start.line,
            signature: isArrowFunction ? this.buildArrowSignature(decl.init as TSESTree.ArrowFunctionExpression) : undefined
          })
        }
      }
    } else if (declaration.type === 'TSTypeAliasDeclaration') {
      result.allDeclarations.push({
        name: declaration.id.name,
        type: 'type',
        isExported: true,
        isDefault: false,
        isReactComponent: false,
        isHook: false,
        line: declaration.loc.start.line
      })
    } else if (declaration.type === 'TSInterfaceDeclaration') {
      result.allDeclarations.push({
        name: declaration.id.name,
        type: 'interface',
        isExported: true,
        isDefault: false,
        isReactComponent: false,
        isHook: false,
        line: declaration.loc.start.line
      })
    } else if (declaration.type === 'TSEnumDeclaration') {
      result.allDeclarations.push({
        name: declaration.id.name,
        type: 'enum',
        isExported: true,
        isDefault: false,
        isReactComponent: false,
        isHook: false,
        line: declaration.loc.start.line
      })
    }
  }

  private handleExportDefault(node: TSESTree.ExportDefaultDeclaration, result: FileAnalysisResult): void {
    const declaration = node.declaration

    if (declaration.type === 'FunctionDeclaration') {
      const name = declaration.id?.name || 'default'
      result.exports.push({
        name,
        type: 'default',
        isReactComponent: false,
        isHook: declaration.id ? this.isHookName(declaration.id.name) : false,
        line: declaration.loc.start.line
      })
      result.allDeclarations.push({
        name,
        type: 'function',
        isExported: true,
        isDefault: true,
        isReactComponent: this.isComponentName(name),
        isHook: this.isHookName(name),
        line: declaration.loc.start.line,
        signature: this.buildFunctionSignature(declaration)
      })
    } else if (declaration.type === 'ClassDeclaration') {
      const name = declaration.id?.name || 'default'
      result.exports.push({
        name,
        type: 'default',
        isReactComponent: false,
        isHook: false,
        line: declaration.loc.start.line
      })
      result.allDeclarations.push({
        name,
        type: 'class',
        isExported: true,
        isDefault: true,
        isReactComponent: this.isComponentName(name),
        isHook: false,
        line: declaration.loc.start.line
      })
    } else if (declaration.type === 'Identifier') {
      const name = declaration.name
      result.exports.push({
        name,
        type: 'default',
        isReactComponent: false,
        isHook: this.isHookName(name),
        line: declaration.loc.start.line
      })
    }
  }

  private handleCallExpression(node: TSESTree.CallExpression, result: FileAnalysisResult): void {
    if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
      const url = this.extractFirstArgAsString(node)
      result.apiCalls.push({
        method: 'fetch',
        url,
        library: 'fetch',
        line: node.loc.start.line
      })
      return
    }

    if (node.callee.type === 'MemberExpression') {
      const obj = node.callee.object
      const prop = node.callee.property

      if (obj.type === 'Identifier' && prop.type === 'Identifier') {
        const objName = obj.name.toLowerCase()
        const method = prop.name.toLowerCase()

        if ((objName === 'axios' || objName === 'ky') && ['get', 'post', 'put', 'delete', 'patch', 'request'].includes(method)) {
          const url = this.extractFirstArgAsString(node)
          result.apiCalls.push({
            method,
            url,
            library: objName,
            line: node.loc.start.line
          })
        }
      }
    }
  }

  private extractFirstArgAsString(node: TSESTree.CallExpression): string | undefined {
    if (node.arguments.length > 0) {
      const firstArg = node.arguments[0]
      if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
        return firstArg.value
      }
      if (firstArg.type === 'TemplateLiteral' && firstArg.quasis.length === 1) {
        return firstArg.quasis[0].value.raw
      }
    }
    return undefined
  }

  private isHookName(name: string): boolean {
    return /^use[A-Z]/.test(name)
  }

  private isComponentName(name: string): boolean {
    return /^[A-Z]/.test(name)
  }

  private identifyReactElements(result: FileAnalysisResult): void {
    const hasReactImport = result.imports.some(
      (imp) => imp.source === 'react' || imp.source.startsWith('react/')
    )
    const hasJSX = hasReactImport || result.filePath.endsWith('.tsx') || result.filePath.endsWith('.jsx')

    for (const exp of result.exports) {
      if (exp.isHook) {
        result.hooks.push({
          name: exp.name,
          line: exp.line,
          isCustom: true
        })
      } else if (this.isComponentName(exp.name) && hasJSX && exp.type !== 'const') {
        exp.isReactComponent = true
        result.components.push({
          name: exp.name,
          type: exp.type === 'class' ? 'class' : exp.type === 'function' || exp.type === 'default' ? 'function' : 'arrow',
          line: exp.line,
          hasJSX: true,
          usedHooks: []
        })
      }
    }
  }

  private handleFunctionDeclaration(
    node: TSESTree.FunctionDeclaration,
    result: FileAnalysisResult,
    isExported: boolean
  ): void {
    if (!node.id) return

    const name = node.id.name
    const declaration: DeclarationItem = {
      name,
      type: 'function',
      isExported,
      isDefault: false,
      isReactComponent: this.isComponentName(name),
      isHook: this.isHookName(name),
      line: node.loc.start.line,
      signature: this.buildFunctionSignature(node)
    }

    if (!isExported && !result.allDeclarations.some((d) => d.name === name && d.line === declaration.line)) {
      result.allDeclarations.push(declaration)
    }
  }

  private handleClassDeclaration(
    node: TSESTree.ClassDeclaration,
    result: FileAnalysisResult,
    isExported: boolean
  ): void {
    if (!node.id) return

    const name = node.id.name
    const declaration: DeclarationItem = {
      name,
      type: 'class',
      isExported,
      isDefault: false,
      isReactComponent: this.isComponentName(name),
      isHook: false,
      line: node.loc.start.line
    }

    if (!isExported && !result.allDeclarations.some((d) => d.name === name && d.line === declaration.line)) {
      result.allDeclarations.push(declaration)
    }
  }

  private handleVariableDeclaration(
    node: TSESTree.VariableDeclaration,
    result: FileAnalysisResult,
    isExported: boolean
  ): void {
    for (const decl of node.declarations) {
      if (decl.id.type !== 'Identifier') continue

      const name = decl.id.name
      const isArrowFunction =
        decl.init?.type === 'ArrowFunctionExpression' || decl.init?.type === 'FunctionExpression'

      const declType: DeclarationType = isArrowFunction
        ? 'function'
        : node.kind === 'const'
          ? 'const'
          : node.kind === 'let'
            ? 'let'
            : 'var'

      const declaration: DeclarationItem = {
        name,
        type: declType,
        isExported,
        isDefault: false,
        isReactComponent: isArrowFunction && this.isComponentName(name),
        isHook: isArrowFunction && this.isHookName(name),
        line: decl.loc.start.line,
        signature: isArrowFunction ? this.buildArrowSignature(decl.init as TSESTree.ArrowFunctionExpression) : undefined
      }

      if (!isExported && !result.allDeclarations.some((d) => d.name === name && d.line === declaration.line)) {
        result.allDeclarations.push(declaration)
      }
    }
  }

  private handleTypeAlias(
    node: TSESTree.TSTypeAliasDeclaration,
    result: FileAnalysisResult,
    isExported: boolean
  ): void {
    const declaration: DeclarationItem = {
      name: node.id.name,
      type: 'type',
      isExported,
      isDefault: false,
      isReactComponent: false,
      isHook: false,
      line: node.loc.start.line
    }

    if (!result.allDeclarations.some((d) => d.name === declaration.name && d.line === declaration.line)) {
      result.allDeclarations.push(declaration)
    }
  }

  private handleInterface(
    node: TSESTree.TSInterfaceDeclaration,
    result: FileAnalysisResult,
    isExported: boolean
  ): void {
    const declaration: DeclarationItem = {
      name: node.id.name,
      type: 'interface',
      isExported,
      isDefault: false,
      isReactComponent: false,
      isHook: false,
      line: node.loc.start.line
    }

    if (!result.allDeclarations.some((d) => d.name === declaration.name && d.line === declaration.line)) {
      result.allDeclarations.push(declaration)
    }
  }

  private handleEnum(
    node: TSESTree.TSEnumDeclaration,
    result: FileAnalysisResult,
    isExported: boolean
  ): void {
    const declaration: DeclarationItem = {
      name: node.id.name,
      type: 'enum',
      isExported,
      isDefault: false,
      isReactComponent: false,
      isHook: false,
      line: node.loc.start.line
    }

    if (!result.allDeclarations.some((d) => d.name === declaration.name && d.line === declaration.line)) {
      result.allDeclarations.push(declaration)
    }
  }

  private buildFunctionSignature(node: TSESTree.FunctionDeclaration): string {
    const params = node.params
      .map((p) => {
        if (p.type === 'Identifier') return p.name
        if (p.type === 'RestElement' && p.argument.type === 'Identifier') return `...${p.argument.name}`
        return '?'
      })
      .join(', ')
    return `(${params})`
  }

  private buildArrowSignature(node: TSESTree.ArrowFunctionExpression): string {
    const params = node.params
      .map((p) => {
        if (p.type === 'Identifier') return p.name
        if (p.type === 'RestElement' && p.argument.type === 'Identifier') return `...${p.argument.name}`
        return '?'
      })
      .join(', ')
    return `(${params})`
  }
}
