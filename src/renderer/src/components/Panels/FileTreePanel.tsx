import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useC4Store } from '../../store/c4Store'
import type { AnalyzedProject } from '../../types/c4.types'
import './FileTreePanel.less'

interface FileTreeNode {
  name: string
  path: string // Relative path normalized with /
  fullPath: string // Absolute path with system separators
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

interface ContextMenuState {
  x: number
  y: number
  path: string
  isDirectory: boolean
}

// Normalize path to use forward slashes for comparison
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

// Get all parent paths for a file path
function getParentPaths(filePath: string): string[] {
  const parts = filePath.split('/').filter(Boolean)
  const paths: string[] = [''] // Root
  let current = ''
  for (let i = 0; i < parts.length - 1; i++) {
    current = current ? `${current}/${parts[i]}` : parts[i]
    paths.push(current)
  }
  return paths
}

function sortTree(node: FileTreeNode): void {
  if (!node.children) return

  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  for (const child of node.children) {
    sortTree(child)
  }
}

function buildFileTree(project: AnalyzedProject | null): FileTreeNode | null {
  if (!project) return null

  // Normalize root path for comparison
  const rootPathNormalized = normalizePath(project.rootPath)
  const projectName = rootPathNormalized.split('/').filter(Boolean).pop() || project.name

  // Collect all unique file paths and make them relative to rootPath
  const filePaths = new Set<string>()
  for (const level of Object.values(project.levels)) {
    for (const el of level) {
      if (el.metadata?.filePath) {
        let path = normalizePath(el.metadata.filePath)
        // Remove rootPath prefix if present (make relative)
        if (path.toLowerCase().startsWith(rootPathNormalized.toLowerCase())) {
          path = path.slice(rootPathNormalized.length)
          // Remove leading slash
          if (path.startsWith('/')) {
            path = path.slice(1)
          }
        }
        if (path) {
          filePaths.add(path)
        }
      }
    }
  }

  if (filePaths.size === 0) return null

  // Build the tree
  const root: FileTreeNode = {
    name: projectName,
    path: '',
    fullPath: project.rootPath,
    type: 'directory',
    children: []
  }

  for (const filePath of filePaths) {
    const parts = filePath.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const relativePath = parts.slice(0, i + 1).join('/')
      const existingChild = current.children?.find((c) => c.name === part)

      if (existingChild) {
        current = existingChild
      } else {
        const newNode: FileTreeNode = {
          name: part,
          path: relativePath,
          fullPath: `${project.rootPath}\\${relativePath.replace(/\//g, '\\')}`,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : []
        }
        current.children?.push(newNode)
        current = newNode
      }
    }
  }

  sortTree(root)
  return root
}

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  expandedPaths: Set<string>
  visibleFiles: Set<string>
  selectedFile: string | null
  onToggle: (path: string) => void
  onDoubleClick: (fullPath: string) => void
  onContextMenu: (e: React.MouseEvent, fullPath: string, isDirectory: boolean) => void
}

function FileTreeItem({
  node,
  depth,
  expandedPaths,
  visibleFiles,
  selectedFile,
  onToggle,
  onDoubleClick,
  onContextMenu
}: FileTreeItemProps): JSX.Element {
  const isExpanded = expandedPaths.has(node.path)
  const isDirectory = node.type === 'directory'
  const isVisible = visibleFiles.has(node.path)
  const isSelected = selectedFile === node.path

  const handleClick = useCallback(() => {
    if (isDirectory) {
      onToggle(node.path)
    }
  }, [isDirectory, node.path, onToggle])

  const handleDoubleClick = useCallback(() => {
    if (!isDirectory) {
      onDoubleClick(node.fullPath)
    }
  }, [isDirectory, node.fullPath, onDoubleClick])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onContextMenu(e, node.fullPath, isDirectory)
    },
    [node.fullPath, isDirectory, onContextMenu]
  )

  const itemClasses = [
    'file-tree-panel__item',
    isVisible && 'file-tree-panel__item--visible',
    isSelected && 'file-tree-panel__item--selected'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={itemClasses}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="file-tree-panel__toggle">
          {isDirectory ? (isExpanded ? '▼' : '▶') : ''}
        </span>
        <span className="file-tree-panel__icon">{isDirectory ? '📁' : '📄'}</span>
        <span className="file-tree-panel__name" title={node.name}>
          {node.name}
        </span>
        {(isVisible || isSelected) && (
          <span
            className={`file-tree-panel__indicator ${isSelected ? 'file-tree-panel__indicator--selected' : 'file-tree-panel__indicator--visible'}`}
          />
        )}
      </div>
      {isDirectory && isExpanded && node.children && (
        <div className="file-tree-panel__children">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              visibleFiles={visibleFiles}
              selectedFile={selectedFile}
              onToggle={onToggle}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function FileTreePanel(): JSX.Element | null {
  const { project, getVisibleFilePaths, getSelectedFilePath, currentLevel, currentElementId, selectedNodeId } =
    useC4Store()
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Build the file tree
  const fileTree = useMemo(() => buildFileTree(project), [project])

  // Get root path normalized for stripping
  const rootPathNormalized = useMemo(
    () => (project ? normalizePath(project.rootPath) : ''),
    [project]
  )

  // Helper to make path relative to project root
  const makeRelative = useCallback(
    (path: string): string => {
      const normalized = normalizePath(path)
      if (rootPathNormalized && normalized.toLowerCase().startsWith(rootPathNormalized.toLowerCase())) {
        let relative = normalized.slice(rootPathNormalized.length)
        if (relative.startsWith('/')) {
          relative = relative.slice(1)
        }
        return relative
      }
      return normalized
    },
    [rootPathNormalized]
  )

  // Get visible files (relative paths)
  const visibleFiles = useMemo(() => {
    const rawPaths = getVisibleFilePaths()
    const relative = new Set<string>()
    rawPaths.forEach((p) => relative.add(makeRelative(p)))
    return relative
  }, [getVisibleFilePaths, currentLevel, currentElementId, makeRelative])

  // Get selected file (relative path)
  const selectedFile = useMemo(() => {
    const path = getSelectedFilePath()
    return path ? makeRelative(path) : null
  }, [getSelectedFilePath, selectedNodeId, makeRelative])

  // Auto-expand folders containing visible files
  useEffect(() => {
    if (visibleFiles.size > 0) {
      const newExpanded = new Set(expandedPaths)
      newExpanded.add('') // Root always expanded

      visibleFiles.forEach((filePath) => {
        const parents = getParentPaths(filePath)
        parents.forEach((p) => newExpanded.add(p))
      })

      // Only update if there are new paths to expand
      if (newExpanded.size > expandedPaths.size) {
        setExpandedPaths(newExpanded)
      }
    }
  }, [visibleFiles])

  // Auto-expand to show selected file
  useEffect(() => {
    if (selectedFile) {
      const parents = getParentPaths(selectedFile)
      const newExpanded = new Set(expandedPaths)
      let hasNew = false

      parents.forEach((p) => {
        if (!newExpanded.has(p)) {
          newExpanded.add(p)
          hasNew = true
        }
      })

      if (hasNew) {
        setExpandedPaths(newExpanded)
      }
    }
  }, [selectedFile])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (): void => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleDoubleClick = useCallback((fullPath: string) => {
    window.electronAPI.openFile(fullPath)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, fullPath: string, isDirectory: boolean) => {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        path: fullPath,
        isDirectory
      })
    },
    []
  )

  const handleOpenFile = useCallback(() => {
    if (contextMenu) {
      window.electronAPI.openFile(contextMenu.path)
      setContextMenu(null)
    }
  }, [contextMenu])

  const handleOpenFolder = useCallback(() => {
    if (contextMenu) {
      window.electronAPI.openFolder(contextMenu.path)
      setContextMenu(null)
    }
  }, [contextMenu])

  if (!project) {
    return (
      <aside className="file-tree-panel">
        <header className="file-tree-panel__header">Arborescence</header>
        <div className="file-tree-panel__empty">Aucun projet analyse</div>
      </aside>
    )
  }

  if (!fileTree) {
    return (
      <aside className="file-tree-panel">
        <header className="file-tree-panel__header">Arborescence</header>
        <div className="file-tree-panel__empty">Aucun fichier detecte</div>
      </aside>
    )
  }

  return (
    <aside className="file-tree-panel">
      <header className="file-tree-panel__header">Arborescence</header>
      <div className="file-tree-panel__content">
        <FileTreeItem
          node={fileTree}
          depth={0}
          expandedPaths={expandedPaths}
          visibleFiles={visibleFiles}
          selectedFile={selectedFile}
          onToggle={handleToggle}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        />
      </div>

      {contextMenu && (
        <div
          className="file-tree-panel__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {!contextMenu.isDirectory && (
            <button onClick={handleOpenFile}>Ouvrir le fichier</button>
          )}
          <button onClick={handleOpenFolder}>Ouvrir le dossier</button>
        </div>
      )}
    </aside>
  )
}
