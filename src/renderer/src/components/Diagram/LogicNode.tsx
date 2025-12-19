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

import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { LogicNodeData } from '../../types/graph.types'
import { LogicNodeType } from '../../types/graph.types'

type LogicNodeProps = NodeProps<LogicNodeData>

// Color scheme for different node types
const NODE_STYLES: Record<LogicNodeType, {
  background: string
  border: string
  color: string
  icon: string
  shape: 'rounded' | 'diamond' | 'pill' | 'rectangle'
}> = {
  [LogicNodeType.ENTRY]: {
    background: '#22c55e',
    border: '#16a34a',
    color: '#ffffff',
    icon: '▶',
    shape: 'pill'
  },
  [LogicNodeType.EXIT]: {
    background: '#64748b',
    border: '#475569',
    color: '#ffffff',
    icon: '■',
    shape: 'pill'
  },
  [LogicNodeType.DECISION]: {
    background: '#f59e0b',
    border: '#d97706',
    color: '#ffffff',
    icon: '◇',
    shape: 'diamond'
  },
  [LogicNodeType.PROCESS]: {
    background: '#3b82f6',
    border: '#2563eb',
    color: '#ffffff',
    icon: '▪',
    shape: 'rectangle'
  },
  [LogicNodeType.LOOP]: {
    background: '#8b5cf6',
    border: '#7c3aed',
    color: '#ffffff',
    icon: '↻',
    shape: 'rectangle'
  },
  [LogicNodeType.RETURN]: {
    background: '#10b981',
    border: '#059669',
    color: '#ffffff',
    icon: '←',
    shape: 'rounded'
  },
  [LogicNodeType.CALL]: {
    background: '#06b6d4',
    border: '#0891b2',
    color: '#ffffff',
    icon: 'ƒ',
    shape: 'rectangle'
  },
  [LogicNodeType.EXCEPTION]: {
    background: '#ef4444',
    border: '#dc2626',
    color: '#ffffff',
    icon: '⚠',
    shape: 'rounded'
  }
}

function LogicNodeComponent({ data, selected }: LogicNodeProps): JSX.Element {
  const { node } = data
  const style = NODE_STYLES[node.type] || NODE_STYLES[LogicNodeType.PROCESS]

  // Check if this is a merge/utility node (labels like "(merge)", "(loop exit)", etc.)
  const isMergeNode = node.label.startsWith('(') && node.label.endsWith(')')

  // Render simplified dot for merge nodes
  if (isMergeNode) {
    return (
      <div
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#94a3b8',
          border: '2px solid #64748b',
          boxShadow: selected ? '0 0 0 2px #3b82f6' : '0 1px 3px rgba(0, 0, 0, 0.2)',
          cursor: 'default'
        }}
        title={node.label}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: '#64748b', width: '6px', height: '6px' }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: '#64748b', width: '6px', height: '6px' }}
        />
      </div>
    )
  }

  // Base styles for different shapes
  const getShapeStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      background: style.background,
      border: `2px solid ${style.border}`,
      color: style.color,
      padding: '10px 16px',
      minWidth: '140px',
      maxWidth: '220px',
      textAlign: 'center',
      boxShadow: selected
        ? `0 4px 12px rgba(0, 0, 0, 0.25)`
        : `0 2px 8px rgba(0, 0, 0, 0.15)`,
      transition: 'all 0.2s ease',
      cursor: 'default'
    }

    switch (style.shape) {
      case 'pill':
        return { ...base, borderRadius: '20px' }
      case 'diamond':
        return {
          ...base,
          borderRadius: '4px',
          transform: 'rotate(45deg)',
          minWidth: '80px',
          maxWidth: '80px',
          minHeight: '80px',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      case 'rounded':
        return { ...base, borderRadius: '12px' }
      case 'rectangle':
      default:
        return { ...base, borderRadius: '6px' }
    }
  }

  // Content wrapper for diamond shape
  const getContentStyles = (): React.CSSProperties => {
    if (style.shape === 'diamond') {
      return {
        transform: 'rotate(-45deg)',
        fontSize: '11px',
        lineHeight: '1.2',
        padding: '4px'
      }
    }
    return {}
  }

  return (
    <div style={getShapeStyles()}>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: style.border,
          transform: style.shape === 'diamond' ? 'rotate(-45deg)' : undefined
        }}
      />

      <div style={getContentStyles()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: style.shape === 'diamond' ? '0' : '4px'
          }}
        >
          <span style={{ fontSize: '14px' }}>{style.icon}</span>
          {style.shape !== 'diamond' && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {node.label}
            </span>
          )}
        </div>

        {style.shape === 'diamond' && (
          <div
            style={{
              fontSize: '10px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '70px'
            }}
            title={node.label}
          >
            {node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label}
          </div>
        )}

        {node.code && style.shape !== 'diamond' && (
          <div
            style={{
              fontSize: '10px',
              opacity: 0.9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace'
            }}
            title={node.code}
          >
            {node.code.length > 30 ? node.code.substring(0, 30) + '...' : node.code}
          </div>
        )}

        {node.line && style.shape !== 'diamond' && (
          <div
            style={{
              fontSize: '9px',
              opacity: 0.7,
              marginTop: '2px'
            }}
          >
            ligne {node.line}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: style.border,
          transform: style.shape === 'diamond' ? 'rotate(-45deg)' : undefined
        }}
      />
    </div>
  )
}

export const LogicNode = memo(LogicNodeComponent)
