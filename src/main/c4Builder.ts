import * as path from 'path'
import {
  C4Level,
  C4NodeType,
  type AnalyzedProject,
  type C4Element,
  type C4Relation,
  type ExternalSystemDetection,
  type DetectionSource
} from '../renderer/src/types/c4.types'
import type { DirectoryStructure, FileAnalysisResult } from '../renderer/src/types/ast.types'
import { getCloudSdkInfo } from './astParser'

// Generate unique IDs
let idCounter = 0
function generateId(prefix: string): string {
  return `${prefix}-${++idCounter}`
}

// Reset ID counter for each analysis
function resetIdCounter(): void {
  idCounter = 0
}

/**
 * Build C4 model from directory structure and analysis results
 */
export function buildC4Model(
  structure: DirectoryStructure,
  projectName: string,
  rootPath: string
): AnalyzedProject {
  resetIdCounter()

  const project: AnalyzedProject = {
    rootPath,
    name: projectName,
    analyzedAt: new Date(),
    levels: {
      [C4Level.SYSTEM_CONTEXT]: [],
      [C4Level.CONTAINER]: [],
      [C4Level.COMPONENT]: [],
      [C4Level.CODE]: []
    },
    relations: [],
    externalSystems: []
  }

  // Collect all file analysis results
  const allFiles = collectAllFiles(structure)

  // Detect external systems from imports and API calls
  const externalSystems = detectExternalSystems(allFiles)
  project.externalSystems = externalSystems

  // Build Level 1: System Context
  buildSystemContext(project, externalSystems)

  // Build Level 2: Containers
  buildContainers(project, structure, allFiles)

  // Build Level 3: Components (features/modules)
  buildComponents(project, structure)

  // Build Level 4: Code (functions, components, hooks)
  buildCodeLevel(project, allFiles)

  // Build relations between elements
  buildRelations(project, allFiles)

  return project
}

/**
 * Collect all files with analysis results from directory structure
 */
function collectAllFiles(structure: DirectoryStructure): Map<string, FileAnalysisResult> {
  const files = new Map<string, FileAnalysisResult>()

  function traverse(node: DirectoryStructure): void {
    if (node.type === 'file' && node.fileInfo) {
      files.set(node.path, node.fileInfo)
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  traverse(structure)
  return files
}

/**
 * Detect external systems from imports and API calls
 */
function detectExternalSystems(files: Map<string, FileAnalysisResult>): ExternalSystemDetection[] {
  const systemsMap = new Map<string, ExternalSystemDetection>()

  for (const [filePath, fileInfo] of files) {
    // Check imports for cloud SDKs
    for (const imp of fileInfo.imports) {
      if (!imp.isExternal) continue

      const sdkInfo = getCloudSdkInfo(imp.source)
      if (sdkInfo) {
        const existing = systemsMap.get(sdkInfo.name)
        const detection: DetectionSource = {
          type: 'import',
          source: `import from '${imp.source}'`,
          file: filePath,
          line: imp.line
        }

        if (existing) {
          existing.detections.push(detection)
        } else {
          systemsMap.set(sdkInfo.name, {
            name: sdkInfo.name,
            type: sdkInfo.type,
            detections: [detection]
          })
        }
      }
    }

    // Check API calls
    for (const call of fileInfo.apiCalls) {
      const name = call.url ? extractApiName(call.url) : `${call.library} API`
      const existing = systemsMap.get(name)
      const detection: DetectionSource = {
        type: 'call',
        source: `${call.library}.${call.method}(${call.url ? `'${call.url}'` : '...'})`,
        file: filePath,
        line: call.line
      }

      if (existing) {
        existing.detections.push(detection)
      } else {
        systemsMap.set(name, {
          name,
          type: 'api',
          detections: [detection]
        })
      }
    }
  }

  return Array.from(systemsMap.values())
}

/**
 * Extract API name from URL
 */
function extractApiName(url: string): string {
  try {
    if (url.startsWith('http')) {
      const urlObj = new URL(url)
      return urlObj.hostname
    }
    // For relative URLs, use first path segment
    const match = url.match(/^\/([^/]+)/)
    return match ? `${match[1]} API` : 'External API'
  } catch {
    return 'External API'
  }
}

/**
 * Build Level 1: System Context
 */
function buildSystemContext(project: AnalyzedProject, externalSystems: ExternalSystemDetection[]): void {
  // Main application
  const mainSystem: C4Element = {
    id: generateId('system'),
    name: project.name,
    description: 'Application React analysée',
    type: C4NodeType.SYSTEM,
    level: C4Level.SYSTEM_CONTEXT,
    children: []
  }
  project.levels[C4Level.SYSTEM_CONTEXT].push(mainSystem)

  // Add external systems
  for (const ext of externalSystems) {
    const nodeType = ext.type === 'cloud_service'
      ? C4NodeType.CLOUD_SERVICE
      : C4NodeType.EXTERNAL_SYSTEM

    const extSystem: C4Element = {
      id: generateId('ext'),
      name: ext.name,
      description: `Système externe (${ext.type})`,
      type: nodeType,
      level: C4Level.SYSTEM_CONTEXT,
      metadata: {
        detectedVia: ext.detections
      }
    }
    project.levels[C4Level.SYSTEM_CONTEXT].push(extSystem)

    // Add relation from main system to external
    project.relations.push({
      id: generateId('rel'),
      sourceId: mainSystem.id,
      targetId: extSystem.id,
      label: ext.type === 'database' ? 'uses database' : 'calls API'
    })
  }
}

/**
 * Build Level 2: Containers
 */
function buildContainers(
  project: AnalyzedProject,
  structure: DirectoryStructure,
  allFiles: Map<string, FileAnalysisResult>
): void {
  const mainSystemId = project.levels[C4Level.SYSTEM_CONTEXT][0]?.id

  // Detect Frontend container (React components)
  const hasReactFiles = Array.from(allFiles.values()).some(
    (f) => f.components.length > 0 || f.imports.some((i) => i.source === 'react')
  )

  if (hasReactFiles) {
    const frontendContainer: C4Element = {
      id: generateId('container'),
      name: 'Frontend',
      description: `Application React SPA - ${allFiles.size} fichiers`,
      type: C4NodeType.CONTAINER_FRONTEND,
      level: C4Level.CONTAINER,
      parentId: mainSystemId,
      children: []
    }
    project.levels[C4Level.CONTAINER].push(frontendContainer)

    // Update main system children
    if (mainSystemId) {
      const mainSystem = project.levels[C4Level.SYSTEM_CONTEXT].find((s) => s.id === mainSystemId)
      if (mainSystem) {
        mainSystem.children = mainSystem.children || []
        mainSystem.children.push(frontendContainer.id)
      }
    }
  }

  // Detect Backend container (server, api, backend directories)
  const backendDirs = ['server', 'api', 'backend', 'functions']
  const hasBackend = structure.children?.some(
    (child) => child.type === 'directory' && backendDirs.includes(child.name.toLowerCase())
  )

  if (hasBackend) {
    const backendContainer: C4Element = {
      id: generateId('container'),
      name: 'Backend',
      description: 'API Backend',
      type: C4NodeType.CONTAINER_BACKEND,
      level: C4Level.CONTAINER,
      parentId: mainSystemId,
      children: []
    }
    project.levels[C4Level.CONTAINER].push(backendContainer)
  }

  // Detect Electron Main Process
  const hasElectron = Array.from(allFiles.values()).some(
    (f) => f.imports.some((i) => i.source === 'electron')
  )

  if (hasElectron) {
    const electronContainer: C4Element = {
      id: generateId('container'),
      name: 'Electron Main',
      description: 'Electron Main Process',
      type: C4NodeType.CONTAINER_BACKEND,
      level: C4Level.CONTAINER,
      parentId: mainSystemId,
      children: []
    }
    project.levels[C4Level.CONTAINER].push(electronContainer)
  }

  // Detect Database from ORM imports
  const hasDatabase = project.externalSystems.some((s) => s.type === 'database')
  if (hasDatabase) {
    const dbSystem = project.externalSystems.find((s) => s.type === 'database')
    const dbContainer: C4Element = {
      id: generateId('container'),
      name: 'Database',
      description: dbSystem?.name || 'Database',
      type: C4NodeType.CONTAINER_DATABASE,
      level: C4Level.CONTAINER,
      parentId: mainSystemId,
      children: []
    }
    project.levels[C4Level.CONTAINER].push(dbContainer)
  }
}

/**
 * Build Level 3: Components (features/modules)
 */
function buildComponents(project: AnalyzedProject, structure: DirectoryStructure): void {
  const frontendContainer = project.levels[C4Level.CONTAINER].find(
    (c) => c.type === C4NodeType.CONTAINER_FRONTEND
  )

  if (!frontendContainer || !structure.children) return

  // Look for common React project structures
  const srcDir = structure.children.find(
    (c) => c.type === 'directory' && c.name === 'src'
  )

  const targetDir = srcDir || structure

  // Find feature/module directories
  const componentDirs = ['components', 'features', 'modules', 'pages', 'views', 'screens']

  function findComponentModules(dir: DirectoryStructure, parentId: string): void {
    if (!dir.children) return

    for (const child of dir.children) {
      if (child.type !== 'directory') continue

      // Check if this is a component directory
      if (componentDirs.includes(child.name.toLowerCase())) {
        // Add each subdirectory as a component
        if (child.children) {
          for (const subdir of child.children) {
            if (subdir.type === 'directory') {
              const fileCount = countFiles(subdir)
              const component: C4Element = {
                id: generateId('component'),
                name: subdir.name,
                description: `Module ${subdir.name} - ${fileCount} fichiers`,
                type: C4NodeType.COMPONENT,
                level: C4Level.COMPONENT,
                parentId,
                children: [],
                metadata: {
                  filePath: subdir.path
                }
              }
              project.levels[C4Level.COMPONENT].push(component)
              frontendContainer.children?.push(component.id)
            }
          }
        }
      } else if (child.name !== 'node_modules' && child.name !== 'dist') {
        // Recurse into other directories
        findComponentModules(child, parentId)
      }
    }
  }

  findComponentModules(targetDir, frontendContainer.id)

  // If no components found, create components from top-level src directories
  if (project.levels[C4Level.COMPONENT].length === 0 && srcDir?.children) {
    for (const child of srcDir.children) {
      if (child.type === 'directory' && !['assets', 'styles', 'types'].includes(child.name)) {
        const fileCount = countFiles(child)
        if (fileCount > 0) {
          const component: C4Element = {
            id: generateId('component'),
            name: child.name,
            description: `Module ${child.name} - ${fileCount} fichiers`,
            type: C4NodeType.COMPONENT,
            level: C4Level.COMPONENT,
            parentId: frontendContainer.id,
            children: [],
            metadata: {
              filePath: child.path
            }
          }
          project.levels[C4Level.COMPONENT].push(component)
          frontendContainer.children?.push(component.id)
        }
      }
    }
  }
}

/**
 * Count files in a directory recursively
 */
function countFiles(dir: DirectoryStructure): number {
  let count = 0
  if (dir.type === 'file') return 1
  if (dir.children) {
    for (const child of dir.children) {
      count += countFiles(child)
    }
  }
  return count
}

/**
 * Build Level 4: Code (functions, components, hooks)
 */
function buildCodeLevel(project: AnalyzedProject, allFiles: Map<string, FileAnalysisResult>): void {
  for (const [filePath, fileInfo] of allFiles) {
    // Find parent component based on file path
    const parentComponent = findParentComponent(project, filePath)
    const parentId = parentComponent?.id

    // Add React components
    for (const comp of fileInfo.components) {
      const codeElement: C4Element = {
        id: generateId('code'),
        name: comp.name,
        description: `Composant React - ${comp.type}`,
        type: C4NodeType.CODE_COMPONENT,
        level: C4Level.CODE,
        parentId,
        metadata: {
          filePath,
          lineNumber: comp.line
        }
      }
      project.levels[C4Level.CODE].push(codeElement)
      if (parentComponent) {
        parentComponent.children = parentComponent.children || []
        parentComponent.children.push(codeElement.id)
      }
    }

    // Add hooks
    for (const hook of fileInfo.hooks) {
      const codeElement: C4Element = {
        id: generateId('code'),
        name: hook.name,
        description: 'Hook custom',
        type: C4NodeType.CODE_HOOK,
        level: C4Level.CODE,
        parentId,
        metadata: {
          filePath,
          lineNumber: hook.line
        }
      }
      project.levels[C4Level.CODE].push(codeElement)
      if (parentComponent) {
        parentComponent.children = parentComponent.children || []
        parentComponent.children.push(codeElement.id)
      }
    }

    // Add exported functions (that are not components or hooks)
    for (const exp of fileInfo.exports) {
      if (!exp.isReactComponent && !exp.isHook && exp.type === 'function') {
        const codeElement: C4Element = {
          id: generateId('code'),
          name: exp.name,
          description: 'Fonction exportée',
          type: C4NodeType.CODE_FUNCTION,
          level: C4Level.CODE,
          parentId,
          metadata: {
            filePath,
            lineNumber: exp.line,
            exportType: exp.type === 'default' ? 'default' : 'named'
          }
        }
        project.levels[C4Level.CODE].push(codeElement)
        if (parentComponent) {
          parentComponent.children = parentComponent.children || []
          parentComponent.children.push(codeElement.id)
        }
      }
    }
  }
}

/**
 * Find parent component for a file path
 */
function findParentComponent(project: AnalyzedProject, filePath: string): C4Element | undefined {
  for (const component of project.levels[C4Level.COMPONENT]) {
    if (component.metadata?.filePath && filePath.startsWith(component.metadata.filePath)) {
      return component
    }
  }
  return undefined
}

/**
 * Build relations between elements based on imports
 */
function buildRelations(project: AnalyzedProject, allFiles: Map<string, FileAnalysisResult>): void {
  // Create a map of file paths to their code elements
  const fileToElements = new Map<string, C4Element[]>()
  for (const element of project.levels[C4Level.CODE]) {
    const filePath = element.metadata?.filePath
    if (filePath) {
      const existing = fileToElements.get(filePath) || []
      existing.push(element)
      fileToElements.set(filePath, existing)
    }
  }

  // Build relations based on imports
  for (const [filePath, fileInfo] of allFiles) {
    const sourceElements = fileToElements.get(filePath) || []

    for (const imp of fileInfo.imports) {
      if (imp.isExternal) continue

      // Resolve import path
      const resolvedPath = resolveImportPath(filePath, imp.source)
      const targetElements = fileToElements.get(resolvedPath) || []

      // Create relations between source and target elements
      for (const source of sourceElements) {
        for (const target of targetElements) {
          // Avoid duplicate relations
          const exists = project.relations.some(
            (r) => r.sourceId === source.id && r.targetId === target.id
          )
          if (!exists && source.id !== target.id) {
            project.relations.push({
              id: generateId('rel'),
              sourceId: source.id,
              targetId: target.id,
              label: 'imports'
            })
          }
        }
      }
    }
  }
}

/**
 * Resolve import path to absolute path
 */
function resolveImportPath(fromPath: string, importSource: string): string {
  const dir = path.dirname(fromPath)
  let resolved = path.resolve(dir, importSource)

  // Add common extensions if not present
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
  for (const ext of extensions) {
    const withExt = resolved + ext
    // In a real implementation, we would check if the file exists
    // For now, return the first possibility
    if (!resolved.match(/\.(ts|tsx|js|jsx)$/)) {
      resolved = resolved + extensions[0]
      break
    }
  }

  return resolved
}
