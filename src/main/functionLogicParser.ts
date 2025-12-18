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

// Logic node types
type LogicNodeType = 'entry' | 'exit' | 'decision' | 'process' | 'loop' | 'return' | 'call' | 'exception'

interface LogicNode {
  id: string
  type: LogicNodeType
  label: string
  code?: string
  line?: number
}

interface LogicEdge {
  id: string
  source: string
  target: string
  label?: string
}

interface FunctionLogic {
  functionName: string
  fileName: string
  filePath: string
  nodes: LogicNode[]
  edges: LogicEdge[]
}

// ID generator
let nodeIdCounter = 0
function generateNodeId(): string {
  return `node_${++nodeIdCounter}`
}

function resetIdCounter(): void {
  nodeIdCounter = 0
}

/**
 * Parse a file and extract function logic
 */
export async function parseFunctionLogic(
  filePath: string,
  functionName: string,
  functionLine: number
): Promise<FunctionLogic | null> {
  resetIdCounter()

  console.log(`[FunctionLogicParser] Parsing function: ${functionName} at line ${functionLine} in ${filePath}`)

  try {
    const code = await fs.readFile(filePath, 'utf-8')
    const ast = parse(code, {
      jsx: true,
      loc: true,
      range: true,
      errorOnUnknownASTType: false,
      errorOnTypeScriptSyntacticAndSemanticIssues: false
    })

    // Find the function
    const functionNode = findFunction(ast, functionName, functionLine)
    if (!functionNode) {
      console.log(`[FunctionLogicParser] Function not found: ${functionName}`)
      return null
    }
    console.log(`[FunctionLogicParser] Function found at line ${functionNode.loc?.start.line}`)

    // Extract logic
    const nodes: LogicNode[] = []
    const edges: LogicEdge[] = []

    // Create entry node
    const entryId = generateNodeId()
    nodes.push({
      id: entryId,
      type: 'entry',
      label: `${functionName}()`,
      line: functionNode.loc?.start.line
    })

    // Create exit node (will be connected at the end)
    const exitId = generateNodeId()

    // Process function body
    const body = getFunctionBody(functionNode)
    if (body) {
      const lastNodeId = processBlock(body, nodes, edges, entryId)

      // Connect last node to exit (if not already connected via return)
      if (lastNodeId && lastNodeId !== exitId) {
        const hasReturnConnection = edges.some(e => e.target === exitId && e.source === lastNodeId)
        if (!hasReturnConnection) {
          edges.push({
            id: `edge_${edges.length}`,
            source: lastNodeId,
            target: exitId
          })
        }
      }
    } else {
      // Empty function, connect entry to exit directly
      edges.push({
        id: `edge_${edges.length}`,
        source: entryId,
        target: exitId
      })
    }

    // Add exit node
    nodes.push({
      id: exitId,
      type: 'exit',
      label: 'End'
    })

    // Update return nodes to point to exit
    for (const edge of edges) {
      if (edge.target === '__EXIT__') {
        edge.target = exitId
      }
    }

    return {
      functionName,
      fileName: path.basename(filePath),
      filePath,
      nodes,
      edges
    }
  } catch (error) {
    console.error('Error parsing function logic:', error)
    return null
  }
}

/**
 * Find function node in AST by name and approximate line
 */
function findFunction(
  ast: TSESTree.Program,
  functionName: string,
  targetLine: number
): TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
  let found: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null = null
  let bestMatch: { node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression; distance: number } | null = null

  function checkMatch(
    node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
    line: number
  ): void {
    const distance = Math.abs(line - targetLine)
    if (distance <= 5) { // Allow up to 5 lines difference
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { node, distance }
      }
    }
  }

  function traverse(node: TSESTree.Node): void {
    if (found) return

    // Function declaration: function foo() {}
    if (node.type === 'FunctionDeclaration' && node.id?.name === functionName) {
      checkMatch(node, node.loc?.start.line || 0)
    }

    // Export named declaration: export function foo() {} or export const foo = () => {}
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id?.name === functionName) {
        checkMatch(node.declaration, node.loc?.start.line || 0)
      }
      if (node.declaration.type === 'VariableDeclaration') {
        for (const decl of node.declaration.declarations) {
          if (decl.id.type === 'Identifier' && decl.id.name === functionName) {
            const init = unwrapCallExpression(decl.init)
            if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
              checkMatch(init, node.loc?.start.line || 0)
            }
          }
        }
      }
    }

    // Export default: export default function foo() {}
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'FunctionDeclaration') {
        if (node.declaration.id?.name === functionName || !node.declaration.id) {
          checkMatch(node.declaration, node.loc?.start.line || 0)
        }
      }
    }

    // Variable declaration: const foo = () => {} or const foo = function() {}
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id.type === 'Identifier' && decl.id.name === functionName) {
          const init = unwrapCallExpression(decl.init)
          if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
            checkMatch(init, node.loc?.start.line || 0)
          }
        }
      }
    }

    // Class method: class Foo { methodName() {} }
    if (node.type === 'MethodDefinition') {
      const key = node.key
      if (key.type === 'Identifier' && key.name === functionName) {
        if (node.value.type === 'FunctionExpression') {
          checkMatch(node.value, node.loc?.start.line || 0)
        }
      }
    }

    // Object property method: { methodName() {} } or { methodName: () => {} }
    if (node.type === 'Property') {
      const key = node.key
      if (key.type === 'Identifier' && key.name === functionName) {
        if (node.value.type === 'FunctionExpression' || node.value.type === 'ArrowFunctionExpression') {
          checkMatch(node.value, node.loc?.start.line || 0)
        }
      }
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[key]
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object' && 'type' in item) {
              traverse(item as TSESTree.Node)
            }
          }
        } else if ('type' in child) {
          traverse(child as TSESTree.Node)
        }
      }
    }
  }

  traverse(ast)

  // Return best match found
  return bestMatch?.node || null
}

/**
 * Unwrap call expressions like React.memo(), forwardRef(), etc.
 * to get the actual function inside
 */
function unwrapCallExpression(
  node: TSESTree.Expression | null | undefined
): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
  if (!node) return null

  // Direct function
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return node
  }

  // Wrapped in call: memo(() => {}), forwardRef(() => {}), etc.
  if (node.type === 'CallExpression') {
    for (const arg of node.arguments) {
      if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
        return arg
      }
    }
  }

  return null
}

/**
 * Get function body statements
 */
function getFunctionBody(
  node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
): TSESTree.Statement[] | null {
  if (node.body.type === 'BlockStatement') {
    return node.body.body
  }
  // Arrow function with expression body: () => expression
  // Wrap in a synthetic return statement
  if (node.type === 'ArrowFunctionExpression') {
    // Create a synthetic return statement for the expression
    return [{
      type: 'ReturnStatement',
      argument: node.body,
      loc: node.body.loc,
      range: node.body.range
    } as TSESTree.ReturnStatement]
  }
  return null
}

/**
 * Process a block of statements
 * Returns the ID of the last node in the block
 */
function processBlock(
  statements: TSESTree.Statement[],
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  let currentPrevId = previousNodeId

  for (const stmt of statements) {
    const result = processStatement(stmt, nodes, edges, currentPrevId)
    if (result) {
      currentPrevId = result
    }
  }

  return currentPrevId
}

/**
 * Process a single statement
 * Returns the ID of the last node created
 */
function processStatement(
  stmt: TSESTree.Statement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string | null {
  switch (stmt.type) {
    case 'IfStatement':
      return processIfStatement(stmt, nodes, edges, previousNodeId)

    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
      return processForStatement(stmt, nodes, edges, previousNodeId)

    case 'WhileStatement':
    case 'DoWhileStatement':
      return processWhileStatement(stmt, nodes, edges, previousNodeId)

    case 'SwitchStatement':
      return processSwitchStatement(stmt, nodes, edges, previousNodeId)

    case 'TryStatement':
      return processTryStatement(stmt, nodes, edges, previousNodeId)

    case 'ReturnStatement':
      return processReturnStatement(stmt, nodes, edges, previousNodeId)

    case 'ThrowStatement':
      return processThrowStatement(stmt, nodes, edges, previousNodeId)

    case 'BreakStatement':
    case 'ContinueStatement':
      return processBreakContinue(stmt, nodes, edges, previousNodeId)

    case 'ExpressionStatement':
      return processExpressionStatement(stmt, nodes, edges, previousNodeId)

    case 'VariableDeclaration':
      return processVariableDeclaration(stmt, nodes, edges, previousNodeId)

    case 'BlockStatement':
      return processBlock(stmt.body, nodes, edges, previousNodeId)

    default:
      // Other statements (labels, debugger, etc.) - skip
      return previousNodeId
  }
}

/**
 * Process if statement
 */
function processIfStatement(
  stmt: TSESTree.IfStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  // Create decision node
  const decisionId = generateNodeId()
  const condition = getConditionText(stmt.test)
  nodes.push({
    id: decisionId,
    type: 'decision',
    label: condition,
    code: condition,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: decisionId
  })

  // Create merge node (where branches rejoin)
  const mergeId = generateNodeId()
  nodes.push({
    id: mergeId,
    type: 'process',
    label: '(merge)',
    line: stmt.loc?.end.line
  })

  // Process true branch (consequent)
  let trueBranchEnd: string
  if (stmt.consequent.type === 'BlockStatement') {
    trueBranchEnd = processBlock(stmt.consequent.body, nodes, edges, decisionId)
    // Add edge from decision to first node in block with "true" label
    const firstTrueEdge = edges.find(e => e.source === decisionId)
    if (firstTrueEdge) {
      firstTrueEdge.label = 'true'
    }
  } else {
    const trueResult = processStatement(stmt.consequent, nodes, edges, decisionId)
    trueBranchEnd = trueResult || decisionId
    // Label the edge
    const firstTrueEdge = edges.find(e => e.source === decisionId && !e.label)
    if (firstTrueEdge) {
      firstTrueEdge.label = 'true'
    }
  }

  // Connect true branch end to merge
  edges.push({
    id: `edge_${edges.length}`,
    source: trueBranchEnd,
    target: mergeId
  })

  // Process false branch (alternate) if exists
  if (stmt.alternate) {
    let falseBranchEnd: string
    if (stmt.alternate.type === 'BlockStatement') {
      falseBranchEnd = processBlock(stmt.alternate.body, nodes, edges, decisionId)
    } else if (stmt.alternate.type === 'IfStatement') {
      // else if - recursive
      falseBranchEnd = processIfStatement(stmt.alternate, nodes, edges, decisionId)
    } else {
      const falseResult = processStatement(stmt.alternate, nodes, edges, decisionId)
      falseBranchEnd = falseResult || decisionId
    }

    // Label the false edge
    const falseEdge = edges.find(e => e.source === decisionId && !e.label)
    if (falseEdge) {
      falseEdge.label = 'false'
    }

    // Connect false branch end to merge
    edges.push({
      id: `edge_${edges.length}`,
      source: falseBranchEnd,
      target: mergeId
    })
  } else {
    // No else branch - connect decision directly to merge with "false" label
    edges.push({
      id: `edge_${edges.length}`,
      source: decisionId,
      target: mergeId,
      label: 'false'
    })
  }

  return mergeId
}

/**
 * Process for loop
 */
function processForStatement(
  stmt: TSESTree.ForStatement | TSESTree.ForInStatement | TSESTree.ForOfStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  // Create loop decision node
  const loopId = generateNodeId()
  let loopLabel = 'for loop'

  if (stmt.type === 'ForStatement' && stmt.test) {
    loopLabel = getConditionText(stmt.test)
  } else if (stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
    const left = stmt.left.type === 'VariableDeclaration'
      ? (stmt.left.declarations[0]?.id as TSESTree.Identifier)?.name
      : 'item'
    const op = stmt.type === 'ForInStatement' ? 'in' : 'of'
    loopLabel = `${left} ${op} ...`
  }

  nodes.push({
    id: loopId,
    type: 'loop',
    label: loopLabel,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: loopId
  })

  // Process loop body
  let bodyEnd: string
  if (stmt.body.type === 'BlockStatement') {
    bodyEnd = processBlock(stmt.body.body, nodes, edges, loopId)
  } else {
    const result = processStatement(stmt.body, nodes, edges, loopId)
    bodyEnd = result || loopId
  }

  // Label the edge to body as "loop"
  const loopBodyEdge = edges.find(e => e.source === loopId && !e.label)
  if (loopBodyEdge) {
    loopBodyEdge.label = 'loop'
  }

  // Loop back edge
  edges.push({
    id: `edge_${edges.length}`,
    source: bodyEnd,
    target: loopId,
    label: 'next'
  })

  // Create exit node for loop
  const loopExitId = generateNodeId()
  nodes.push({
    id: loopExitId,
    type: 'process',
    label: '(loop exit)',
    line: stmt.loc?.end.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: loopId,
    target: loopExitId,
    label: 'done'
  })

  return loopExitId
}

/**
 * Process while loop
 */
function processWhileStatement(
  stmt: TSESTree.WhileStatement | TSESTree.DoWhileStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  const loopId = generateNodeId()
  const condition = getConditionText(stmt.test)

  nodes.push({
    id: loopId,
    type: 'loop',
    label: condition,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: loopId
  })

  // Process loop body
  let bodyEnd: string
  if (stmt.body.type === 'BlockStatement') {
    bodyEnd = processBlock(stmt.body.body, nodes, edges, loopId)
  } else {
    const result = processStatement(stmt.body, nodes, edges, loopId)
    bodyEnd = result || loopId
  }

  // Label edge to body
  const loopBodyEdge = edges.find(e => e.source === loopId && !e.label)
  if (loopBodyEdge) {
    loopBodyEdge.label = 'true'
  }

  // Loop back edge
  edges.push({
    id: `edge_${edges.length}`,
    source: bodyEnd,
    target: loopId,
    label: 'next'
  })

  // Exit edge
  const loopExitId = generateNodeId()
  nodes.push({
    id: loopExitId,
    type: 'process',
    label: '(loop exit)',
    line: stmt.loc?.end.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: loopId,
    target: loopExitId,
    label: 'false'
  })

  return loopExitId
}

/**
 * Process switch statement
 */
function processSwitchStatement(
  stmt: TSESTree.SwitchStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  const switchId = generateNodeId()
  const discriminant = getExpressionText(stmt.discriminant)

  nodes.push({
    id: switchId,
    type: 'decision',
    label: `switch (${discriminant})`,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: switchId
  })

  // Merge node
  const mergeId = generateNodeId()
  nodes.push({
    id: mergeId,
    type: 'process',
    label: '(switch end)',
    line: stmt.loc?.end.line
  })

  // Process each case
  for (const switchCase of stmt.cases) {
    const caseLabel = switchCase.test ? `case ${getExpressionText(switchCase.test)}` : 'default'

    if (switchCase.consequent.length > 0) {
      const caseEnd = processBlock(switchCase.consequent, nodes, edges, switchId)

      // Label the edge from switch
      const caseEdge = edges.find(e => e.source === switchId && !e.label)
      if (caseEdge) {
        caseEdge.label = caseLabel
      }

      // Connect to merge
      edges.push({
        id: `edge_${edges.length}`,
        source: caseEnd,
        target: mergeId
      })
    }
  }

  return mergeId
}

/**
 * Process try statement
 */
function processTryStatement(
  stmt: TSESTree.TryStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  // Try block
  const tryId = generateNodeId()
  nodes.push({
    id: tryId,
    type: 'exception',
    label: 'try',
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: tryId
  })

  const tryEnd = processBlock(stmt.block.body, nodes, edges, tryId)

  // Merge node
  const mergeId = generateNodeId()
  nodes.push({
    id: mergeId,
    type: 'process',
    label: '(try end)',
    line: stmt.loc?.end.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: tryEnd,
    target: mergeId
  })

  // Catch block
  if (stmt.handler) {
    const catchId = generateNodeId()
    const param = stmt.handler.param?.type === 'Identifier' ? stmt.handler.param.name : 'error'
    nodes.push({
      id: catchId,
      type: 'exception',
      label: `catch (${param})`,
      line: stmt.handler.loc?.start.line
    })

    edges.push({
      id: `edge_${edges.length}`,
      source: tryId,
      target: catchId,
      label: 'error'
    })

    const catchEnd = processBlock(stmt.handler.body.body, nodes, edges, catchId)
    edges.push({
      id: `edge_${edges.length}`,
      source: catchEnd,
      target: mergeId
    })
  }

  // Finally block
  if (stmt.finalizer) {
    const finallyId = generateNodeId()
    nodes.push({
      id: finallyId,
      type: 'exception',
      label: 'finally',
      line: stmt.finalizer.loc?.start.line
    })

    // Connect merge to finally
    edges.push({
      id: `edge_${edges.length}`,
      source: mergeId,
      target: finallyId
    })

    const finallyEnd = processBlock(stmt.finalizer.body, nodes, edges, finallyId)
    return finallyEnd
  }

  return mergeId
}

/**
 * Process return statement
 */
function processReturnStatement(
  stmt: TSESTree.ReturnStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  const returnId = generateNodeId()
  const returnValue = stmt.argument ? getExpressionText(stmt.argument) : ''

  nodes.push({
    id: returnId,
    type: 'return',
    label: returnValue ? `return ${returnValue}` : 'return',
    code: returnValue,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: returnId
  })

  // Return connects to exit (placeholder, will be replaced)
  edges.push({
    id: `edge_${edges.length}`,
    source: returnId,
    target: '__EXIT__'
  })

  return returnId
}

/**
 * Process throw statement
 */
function processThrowStatement(
  stmt: TSESTree.ThrowStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  const throwId = generateNodeId()
  const throwValue = getExpressionText(stmt.argument)

  nodes.push({
    id: throwId,
    type: 'exception',
    label: `throw ${throwValue}`,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: throwId
  })

  // Throw also goes to exit
  edges.push({
    id: `edge_${edges.length}`,
    source: throwId,
    target: '__EXIT__'
  })

  return throwId
}

/**
 * Process break/continue
 */
function processBreakContinue(
  stmt: TSESTree.BreakStatement | TSESTree.ContinueStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  const id = generateNodeId()
  const label = stmt.type === 'BreakStatement' ? 'break' : 'continue'

  nodes.push({
    id,
    type: 'process',
    label,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: id
  })

  return id
}

/**
 * Process expression statement (function calls, assignments)
 */
function processExpressionStatement(
  stmt: TSESTree.ExpressionStatement,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  const expr = stmt.expression
  const nodeId = generateNodeId()

  // Determine node type and label
  let nodeType: LogicNodeType = 'process'
  let label = getExpressionText(expr)

  if (expr.type === 'CallExpression') {
    nodeType = 'call'
    label = getCallExpressionText(expr)
  } else if (expr.type === 'AwaitExpression') {
    nodeType = 'call'
    label = `await ${getExpressionText(expr.argument)}`
  }

  nodes.push({
    id: nodeId,
    type: nodeType,
    label,
    code: label,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: nodeId
  })

  return nodeId
}

/**
 * Process variable declaration
 */
function processVariableDeclaration(
  stmt: TSESTree.VariableDeclaration,
  nodes: LogicNode[],
  edges: LogicEdge[],
  previousNodeId: string
): string {
  const nodeId = generateNodeId()

  const declarations = stmt.declarations
    .map(d => {
      const name = d.id.type === 'Identifier' ? d.id.name : '...'
      const init = d.init ? getExpressionText(d.init) : undefined
      return init ? `${name} = ${init}` : name
    })
    .join(', ')

  const label = `${stmt.kind} ${declarations}`

  nodes.push({
    id: nodeId,
    type: 'process',
    label,
    code: label,
    line: stmt.loc?.start.line
  })

  edges.push({
    id: `edge_${edges.length}`,
    source: previousNodeId,
    target: nodeId
  })

  return nodeId
}

/**
 * Get text representation of condition expression
 */
function getConditionText(node: TSESTree.Expression): string {
  return truncate(getExpressionText(node), 40)
}

/**
 * Get text representation of an expression
 */
function getExpressionText(node: TSESTree.Node): string {
  switch (node.type) {
    case 'Identifier':
      return node.name

    case 'Literal':
      return String(node.value)

    case 'BinaryExpression':
    case 'LogicalExpression':
      return `${getExpressionText(node.left)} ${node.operator} ${getExpressionText(node.right)}`

    case 'UnaryExpression':
      return `${node.operator}${getExpressionText(node.argument)}`

    case 'MemberExpression':
      const obj = getExpressionText(node.object)
      const prop = node.computed
        ? `[${getExpressionText(node.property)}]`
        : `.${getExpressionText(node.property)}`
      return `${obj}${prop}`

    case 'CallExpression':
      return getCallExpressionText(node)

    case 'AssignmentExpression':
      return `${getExpressionText(node.left)} ${node.operator} ${getExpressionText(node.right)}`

    case 'ConditionalExpression':
      return `${getExpressionText(node.test)} ? ... : ...`

    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return '() => {...}'

    case 'ArrayExpression':
      return '[...]'

    case 'ObjectExpression':
      return '{...}'

    case 'TemplateLiteral':
      return '`...`'

    case 'NewExpression':
      return `new ${getExpressionText(node.callee)}(...)`

    case 'AwaitExpression':
      return `await ${getExpressionText(node.argument)}`

    default:
      return '...'
  }
}

/**
 * Get text for call expression
 */
function getCallExpressionText(node: TSESTree.CallExpression): string {
  const callee = getExpressionText(node.callee)
  const args = node.arguments.length > 0 ? '...' : ''
  return `${callee}(${args})`
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}
