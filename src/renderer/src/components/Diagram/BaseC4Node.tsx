import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { C4NodeData, C4NodeType } from '../../types/c4.types'

interface NodeColors {
  backgroundColor: string
  borderColor: string
  textColor: string
}

// C4 color mapping according to spec
const nodeColors: Record<C4NodeType, NodeColors> = {
  person: { backgroundColor: '#08427B', borderColor: '#052E56', textColor: '#FFFFFF' },
  system: { backgroundColor: '#1168BD', borderColor: '#0B4884', textColor: '#FFFFFF' },
  external_system: { backgroundColor: '#999999', borderColor: '#6B6B6B', textColor: '#FFFFFF' },
  cloud_service: { backgroundColor: '#DD8400', borderColor: '#B36D00', textColor: '#FFFFFF' },
  container_frontend: { backgroundColor: '#438DD5', borderColor: '#2E6295', textColor: '#FFFFFF' },
  container_backend: { backgroundColor: '#438DD5', borderColor: '#2E6295', textColor: '#FFFFFF' },
  container_database: { backgroundColor: '#438DD5', borderColor: '#2E6295', textColor: '#FFFFFF' },
  component: { backgroundColor: '#85BBF0', borderColor: '#5A9BD5', textColor: '#000000' },
  code_function: { backgroundColor: '#FFFFFF', borderColor: '#CCCCCC', textColor: '#000000' },
  code_component: { backgroundColor: '#FFFFFF', borderColor: '#CCCCCC', textColor: '#000000' },
  code_hook: { backgroundColor: '#FFFFFF', borderColor: '#CCCCCC', textColor: '#000000' }
}

export function getNodeColors(type: C4NodeType): NodeColors {
  return nodeColors[type] || nodeColors.system
}

interface BaseC4NodeProps {
  data: C4NodeData
  selected?: boolean
}

export function BaseC4Node({ data, selected }: BaseC4NodeProps): JSX.Element {
  const { element, hasChildren } = data
  const colors = getNodeColors(element.type)

  return (
    <div
      className={`c4-node c4-node--${element.type} ${selected ? 'selected' : ''}`}
      style={{
        backgroundColor: colors.backgroundColor,
        borderColor: colors.borderColor,
        color: colors.textColor
      }}
    >
      <Handle type="target" position={Position.Top} />

      <div className="c4-node__content">
        <h3 className="c4-node__title">{element.name}</h3>
        <p className="c4-node__description">{element.description}</p>
        {hasChildren && (
          <span className="c4-node__indicator">Double-clic pour explorer</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
