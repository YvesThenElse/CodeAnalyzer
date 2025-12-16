import * as path from 'path'
import type { DirectoryStructure, FileAnalysisResult, DeclarationItem } from '../renderer/src/types/ast.types'
import {
  ClusteringMode,
  type AnalyzedGraph,
  type SerializedAnalyzedGraph,
  type FileNode,
  type FileNodeType,
  type CodeItem,
  type CodeItemType,
  type FileImport,
  type ImportRelation,
  type Cluster,
  type GraphStats
} from '../renderer/src/types/graph.types'
import { detectCommunities } from './communityDetection'

// Color generation for folders
const FOLDER_BASE_HUES = [210, 150, 35, 270, 0, 330, 185, 75]

// Map to store import sources for each file
const fileImportSources = new Map<string, InternalImportInfo[]>()

/**
 * Build dependency graph from analyzed files
 */
export function buildDependencyGraph(
  structure: DirectoryStructure,
  projectName: string,
  rootPath: string
): SerializedAnalyzedGraph {
  // Clear previous state
  fileImportSources.clear()

  // Collect all analyzed files
  const fileResults = new Map<string, FileAnalysisResult>()
  collectFileResults(structure, fileResults)

  // Build file nodes
  const files = new Map<string, FileNode>()
  const rootFolders = new Set<string>()

  for (const [filePath, fileInfo] of fileResults) {
    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/')
    const folder = path.dirname(relativePath)
    const rootFolder = getRootFolder(relativePath)

    if (rootFolder) {
      rootFolders.add(rootFolder)
    }

    const importSources: InternalImportInfo[] = []
    const fileNode = createFileNode(filePath, relativePath, folder, rootFolder, fileInfo, importSources)
    files.set(fileNode.id, fileNode)
    fileImportSources.set(fileNode.id, importSources)
  }

  const rootFoldersArray = Array.from(rootFolders).sort()

  // Assign colors to files based on their root folder
  for (const file of files.values()) {
    file.color = getFolderColor(file.rootFolder, rootFoldersArray, file.folderDepth)
  }

  // Build import relations (now with access to import sources)
  const relations = buildImportRelationsWithSources(files, rootPath)

  // Build folder clusters
  const folderClusters = buildFolderClusters(files, rootFoldersArray)

  // Build community clusters
  const communityClusters = buildCommunityClusters(files, relations)

  // Calculate stats
  const stats = calculateStats(files, relations)

  // Create analyzed graph
  const graph: AnalyzedGraph = {
    rootPath,
    name: projectName,
    analyzedAt: new Date(),
    files,
    relations,
    clusters: {
      [ClusteringMode.FOLDER]: folderClusters,
      [ClusteringMode.COMMUNITY]: communityClusters
    },
    rootFolders: rootFoldersArray,
    stats
  }

  // Serialize for IPC
  return serializeGraph(graph)
}

/**
 * Collect all file analysis results from directory structure
 */
function collectFileResults(
  structure: DirectoryStructure,
  results: Map<string, FileAnalysisResult>
): void {
  if (structure.type === 'file' && structure.fileInfo) {
    results.set(structure.path, structure.fileInfo)
  }

  if (structure.children) {
    for (const child of structure.children) {
      collectFileResults(child, results)
    }
  }
}

/**
 * Get the root folder from a relative path
 */
function getRootFolder(relativePath: string): string {
  const parts = relativePath.split('/')
  // Skip 'src' if it's the first part
  if (parts[0] === 'src' && parts.length > 1) {
    return parts[1]
  }
  return parts[0]
}

/**
 * Get folder depth relative to root folder
 */
function getFolderDepth(folder: string, rootFolder: string): number {
  if (!folder || folder === '.' || folder === rootFolder) return 0

  const folderParts = folder.split('/')
  const rootIndex = folderParts.indexOf(rootFolder)

  if (rootIndex === -1) return 0

  return folderParts.length - rootIndex - 1
}

/**
 * Generate HSL color for a folder
 */
function getFolderColor(rootFolder: string, rootFolders: string[], depth: number): string {
  const rootIndex = rootFolders.indexOf(rootFolder)
  const colorIndex = rootIndex >= 0 ? rootIndex : 0
  const hue = FOLDER_BASE_HUES[colorIndex % FOLDER_BASE_HUES.length]
  const saturation = 70
  const lightness = Math.min(45 + depth * 10, 80)

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// Store original import sources for resolution
interface InternalImportInfo {
  source: string
  specifiers: string[]
  line: number
}

/**
 * Create a FileNode from file analysis result
 */
function createFileNode(
  filePath: string,
  relativePath: string,
  folder: string,
  rootFolder: string,
  fileInfo: FileAnalysisResult,
  internalImportsOut: InternalImportInfo[]
): FileNode {
  const fileName = path.basename(filePath)
  const fileType = getFileType(fileName)

  // Convert declarations to CodeItems
  const codeItems: CodeItem[] = fileInfo.allDeclarations.map((decl) =>
    declarationToCodeItem(decl, filePath)
  )

  // Collect internal imports for later resolution
  const internalImports = fileInfo.imports.filter((imp) => !imp.isExternal)
  for (const imp of internalImports) {
    internalImportsOut.push({
      source: imp.source,
      specifiers: imp.specifiers,
      line: imp.line
    })
  }

  // Get internal imports (will be resolved later)
  const imports: FileImport[] = internalImports.map((imp) => ({
    targetFileId: '', // Will be resolved later
    specifiers: imp.specifiers,
    line: imp.line
  }))

  // Get external import names
  const externalImports = fileInfo.imports
    .filter((imp) => imp.isExternal)
    .map((imp) => imp.source)

  return {
    id: relativePath, // Use relative path as ID for easier matching
    filePath,
    relativePath,
    fileName,
    folder,
    folderDepth: getFolderDepth(folder, rootFolder),
    rootFolder,
    type: fileType,
    codeItems,
    imports,
    externalImports,
    color: '' // Will be set later
  }
}

/**
 * Determine file type from filename
 */
function getFileType(fileName: string): FileNodeType {
  if (fileName === 'index.ts' || fileName === 'index.tsx' || fileName === 'index.js' || fileName === 'index.jsx') {
    return 'index_file'
  }
  if (fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('__tests__')) {
    return 'test_file'
  }
  if (fileName.endsWith('.config.ts') || fileName.endsWith('.config.js') || fileName === 'tsconfig.json') {
    return 'config_file'
  }
  return 'source_file'
}

/**
 * Convert DeclarationItem to CodeItem
 */
function declarationToCodeItem(decl: DeclarationItem, filePath: string): CodeItem {
  let type: CodeItemType

  if (decl.isReactComponent) {
    type = 'react_component'
  } else if (decl.isHook) {
    type = 'hook'
  } else if (decl.type === 'function') {
    type = 'function'
  } else if (decl.type === 'class') {
    type = 'class'
  } else if (decl.type === 'interface') {
    type = 'interface'
  } else if (decl.type === 'type') {
    type = 'type'
  } else {
    type = 'const'
  }

  return {
    id: `${filePath}:${decl.name}:${decl.line}`,
    name: decl.name,
    type,
    isExported: decl.isExported,
    isDefault: decl.isDefault,
    line: decl.line,
    signature: decl.signature
  }
}

/**
 * Build import relations using stored import sources
 */
function buildImportRelationsWithSources(
  files: Map<string, FileNode>,
  rootPath: string
): ImportRelation[] {
  const relations: ImportRelation[] = []
  const seenRelations = new Set<string>()

  for (const file of files.values()) {
    const importSources = fileImportSources.get(file.id) || []

    for (let i = 0; i < importSources.length; i++) {
      const importInfo = importSources[i]

      // Resolve the import path to a file ID
      const targetFileId = resolveImportPath(
        importInfo.source,
        file.folder,
        files
      )

      if (targetFileId && targetFileId !== file.id) {
        const relationKey = `${file.id}->${targetFileId}`
        if (!seenRelations.has(relationKey)) {
          seenRelations.add(relationKey)

          // Update the file's import with resolved target
          if (file.imports[i]) {
            file.imports[i].targetFileId = targetFileId
          }

          relations.push({
            id: relationKey,
            sourceFileId: file.id,
            targetFileId,
            specifiers: importInfo.specifiers,
            label: importInfo.specifiers.length > 0
              ? `{ ${importInfo.specifiers.slice(0, 3).join(', ')}${importInfo.specifiers.length > 3 ? '...' : ''} }`
              : 'imports'
          })
        }
      }
    }
  }

  return relations
}

/**
 * Try to resolve an alias import to a path
 * Common alias patterns: @/, @components/, ~/src/, etc.
 */
function resolveAliasPath(importSource: string): string | null {
  // @/ or @src/ -> src/
  if (importSource.startsWith('@/')) {
    return 'src/' + importSource.slice(2)
  }

  // @src/ -> src/
  if (importSource.startsWith('@src/')) {
    return 'src/' + importSource.slice(5)
  }

  // ~/ -> src/
  if (importSource.startsWith('~/')) {
    return 'src/' + importSource.slice(2)
  }

  // @renderer/ -> src/renderer/ (Electron projects)
  if (importSource.startsWith('@renderer/')) {
    return 'src/renderer/' + importSource.slice(10)
  }

  // @main/ -> src/main/ (Electron projects)
  if (importSource.startsWith('@main/')) {
    return 'src/main/' + importSource.slice(6)
  }

  // @components/, @utils/, @hooks/, @stores/, @types/, @services/, @lib/, @api/, @assets/
  // These commonly map to src/<folder>/
  const commonFolderAliases = [
    'components', 'utils', 'hooks', 'stores', 'store', 'types',
    'services', 'lib', 'api', 'assets', 'styles', 'config',
    'helpers', 'constants', 'context', 'contexts', 'features',
    'pages', 'views', 'layouts', 'shared', 'common', 'modules'
  ]

  for (const folder of commonFolderAliases) {
    const aliasPattern = `@${folder}/`
    if (importSource.startsWith(aliasPattern)) {
      return 'src/' + folder + '/' + importSource.slice(aliasPattern.length)
    }
  }

  // #/ -> src/ (alternative alias)
  if (importSource.startsWith('#/')) {
    return 'src/' + importSource.slice(2)
  }

  // src/ without alias (direct reference)
  if (importSource.startsWith('src/')) {
    return importSource
  }

  return null
}

/**
 * Resolve import path (e.g., './Button', '../hooks/useAuth') to file ID
 */
function resolveImportPath(
  importSource: string,
  sourceFolder: string,
  files: Map<string, FileNode>
): string | null {
  // Normalize the import path
  let resolvedPath: string

  if (importSource.startsWith('./')) {
    // Relative to current folder
    resolvedPath = path.join(sourceFolder, importSource.slice(2)).replace(/\\/g, '/')
  } else if (importSource.startsWith('../')) {
    // Relative to parent folder
    resolvedPath = path.join(sourceFolder, importSource).replace(/\\/g, '/')
  } else if (importSource.startsWith('/')) {
    // Absolute from root
    resolvedPath = importSource.slice(1)
  } else {
    // Try to resolve as alias
    const aliasResolved = resolveAliasPath(importSource)
    if (aliasResolved) {
      resolvedPath = aliasResolved
    } else {
      // Can't resolve without config
      return null
    }
  }

  // Try different file extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']

  for (const ext of extensions) {
    const candidate = resolvedPath + ext
    if (files.has(candidate)) {
      return candidate
    }
  }

  // Try without 'src/' prefix if present (in case file IDs don't include src/)
  if (resolvedPath.startsWith('src/')) {
    const withoutSrc = resolvedPath.slice(4)
    for (const ext of extensions) {
      const candidate = withoutSrc + ext
      if (files.has(candidate)) {
        return candidate
      }
    }
  }

  // Try with 'src/' prefix if not present (in case file IDs include src/)
  if (!resolvedPath.startsWith('src/')) {
    const withSrc = 'src/' + resolvedPath
    for (const ext of extensions) {
      const candidate = withSrc + ext
      if (files.has(candidate)) {
        return candidate
      }
    }
  }

  return null
}

/**
 * Build folder-based clusters
 */
function buildFolderClusters(
  files: Map<string, FileNode>,
  rootFolders: string[]
): Cluster[] {
  const clusterMap = new Map<string, string[]>()

  // Group files by their folder
  for (const file of files.values()) {
    const clusterKey = file.folder || 'root'
    const existing = clusterMap.get(clusterKey) || []
    existing.push(file.id)
    clusterMap.set(clusterKey, existing)
  }

  // Create clusters
  const clusters: Cluster[] = []
  let colorIndex = 0

  for (const [folderPath, fileIds] of clusterMap) {
    const rootFolder = getRootFolder(folderPath + '/dummy')
    const depth = getFolderDepth(folderPath, rootFolder)

    clusters.push({
      id: `folder-${folderPath}`,
      name: path.basename(folderPath) || 'root',
      folderPath,
      fileIds,
      color: getFolderColor(rootFolder, rootFolders, depth),
      depth,
      mode: ClusteringMode.FOLDER
    })

    colorIndex++
  }

  return clusters.sort((a, b) => a.folderPath.localeCompare(b.folderPath))
}

/**
 * Build community-based clusters using Louvain algorithm
 */
function buildCommunityClusters(
  files: Map<string, FileNode>,
  relations: ImportRelation[]
): Cluster[] {
  // Use community detection algorithm
  const communities = detectCommunities(files, relations)

  // Convert to clusters
  const clusters: Cluster[] = []
  const communityCount = new Set(communities.values()).size

  const communityGroups = new Map<string, string[]>()
  for (const [fileId, communityId] of communities) {
    const existing = communityGroups.get(communityId) || []
    existing.push(fileId)
    communityGroups.set(communityId, existing)

    // Update file's communityId
    const file = files.get(fileId)
    if (file) {
      file.communityId = communityId
    }
  }

  let index = 0
  for (const [communityId, fileIds] of communityGroups) {
    // Use golden ratio for better color distribution
    const goldenRatio = 0.618033988749895
    const hue = Math.round(((index * goldenRatio) % 1) * 360)

    clusters.push({
      id: communityId,
      name: `Group ${index + 1}`,
      folderPath: '',
      fileIds,
      color: `hsl(${hue}, 65%, 55%)`,
      depth: 0,
      mode: ClusteringMode.COMMUNITY
    })

    index++
  }

  return clusters
}

/**
 * Calculate graph statistics
 */
function calculateStats(
  files: Map<string, FileNode>,
  relations: ImportRelation[]
): GraphStats {
  const totalFiles = files.size
  const totalCodeItems = Array.from(files.values()).reduce(
    (sum, file) => sum + file.codeItems.length,
    0
  )
  const totalImports = relations.length
  const averageImportsPerFile = totalFiles > 0 ? totalImports / totalFiles : 0

  // Find most connected files
  const connectionCount = new Map<string, number>()
  for (const rel of relations) {
    connectionCount.set(rel.sourceFileId, (connectionCount.get(rel.sourceFileId) || 0) + 1)
    connectionCount.set(rel.targetFileId, (connectionCount.get(rel.targetFileId) || 0) + 1)
  }

  const mostConnectedFiles = Array.from(connectionCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([fileId]) => fileId)

  return {
    totalFiles,
    totalCodeItems,
    totalImports,
    averageImportsPerFile: Math.round(averageImportsPerFile * 100) / 100,
    mostConnectedFiles
  }
}

/**
 * Serialize graph for IPC transfer (Map -> Array)
 */
function serializeGraph(graph: AnalyzedGraph): SerializedAnalyzedGraph {
  return {
    rootPath: graph.rootPath,
    name: graph.name,
    analyzedAt: graph.analyzedAt.toISOString(),
    files: Array.from(graph.files.entries()),
    relations: graph.relations,
    clusters: {
      folder: graph.clusters[ClusteringMode.FOLDER],
      community: graph.clusters[ClusteringMode.COMMUNITY]
    },
    rootFolders: graph.rootFolders,
    stats: graph.stats
  }
}

/**
 * Deserialize graph from IPC transfer (Array -> Map)
 */
export function deserializeGraph(serialized: SerializedAnalyzedGraph): AnalyzedGraph {
  return {
    rootPath: serialized.rootPath,
    name: serialized.name,
    analyzedAt: new Date(serialized.analyzedAt),
    files: new Map(serialized.files),
    relations: serialized.relations,
    clusters: {
      [ClusteringMode.FOLDER]: serialized.clusters.folder,
      [ClusteringMode.COMMUNITY]: serialized.clusters.community
    },
    rootFolders: serialized.rootFolders,
    stats: serialized.stats
  }
}
