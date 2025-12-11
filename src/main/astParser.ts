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
 * Parse a single file and extract analysis information
 */
export async function parseFile(filePath: string): Promise<FileAnalysisResult> {
  const code = await fs.readFile(filePath, 'utf-8')

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

  try {
    const ast = parse(code, {
      jsx: true,
      loc: true,
      range: true,
      errorOnUnknownASTType: false,
      errorOnTypeScriptSyntacticAndSemanticIssues: false
    })

    // Traverse AST
    traverseAST(ast, result)

    // Post-process: identify React components and hooks
    identifyReactElements(result)
  } catch (error) {
    result.errors?.push({
      file: filePath,
      line: 0,
      message: (error as Error).message
    })
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
 * Handle import declarations
 */
function handleImport(node: TSESTree.ImportDeclaration, result: FileAnalysisResult): void {
  const source = node.source.value as string
  const isExternal = !source.startsWith('.') && !source.startsWith('/')

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
