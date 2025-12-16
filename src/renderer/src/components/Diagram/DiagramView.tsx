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

import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useOnSelectionChange,
  useReactFlow,
  type Node,
  type NodeMouseHandler
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useGraphStore } from '../../store/graphStore'
import { useGraphNavigation } from '../../hooks/useGraphNavigation'
import { FileNode } from './FileNode'
import { CodeItemNode } from './CodeItemNode'
import { ImportEdge } from './ImportEdge'
import { GraphLevel, type FileNodeData, type CodeItemNodeData } from '../../types/graph.types'

const nodeTypes = {
  fileNode: FileNode,
  codeItemNode: CodeItemNode
}

const edgeTypes = {
  importEdge: ImportEdge
}

export function DiagramView(): JSX.Element {
  const {
    graph,
    getVisibleNodesAndEdges,
    currentLevel,
    focusedFileId,
    selectedFileId,
    setSelectedNodeId
  } = useGraphStore()

  const {
    handleFileClick,
    handleFileDoubleClick,
    handleFileMouseEnter,
    handleFileMouseLeave
  } = useGraphNavigation()

  const { fitView, setCenter, getNode } = useReactFlow()
  const prevFocusedFileId = useRef<string | null>(null)
  const prevCurrentLevel = useRef<GraphLevel>(currentLevel)

  // Get nodes and edges from store (depends on navigation state)
  const { nodes: storeNodes, edges: storeEdges } = useMemo(
    () => getVisibleNodesAndEdges(),
    [getVisibleNodesAndEdges, graph, currentLevel, focusedFileId, selectedFileId]
  )

  // Listen to selection changes and update store
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      if (nodes.length === 1) {
        setSelectedNodeId(nodes[0].id)
      } else {
        setSelectedNodeId(null)
      }
    }
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges)

  // Update nodes/edges when store changes
  useEffect(() => {
    setNodes(storeNodes)
    setEdges(storeEdges)
  }, [storeNodes, storeEdges, setNodes, setEdges])

  // Auto-center on focused file or fit view when view changes
  useEffect(() => {
    const hasViewChanged =
      prevFocusedFileId.current !== focusedFileId ||
      prevCurrentLevel.current !== currentLevel

    if (hasViewChanged && storeNodes.length > 0) {
      // Small delay to ensure nodes are rendered
      const timeoutId = setTimeout(() => {
        if (focusedFileId && currentLevel === GraphLevel.FILES) {
          // Try to center on the focused node
          const focusedNode = getNode(focusedFileId)
          if (focusedNode && focusedNode.position) {
            setCenter(
              focusedNode.position.x + 100, // offset for node width
              focusedNode.position.y + 50,  // offset for node height
              { zoom: 1, duration: 300 }
            )
          } else {
            // Fallback to fitView
            fitView({ padding: 0.3, maxZoom: 1.5, duration: 300 })
          }
        } else {
          // Fit all nodes in view
          fitView({ padding: 0.3, maxZoom: 1.5, duration: 300 })
        }
      }, 50)

      prevFocusedFileId.current = focusedFileId
      prevCurrentLevel.current = currentLevel

      return () => clearTimeout(timeoutId)
    }
  }, [focusedFileId, currentLevel, storeNodes, fitView, setCenter, getNode])

  // Handle single click on a node
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (currentLevel === GraphLevel.FILES) {
        handleFileClick(node.id)
      }
    },
    [currentLevel, handleFileClick]
  )

  // Handle double-click to drill down
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (currentLevel === GraphLevel.FILES) {
        handleFileDoubleClick(node.id)
      }
    },
    [currentLevel, handleFileDoubleClick]
  )

  // Handle mouse enter/leave for highlighting
  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (currentLevel === GraphLevel.FILES) {
        handleFileMouseEnter(node.id)
      }
    },
    [currentLevel, handleFileMouseEnter]
  )

  const onNodeMouseLeave: NodeMouseHandler = useCallback(
    () => {
      if (currentLevel === GraphLevel.FILES) {
        handleFileMouseLeave()
      }
    },
    [currentLevel, handleFileMouseLeave]
  )

  // Empty state
  if (!graph) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📈</div>
        <h2 className="empty-state__title">Aucun projet analyse</h2>
        <p className="empty-state__description">
          Selectionnez un repertoire contenant un projet React pour visualiser
          le graphe de dependances.
        </p>
      </div>
    )
  }

  // Empty level state
  if (nodes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📁</div>
        <h2 className="empty-state__title">Aucun element a afficher</h2>
        <p className="empty-state__description">
          {currentLevel === GraphLevel.CODE
            ? 'Ce fichier ne contient pas de declarations.'
            : 'Aucun fichier trouve.'}
        </p>
      </div>
    )
  }

  return (
    <div className="diagram-view" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.5 }}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#E5E7EB" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(node: Node) => {
            if (node.type === 'fileNode') {
              const data = node.data as FileNodeData
              return data?.file?.color || '#94a3b8'
            }
            if (node.type === 'codeItemNode') {
              const data = node.data as CodeItemNodeData
              return data?.file?.color || '#94a3b8'
            }
            return '#94a3b8'
          }}
          maskColor="rgba(0, 0, 0, 0.08)"
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px'
          }}
        />
      </ReactFlow>
    </div>
  )
}
