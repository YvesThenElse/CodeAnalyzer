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
import type {
  FileAnalysisResult,
  ExportedItem,
  ImportItem,
  ApiCallInfo,
  ReactComponentInfo,
  HookInfo,
  DeclarationItem,
  DeclarationType
} from '../renderer/src/types/ast.types'

// Cloud SDK imports to detect
const CLOUD_SDK_PATTERNS: Record<string, { name: string; type: 'cloud_service' | 'sdk' | 'database' }> = {
  'firebase': { name: 'Firebase', type: 'cloud_service' },
  '@firebase': { name: 'Firebase', type: 'cloud_service' },
  'aws-sdk': { name: 'AWS', type: 'cloud_service' },
  '@aws-sdk': { name: 'AWS', type: 'cloud_service' },
  'stripe': { name: 'Stripe', type: 'sdk' },
  '@stripe': { name: 'Stripe', type: 'sdk' },
  'twilio': { name: 'Twilio', type: 'sdk' },
  '@sendgrid': { name: 'SendGrid', type: 'sdk' },
  'pusher': { name: 'Pusher', type: 'sdk' },
  '@supabase': { name: 'Supabase', type: 'cloud_service' },
  '@prisma/client': { name: 'Prisma', type: 'database' },
  'prisma': { name: 'Prisma', type: 'database' },
  'typeorm': { name: 'TypeORM', type: 'database' },
  'mongoose': { name: 'MongoDB', type: 'database' },
  'sequelize': { name: 'Sequelize', type: 'database' },
  'knex': { name: 'Knex', type: 'database' },
  'drizzle-orm': { name: 'Drizzle', type: 'database' }
}

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
 * Create an empty result with error
 */
function createEmptyResultWithError(filePath: string, error: ParseErrorInfo): FileAnalysisResult {
  return {
    filePath,
    exports: [],
    imports: [],
    components: [],
    hooks: [],
    apiCalls: [],
    allDeclarations: [],
    errors: [error]
  }
}

/**
 * Extract line and column from parser error message
 */
function extractLocationFromError(error: Error): { line: number; column?: number } {
  // Try to extract line/column from error message (format: "line X, column Y" or "(X:Y)")
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

  // Check for lineNumber property on error object
  if ('lineNumber' in error && typeof error.lineNumber === 'number') {
    return {
      line: error.lineNumber,
      column: 'column' in error && typeof error.column === 'number' ? error.column : undefined
    }
  }

  return { line: 0 }
}

/**
 * Sanitize error message for display
 */
function sanitizeErrorMessage(message: string): string {
  // Remove file paths from error message to make it cleaner
  return message
    .replace(/at\s+.*:\d+:\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) // Limit message length
}

/**
 * Parse a single file and extract analysis information
 */
export async function parseFile(filePath: string): Promise<FileAnalysisResult> {
  const result: FileAnalysisResult = {
    filePath,
    exports: [],
    imports: [],
    components: [],
    hooks: [],
    apiCalls: [],
    allDeclarations: [],
    errors: []
  }

  // Step 1: Read file with error handling
  let code: string
  try {
    code = await fs.readFile(filePath, 'utf-8')
  } catch (readError) {
    const err = readError as NodeJS.ErrnoException
    let errorType: ParseErrorInfo['type'] = 'read'
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
      message = sanitizeErrorMessage(err.message)
    }

    return createEmptyResultWithError(filePath, {
      type: errorType,
      file: filePath,
      line: 0,
      message,
      details: err.code
    })
  }

  // Step 2: Check for encoding issues (null bytes, binary content)
  if (code.includes('\0')) {
    return createEmptyResultWithError(filePath, {
      type: 'encoding',
      file: filePath,
      line: 0,
      message: 'File appears to be binary or has invalid encoding'
    })
  }

  // Step 3: Parse AST with detailed error handling
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
    const location = extractLocationFromError(err)

    // Try to provide context about where the error occurred
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
      message: sanitizeErrorMessage(err.message),
      details: contextLine ? `Near: "${contextLine}"` : undefined
    } as any)

    // Return partial result - file was read but couldn't be parsed
    return result
  }

  // Step 4: Traverse AST with error handling
  try {
    traverseAST(ast, result)
  } catch (traverseError) {
    const err = traverseError as Error
    result.errors?.push({
      type: 'traversal',
      file: filePath,
      line: 0,
      message: `AST traversal error: ${sanitizeErrorMessage(err.message)}`
    } as any)
    // Continue - we may have partial results
  }

  // Step 5: Post-process with error handling
  try {
    identifyReactElements(result)
  } catch (postProcessError) {
    const err = postProcessError as Error
    result.errors?.push({
      type: 'unknown',
      file: filePath,
      line: 0,
      message: `Post-processing error: ${sanitizeErrorMessage(err.message)}`
    } as any)
    // Continue - we have partial results
  }

  return result
}

/**
 * Traverse AST and collect information
 */
function traverseAST(node: TSESTree.Node, result: FileAnalysisResult, isExported = false): void {
  switch (node.type) {
    case 'ImportDeclaration':
      handleImport(node, result)
      break

    case 'ExportNamedDeclaration':
      handleExportNamed(node, result)
      break

    case 'ExportDefaultDeclaration':
      handleExportDefault(node, result)
      break

    case 'CallExpression':
      handleCallExpression(node, result)
      break

    case 'FunctionDeclaration':
      handleFunctionDeclaration(node, result, isExported)
      break

    case 'ClassDeclaration':
      handleClassDeclaration(node, result, isExported)
      break

    case 'VariableDeclaration':
      handleVariableDeclaration(node, result, isExported)
      break

    case 'TSTypeAliasDeclaration':
      handleTypeAlias(node, result, isExported)
      break

    case 'TSInterfaceDeclaration':
      handleInterface(node, result, isExported)
      break

    case 'TSEnumDeclaration':
      handleEnum(node, result, isExported)
      break
  }

  // Recursively traverse children
  for (const key of Object.keys(node)) {
    const child = (node as Record<string, unknown>)[key]
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            traverseAST(item as TSESTree.Node, result)
          }
        }
      } else if ('type' in child) {
        traverseAST(child as TSESTree.Node, result)
      }
    }
  }
}

/**
 * Check if an import source is a path alias (not a real npm package)
 * Common patterns in TypeScript/Vite/Webpack projects
 */
function isPathAlias(source: string): boolean {
  const aliasPatterns = [
    /^@\//,              // @/ - root alias
    /^@[a-z][a-z0-9-]*\//i,  // @components/, @utils/, @renderer/, etc. (but not @scope/pkg)
    /^~\//,              // ~/ - home alias
    /^#\//,              // #/ - alternative alias
    /^src\//,            // src/ - direct src reference
    /^app\//,            // app/ - Next.js app directory
    /^lib\//,            // lib/ - common lib folder
    /^utils\//,          // utils/ - utils folder
    /^components\//,     // components/ - components folder
    /^hooks\//,          // hooks/ - hooks folder
    /^stores\//,         // stores/ - stores folder
    /^services\//,       // services/ - services folder
    /^types\//,          // types/ - types folder
  ]

  // Also exclude scoped npm packages like @types/xxx, @babel/xxx, @emotion/xxx
  // These are real external packages, not aliases
  const scopedPackagePattern = /^@[a-z][a-z0-9-]*\/[a-z]/i
  if (scopedPackagePattern.test(source)) {
    // Check if it's a known npm scope (not a project alias)
    const knownNpmScopes = [
      '@types/', '@babel/', '@emotion/', '@mui/', '@chakra-ui/',
      '@radix-ui/', '@tanstack/', '@trpc/', '@prisma/', '@nestjs/',
      '@angular/', '@vue/', '@nuxt/', '@svelte/', '@testing-library/',
      '@storybook/', '@typescript-eslint/', '@eslint/', '@vitejs/',
      '@aws-sdk/', '@azure/', '@google-cloud/', '@firebase/',
      '@supabase/', '@stripe/', '@sendgrid/', '@xyflow/',
      '@electron-toolkit/', '@electron/'
    ]
    if (knownNpmScopes.some(scope => source.startsWith(scope))) {
      return false // It's a real npm scoped package
    }
  }

  return aliasPatterns.some(pattern => pattern.test(source))
}

/**
 * Handle import declarations
 */
function handleImport(node: TSESTree.ImportDeclaration, result: FileAnalysisResult): void {
  const source = node.source.value as string

  // Determine if import is external (npm package) or internal (relative/alias)
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

/**
 * Handle named export declarations
 */
function handleExportNamed(node: TSESTree.ExportNamedDeclaration, result: FileAnalysisResult): void {
  if (!node.declaration) return

  const declaration = node.declaration

  if (declaration.type === 'FunctionDeclaration' && declaration.id) {
    const name = declaration.id.name
    result.exports.push({
      name,
      type: 'function',
      isReactComponent: false, // Will be determined later
      isHook: isHookName(name),
      line: declaration.loc.start.line
    })
    // Also add to allDeclarations
    result.allDeclarations.push({
      name,
      type: 'function',
      isExported: true,
      isDefault: false,
      isReactComponent: isComponentName(name),
      isHook: isHookName(name),
      line: declaration.loc.start.line,
      signature: buildFunctionSignature(declaration)
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
      isReactComponent: isComponentName(name),
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
          isHook: isHookName(name),
          line: decl.loc.start.line
        })

        const declType: DeclarationType = isArrowFunction ? 'function' : 'const'
        result.allDeclarations.push({
          name,
          type: declType,
          isExported: true,
          isDefault: false,
          isReactComponent: isArrowFunction && isComponentName(name),
          isHook: isArrowFunction && isHookName(name),
          line: decl.loc.start.line,
          signature: isArrowFunction ? buildArrowSignature(decl.init as TSESTree.ArrowFunctionExpression) : undefined
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

/**
 * Handle default export declarations
 */
function handleExportDefault(node: TSESTree.ExportDefaultDeclaration, result: FileAnalysisResult): void {
  const declaration = node.declaration

  if (declaration.type === 'FunctionDeclaration') {
    const name = declaration.id?.name || 'default'
    result.exports.push({
      name,
      type: 'default',
      isReactComponent: false,
      isHook: declaration.id ? isHookName(declaration.id.name) : false,
      line: declaration.loc.start.line
    })
    result.allDeclarations.push({
      name,
      type: 'function',
      isExported: true,
      isDefault: true,
      isReactComponent: isComponentName(name),
      isHook: isHookName(name),
      line: declaration.loc.start.line,
      signature: buildFunctionSignature(declaration)
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
      isReactComponent: isComponentName(name),
      isHook: false,
      line: declaration.loc.start.line
    })
  } else if (declaration.type === 'Identifier') {
    const name = declaration.name
    result.exports.push({
      name,
      type: 'default',
      isReactComponent: false,
      isHook: isHookName(name),
      line: declaration.loc.start.line
    })
    // Note: The actual declaration is elsewhere, this is just re-exporting
  }
}

/**
 * Handle call expressions to detect API calls
 */
function handleCallExpression(node: TSESTree.CallExpression, result: FileAnalysisResult): void {
  // Detect fetch calls
  if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
    const url = extractFirstArgAsString(node)
    result.apiCalls.push({
      method: 'fetch',
      url,
      library: 'fetch',
      line: node.loc.start.line
    })
    return
  }

  // Detect axios/ky calls
  if (node.callee.type === 'MemberExpression') {
    const obj = node.callee.object
    const prop = node.callee.property

    if (obj.type === 'Identifier' && prop.type === 'Identifier') {
      const objName = obj.name.toLowerCase()
      const method = prop.name.toLowerCase()

      if ((objName === 'axios' || objName === 'ky') && ['get', 'post', 'put', 'delete', 'patch', 'request'].includes(method)) {
        const url = extractFirstArgAsString(node)
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

/**
 * Extract first argument as string if possible
 */
function extractFirstArgAsString(node: TSESTree.CallExpression): string | undefined {
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

/**
 * Check if name follows hook naming convention
 */
function isHookName(name: string): boolean {
  return /^use[A-Z]/.test(name)
}

/**
 * Check if name follows React component naming convention
 */
function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name)
}

/**
 * Post-process to identify React components and hooks
 */
function identifyReactElements(result: FileAnalysisResult): void {
  // Check if file imports React
  const hasReactImport = result.imports.some(
    (imp) => imp.source === 'react' || imp.source.startsWith('react/')
  )

  // Check for JSX by looking for React-related imports
  const hasJSX = hasReactImport || result.filePath.endsWith('.tsx') || result.filePath.endsWith('.jsx')

  // Identify components
  for (const exp of result.exports) {
    if (exp.isHook) {
      result.hooks.push({
        name: exp.name,
        line: exp.line,
        isCustom: true
      })
    } else if (isComponentName(exp.name) && hasJSX && exp.type !== 'const') {
      exp.isReactComponent = true
      result.components.push({
        name: exp.name,
        type: exp.type === 'class' ? 'class' : exp.type === 'function' || exp.type === 'default' ? 'function' : 'arrow',
        line: exp.line,
        hasJSX: true,
        usedHooks: [] // Could be enhanced to detect used hooks
      })
    }
  }
}

/**
 * Handle function declarations (non-exported)
 */
function handleFunctionDeclaration(
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
    isReactComponent: isComponentName(name),
    isHook: isHookName(name),
    line: node.loc.start.line,
    signature: buildFunctionSignature(node)
  }

  // Avoid duplicates (exports are handled separately)
  if (!isExported && !result.allDeclarations.some((d) => d.name === name && d.line === declaration.line)) {
    result.allDeclarations.push(declaration)
  }
}

/**
 * Handle class declarations (non-exported)
 */
function handleClassDeclaration(
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
    isReactComponent: isComponentName(name),
    isHook: false,
    line: node.loc.start.line
  }

  if (!isExported && !result.allDeclarations.some((d) => d.name === name && d.line === declaration.line)) {
    result.allDeclarations.push(declaration)
  }
}

/**
 * Handle variable declarations (non-exported)
 */
function handleVariableDeclaration(
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
      isReactComponent: isArrowFunction && isComponentName(name),
      isHook: isArrowFunction && isHookName(name),
      line: decl.loc.start.line,
      signature: isArrowFunction ? buildArrowSignature(decl.init as TSESTree.ArrowFunctionExpression) : undefined
    }

    if (!isExported && !result.allDeclarations.some((d) => d.name === name && d.line === declaration.line)) {
      result.allDeclarations.push(declaration)
    }
  }
}

/**
 * Handle type alias declarations
 */
function handleTypeAlias(
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

/**
 * Handle interface declarations
 */
function handleInterface(
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

/**
 * Handle enum declarations
 */
function handleEnum(
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

/**
 * Build function signature string
 */
function buildFunctionSignature(node: TSESTree.FunctionDeclaration): string {
  const params = node.params
    .map((p) => {
      if (p.type === 'Identifier') return p.name
      if (p.type === 'RestElement' && p.argument.type === 'Identifier') return `...${p.argument.name}`
      return '?'
    })
    .join(', ')
  return `(${params})`
}

/**
 * Build arrow function signature string
 */
function buildArrowSignature(node: TSESTree.ArrowFunctionExpression): string {
  const params = node.params
    .map((p) => {
      if (p.type === 'Identifier') return p.name
      if (p.type === 'RestElement' && p.argument.type === 'Identifier') return `...${p.argument.name}`
      return '?'
    })
    .join(', ')
  return `(${params})`
}

/**
 * Get cloud SDK info from import source
 */
export function getCloudSdkInfo(source: string): { name: string; type: 'cloud_service' | 'sdk' | 'database' } | null {
  for (const [pattern, info] of Object.entries(CLOUD_SDK_PATTERNS)) {
    if (source === pattern || source.startsWith(pattern + '/')) {
      return info
    }
  }
  return null
}
