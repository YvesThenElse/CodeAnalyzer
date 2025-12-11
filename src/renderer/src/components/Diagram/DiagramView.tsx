import React, { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useOnSelectionChange,
  type Node,
  type NodeMouseHandler
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useC4Store } from '../../store/c4Store'
import { useC4Navigation } from '../../hooks/useC4Navigation'
import { C4SystemNode } from './C4SystemNode'
import { C4ContainerNode } from './C4ContainerNode'
import { C4ComponentNode } from './C4ComponentNode'
import { C4CodeNode } from './C4CodeNode'
import { C4Edge } from './C4Edge'
import type { C4NodeData } from '../../types/c4.types'

const nodeTypes = {
  c4System: C4SystemNode,
  c4Container: C4ContainerNode,
  c4Component: C4ComponentNode,
  c4Code: C4CodeNode
}

const edgeTypes = {
  c4Edge: C4Edge
}

export function DiagramView(): JSX.Element {
  const { project, getVisibleNodesAndEdges, currentLevel, currentElementId, setSelectedNodeId } = useC4Store()
  const { drillDown, canDrillDown } = useC4Navigation()

  // Get nodes and edges from store (depends on navigation state)
  const { nodes: storeNodes, edges: storeEdges } = useMemo(
    () => getVisibleNodesAndEdges(),
    [getVisibleNodesAndEdges, project, currentLevel, currentElementId]
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

  // Handle double-click to drill down
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const nodeData = node.data as C4NodeData
      if (canDrillDown && nodeData.hasChildren) {
        drillDown(nodeData.element.id)
      }
    },
    [drillDown, canDrillDown]
  )

  // Empty state
  if (!project) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📊</div>
        <h2 className="empty-state__title">Aucun projet analysé</h2>
        <p className="empty-state__description">
          Sélectionnez un répertoire contenant un projet React pour générer un diagramme C4
          interactif.
        </p>
      </div>
    )
  }

  // Empty level state
  if (nodes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📁</div>
        <h2 className="empty-state__title">Aucun élément à ce niveau</h2>
        <p className="empty-state__description">
          Ce niveau ne contient pas d&apos;éléments. Utilisez le breadcrumb pour naviguer
          vers un autre niveau.
        </p>
      </div>
    )
  }

  return (
    <div className="diagram-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#E0E0E0" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(node: Node) => {
            const data = node.data as C4NodeData
            if (!data?.element?.type) return '#CCCCCC'
            switch (data.element.type) {
              case 'person':
                return '#08427B'
              case 'system':
                return '#1168BD'
              case 'external_system':
                return '#999999'
              case 'cloud_service':
                return '#DD8400'
              case 'container_frontend':
              case 'container_backend':
              case 'container_database':
                return '#438DD5'
              case 'component':
                return '#85BBF0'
              default:
                return '#FFFFFF'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  )
}
