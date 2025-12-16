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

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useGraphStore } from '../../store/graphStore'
import { useGraphNavigation } from '../../hooks/useGraphNavigation'
import type { AnalyzedGraph, FileNode } from '../../types/graph.types'
import { getDarkerColor, getGradientBackground, getColorWithAlpha } from '../../utils/colorUtils'
import './FileTreePanel.less'

interface FileTreeNode {
  name: string
  path: string
  fullPath: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  color?: string
  fileId?: string
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

function buildFileTree(graph: AnalyzedGraph | null): FileTreeNode | null {
  if (!graph) return null

  const rootPathNormalized = normalizePath(graph.rootPath)
  const projectName = rootPathNormalized.split('/').filter(Boolean).pop() || graph.name

  const root: FileTreeNode = {
    name: projectName,
    path: '',
    fullPath: graph.rootPath,
    type: 'directory',
    children: []
  }

  // Build tree from files
  for (const file of graph.files.values()) {
    const relativePath = file.relativePath
    const parts = relativePath.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const nodePath = parts.slice(0, i + 1).join('/')
      const existingChild = current.children?.find((c) => c.name === part)

      if (existingChild) {
        current = existingChild
      } else {
        const newNode: FileTreeNode = {
          name: part,
          path: nodePath,
          fullPath: file.filePath.replace(relativePath, nodePath.replace(/\//g, '\\')),
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
          color: isFile ? file.color : undefined,
          fileId: isFile ? file.id : undefined
        }
        current.children?.push(newNode)
        current = newNode
      }
    }
  }

  // Assign colors to directories based on their children
  assignDirectoryColors(root, graph)
  sortTree(root)
  return root
}

function assignDirectoryColors(node: FileTreeNode, graph: AnalyzedGraph): void {
  if (node.type === 'file' || !node.children) return

  // Process children first
  for (const child of node.children) {
    assignDirectoryColors(child, graph)
  }

  // Get color from first file child or first colored directory child
  for (const child of node.children) {
    if (child.color) {
      node.color = child.color
      break
    }
  }
}

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  expandedPaths: Set<string>
  focusedFileId: string | null
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
  onToggle,
  onFileClick,
  onFileDoubleClick,
  onContextMenu
}: FileTreeItemProps): JSX.Element {
  const isExpanded = expandedPaths.has(node.path)
  const isDirectory = node.type === 'directory'
  const isFocused = node.fileId === focusedFileId

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

  // Generate background style based on file color
  const getItemBackground = (): string | undefined => {
    if (isFocused && node.color) {
      return node.color
    }
    if (!isDirectory && node.color) {
      return getGradientBackground(node.color, 'to right')
    }
    return undefined
  }

  const itemStyle: React.CSSProperties = {
    paddingLeft: `${depth * 16 + 8}px`,
    borderLeft: node.color ? `4px solid ${node.color}` : '4px solid transparent',
    background: getItemBackground(),
    borderRadius: !isDirectory ? '4px' : undefined,
    margin: !isDirectory ? '2px 4px 2px 0' : undefined
  }

  const itemClasses = [
    'file-tree-panel__item',
    isFocused && 'file-tree-panel__item--focused',
    !isDirectory && node.color && 'file-tree-panel__item--file'
  ]
    .filter(Boolean)
    .join(' ')

  // Text color for focused items
  const nameStyle: React.CSSProperties = isFocused && node.color
    ? { color: '#ffffff', fontWeight: 600 }
    : {}

  return (
    <>
      <div
        className={itemClasses}
        style={itemStyle}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="file-tree-panel__toggle">
          {isDirectory ? (isExpanded ? '\u25BC' : '\u25B6') : ''}
        </span>
        <span className="file-tree-panel__icon">
          {isDirectory ? '📁' : '📄'}
        </span>
        <span className="file-tree-panel__name" style={nameStyle} title={node.name}>
          {node.name}
        </span>
        {isFocused && (
          <span className="file-tree-panel__badge">principal</span>
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
  const { graph, focusedFileId } = useGraphStore()
  const { focusOnFile } = useGraphNavigation()
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const fileTree = useMemo(() => buildFileTree(graph), [graph])

  // Auto-expand to show focused file
  useEffect(() => {
    if (focusedFileId && graph) {
      const file = graph.files.get(focusedFileId)
      if (file) {
        const parents = getParentPaths(file.relativePath)
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
    }
  }, [focusedFileId, graph])

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

  if (!graph) {
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
          onToggle={handleToggle}
          onFileClick={handleFileClick}
          onFileDoubleClick={handleFileDoubleClick}
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
