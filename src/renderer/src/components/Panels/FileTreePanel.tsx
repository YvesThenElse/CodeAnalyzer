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

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useGraphStore } from '../../store/graphStore'
import { useGraphNavigation } from '../../hooks/useGraphNavigation'
import type { AnalyzedGraph } from '../../types/graph.types'
import { getFolderBackgroundColor } from '../../utils/colorUtils'
import './FileTreePanel.less'

// Resize constants
const PANEL_MIN_WIDTH = 200
const PANEL_MAX_WIDTH = 500
const PANEL_DEFAULT_WIDTH = 280
const STORAGE_KEY = 'fileTreePanelWidth'

// Ancestor bar dimensions
const ANCESTOR_BAR_WIDTH = 4
const ANCESTOR_BAR_GAP = 2

interface FileTreeNode {
  name: string
  path: string
  fullPath: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  color?: string
  fileId?: string
  depth: number
  ancestorColors: string[]
}

interface ContextMenuState {
  x: number
  y: number
  path: string
  isDirectory: boolean
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function getParentPaths(filePath: string): string[] {
  const parts = filePath.split('/').filter(Boolean)
  const paths: string[] = ['']
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

function buildFileTree(
  graph: AnalyzedGraph | null,
  folderColors: Map<string, string>
): FileTreeNode | null {
  if (!graph) return null

  const rootPathNormalized = normalizePath(graph.rootPath)
  const projectName = rootPathNormalized.split('/').filter(Boolean).pop() || graph.name

  const root: FileTreeNode = {
    name: projectName,
    path: '',
    fullPath: graph.rootPath,
    type: 'directory',
    children: [],
    depth: 0,
    ancestorColors: [],
    color: undefined
  }

  // Build tree from files
  for (const file of graph.files.values()) {
    const relativePath = file.relativePath
    const parts = relativePath.split('/').filter(Boolean)
    let current = root
    const ancestorColorStack: string[] = []

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const nodePath = parts.slice(0, i + 1).join('/')
      const existingChild = current.children?.find((c) => c.name === part)

      if (existingChild) {
        // Add existing directory's color to ancestor stack
        if (existingChild.color && existingChild.type === 'directory') {
          ancestorColorStack.push(existingChild.color)
        }
        current = existingChild
      } else {
        // Get color from the centralized folderColors map
        let nodeColor: string | undefined
        if (!isFile) {
          // Directory: get color from store's folderColors
          nodeColor = folderColors.get(nodePath)
        } else {
          // File: inherit parent directory's color
          nodeColor = current.color
        }

        const newNode: FileTreeNode = {
          name: part,
          path: nodePath,
          fullPath: file.filePath.replace(relativePath, nodePath.replace(/\//g, '\\')),
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
          color: nodeColor,
          fileId: isFile ? file.id : undefined,
          depth: i,
          ancestorColors: [...ancestorColorStack]
        }
        current.children?.push(newNode)

        // Add this directory's color to ancestor stack for its children
        if (!isFile && nodeColor) {
          ancestorColorStack.push(nodeColor)
        }

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
  focusedFileId: string | null
  hoveredFileId: string | null
  visibleFilesInfo: Map<string, 'primary' | 'import' | 'usedBy'>
  onToggle: (path: string) => void
  onFileClick: (fileId: string) => void
  onFileDoubleClick: (fullPath: string) => void
  onContextMenu: (e: React.MouseEvent, fullPath: string, isDirectory: boolean) => void
}

function FileTreeItem({
  node,
  depth,
  expandedPaths,
  focusedFileId,
  hoveredFileId,
  visibleFilesInfo,
  onToggle,
  onFileClick,
  onFileDoubleClick,
  onContextMenu
}: FileTreeItemProps): JSX.Element {
  const isExpanded = expandedPaths.has(node.path)
  const isDirectory = node.type === 'directory'
  const isFocused = node.fileId === focusedFileId
  const isHovered = node.fileId === hoveredFileId
  const fileRelation = node.fileId ? visibleFilesInfo.get(node.fileId) : undefined

  const handleClick = useCallback(() => {
    if (isDirectory) {
      onToggle(node.path)
    } else if (node.fileId) {
      onFileClick(node.fileId)
    }
  }, [isDirectory, node.path, node.fileId, onToggle, onFileClick])

  const handleDoubleClick = useCallback(() => {
    if (!isDirectory) {
      onFileDoubleClick(node.fullPath)
    }
  }, [isDirectory, node.fullPath, onFileDoubleClick])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onContextMenu(e, node.fullPath, isDirectory)
    },
    [node.fullPath, isDirectory, onContextMenu]
  )

  // Calculate space needed for ancestor bars (last bar is double width)
  const extraLastBarWidth = node.ancestorColors.length > 0 ? ANCESTOR_BAR_WIDTH : 0
  const ancestorBarsWidth = node.ancestorColors.length * (ANCESTOR_BAR_WIDTH + ANCESTOR_BAR_GAP) + extraLastBarWidth
  const baseIndent = 8
  const toggleWidth = 16

  // Generate background style based on node color
  const getItemBackground = (): string | undefined => {
    if (isFocused && node.color) {
      return node.color
    }
    if (node.color) {
      // Both files and directories get a light background
      return getFolderBackgroundColor(node.color)
    }
    return undefined
  }

  const itemStyle: React.CSSProperties = {
    paddingLeft: `${baseIndent + ancestorBarsWidth + toggleWidth}px`,
    background: getItemBackground(),
    borderRadius: '4px',
    margin: '1px 4px 1px 0',
    position: 'relative'
  }

  const itemClasses = [
    'file-tree-panel__item',
    isFocused && 'file-tree-panel__item--focused',
    isHovered && 'file-tree-panel__item--hovered',
    isDirectory ? 'file-tree-panel__item--directory' : 'file-tree-panel__item--file'
  ]
    .filter(Boolean)
    .join(' ')

  // Text color for focused items
  const nameStyle: React.CSSProperties = isFocused && node.color
    ? { color: '#ffffff', fontWeight: 600 }
    : {}

  // Render ancestor color bars
  const renderAncestorBars = (): JSX.Element | null => {
    if (node.ancestorColors.length === 0) return null

    return (
      <div
        className="file-tree-panel__ancestor-bars"
        style={{ left: `${baseIndent}px` }}
      >
        {node.ancestorColors.map((color, index) => {
          const isLast = index === node.ancestorColors.length - 1
          const barWidth = isLast ? ANCESTOR_BAR_WIDTH * 2 : ANCESTOR_BAR_WIDTH
          return (
            <div
              key={`${node.path}-ancestor-${index}`}
              className="file-tree-panel__ancestor-bar"
              style={{
                backgroundColor: color,
                left: `${index * (ANCESTOR_BAR_WIDTH + ANCESTOR_BAR_GAP)}px`,
                width: `${barWidth}px`
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div
        className={itemClasses}
        style={itemStyle}
        data-file-id={node.fileId}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {renderAncestorBars()}
        <span className="file-tree-panel__toggle">
          {isDirectory ? (isExpanded ? '\u25BC' : '\u25B6') : ''}
        </span>
        <span className="file-tree-panel__icon">
          {isDirectory ? '📁' : '📄'}
        </span>
        <span className="file-tree-panel__name" style={nameStyle} title={node.name}>
          {node.name}
        </span>
        {fileRelation === 'primary' && (
          <span className="file-tree-panel__badge file-tree-panel__badge--primary">principal</span>
        )}
        {fileRelation === 'import' && (
          <span className="file-tree-panel__badge file-tree-panel__badge--import">import</span>
        )}
        {fileRelation === 'usedBy' && (
          <span className="file-tree-panel__badge file-tree-panel__badge--usedby">used by</span>
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
              focusedFileId={focusedFileId}
              hoveredFileId={hoveredFileId}
              visibleFilesInfo={visibleFilesInfo}
              onToggle={onToggle}
              onFileClick={onFileClick}
              onFileDoubleClick={onFileDoubleClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function FileTreePanel(): JSX.Element | null {
  const { graph, focusedFileId, hoveredFileId, folderColors } = useGraphStore()
  const getVisibleFilesInfo = useGraphStore((state) => state.getVisibleFilesInfo)
  const { focusOnFile } = useGraphNavigation()

  // Get visible files info (primary, import, usedBy)
  const visibleFilesInfo = useMemo(() => getVisibleFilesInfo(), [getVisibleFilesInfo, focusedFileId])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Resize state
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, parseInt(stored, 10))) : PANEL_DEFAULT_WIDTH
  })
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  // Persist width to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(panelWidth))
  }, [panelWidth])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent): void => {
      const newWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, e.clientX))
      setPanelWidth(newWidth)
    }

    const handleMouseUp = (): void => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const fileTree = useMemo(() => buildFileTree(graph, folderColors), [graph, folderColors])

  // Auto-expand to show all visible files (focused + imports + usedBy)
  useEffect(() => {
    if (graph && visibleFilesInfo.size > 0) {
      const newExpanded = new Set(expandedPaths)
      let hasNew = false

      for (const fileId of visibleFilesInfo.keys()) {
        const file = graph.files.get(fileId)
        if (file) {
          const parents = getParentPaths(file.relativePath)
          parents.forEach((p) => {
            if (!newExpanded.has(p)) {
              newExpanded.add(p)
              hasNew = true
            }
          })
        }
      }

      if (hasNew) {
        setExpandedPaths(newExpanded)
      }
    }
  }, [focusedFileId, graph, visibleFilesInfo])

  useEffect(() => {
    const handleClick = (): void => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  // Auto-scroll vers le fichier survolé dans le diagramme
  useEffect(() => {
    if (hoveredFileId) {
      const element = document.querySelector(`[data-file-id="${hoveredFileId}"]`)
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }, [hoveredFileId])

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

  const handleFileClick = useCallback(
    (fileId: string) => {
      focusOnFile(fileId)
    },
    [focusOnFile]
  )

  const handleFileDoubleClick = useCallback((fullPath: string) => {
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

  const panelClassName = `file-tree-panel${isResizing ? ' file-tree-panel--resizing' : ''}`

  if (!graph) {
    return (
      <aside
        ref={panelRef}
        className={panelClassName}
        style={{ width: `${panelWidth}px` }}
      >
        <header className="file-tree-panel__header">Arborescence</header>
        <div className="file-tree-panel__empty">Aucun projet analyse</div>
        <div className="file-tree-panel__resize-handle" onMouseDown={handleResizeStart} />
      </aside>
    )
  }

  if (!fileTree) {
    return (
      <aside
        ref={panelRef}
        className={panelClassName}
        style={{ width: `${panelWidth}px` }}
      >
        <header className="file-tree-panel__header">Arborescence</header>
        <div className="file-tree-panel__empty">Aucun fichier detecte</div>
        <div className="file-tree-panel__resize-handle" onMouseDown={handleResizeStart} />
      </aside>
    )
  }

  return (
    <aside
      ref={panelRef}
      className={panelClassName}
      style={{ width: `${panelWidth}px` }}
    >
      <header className="file-tree-panel__header">
        Arborescence
        <span className="file-tree-panel__count">{graph.files.size} fichiers</span>
      </header>
      <div className="file-tree-panel__content">
        <FileTreeItem
          node={fileTree}
          depth={0}
          expandedPaths={expandedPaths}
          focusedFileId={focusedFileId}
          hoveredFileId={hoveredFileId}
          visibleFilesInfo={visibleFilesInfo}
          onToggle={handleToggle}
          onFileClick={handleFileClick}
          onFileDoubleClick={handleFileDoubleClick}
          onContextMenu={handleContextMenu}
        />
      </div>

      <div className="file-tree-panel__resize-handle" onMouseDown={handleResizeStart} />

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
