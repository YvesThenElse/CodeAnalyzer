import { parse } from '@typescript-eslint/typescript-estree'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import * as fs from 'fs/promises'
import type {
  FileAnalysisResult,
  ExportedItem,
  ImportItem,
  ApiCallInfo,
  ReactComponentInfo,
  HookInfo
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
function traverseAST(node: TSESTree.Node, result: FileAnalysisResult): void {
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
    result.exports.push({
      name: declaration.id.name,
      type: 'function',
      isReactComponent: false, // Will be determined later
      isHook: isHookName(declaration.id.name),
      line: declaration.loc.start.line
    })
  } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
    result.exports.push({
      name: declaration.id.name,
      type: 'class',
      isReactComponent: false,
      isHook: false,
      line: declaration.loc.start.line
    })
  } else if (declaration.type === 'VariableDeclaration') {
    for (const decl of declaration.declarations) {
      if (decl.id.type === 'Identifier') {
        const isArrowFunction =
          decl.init?.type === 'ArrowFunctionExpression' ||
          decl.init?.type === 'FunctionExpression'

        result.exports.push({
          name: decl.id.name,
          type: isArrowFunction ? 'function' : 'const',
          isReactComponent: false,
          isHook: isHookName(decl.id.name),
          line: decl.loc.start.line
        })
      }
    }
  }
}

/**
 * Handle default export declarations
 */
function handleExportDefault(node: TSESTree.ExportDefaultDeclaration, result: FileAnalysisResult): void {
  const declaration = node.declaration

  if (declaration.type === 'FunctionDeclaration') {
    result.exports.push({
      name: declaration.id?.name || 'default',
      type: 'default',
      isReactComponent: false,
      isHook: declaration.id ? isHookName(declaration.id.name) : false,
      line: declaration.loc.start.line
    })
  } else if (declaration.type === 'ClassDeclaration') {
    result.exports.push({
      name: declaration.id?.name || 'default',
      type: 'default',
      isReactComponent: false,
      isHook: false,
      line: declaration.loc.start.line
    })
  } else if (declaration.type === 'Identifier') {
    result.exports.push({
      name: declaration.name,
      type: 'default',
      isReactComponent: false,
      isHook: isHookName(declaration.name),
      line: declaration.loc.start.line
    })
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
