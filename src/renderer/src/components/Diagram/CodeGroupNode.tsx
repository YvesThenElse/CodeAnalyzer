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

import React, { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CodeGroupNodeData, CodeItemType, CodeItem } from '../../types/graph.types'
import { useGraphStore } from '../../store/graphStore'

type CodeGroupNodeProps = NodeProps<CodeGroupNodeData>

// Icon, color, and label mapping for code item types
const codeGroupStyles: Record<CodeItemType, { icon: string; color: string; bgColor: string; label: string }> = {
  function: { icon: '\u0192', color: '#3B82F6', bgColor: '#EFF6FF', label: 'Functions' },
  class: { icon: 'C', color: '#8B5CF6', bgColor: '#F5F3FF', label: 'Classes' },
  const: { icon: '=', color: '#6B7280', bgColor: '#F9FAFB', label: 'Constants' },
  react_component: { icon: '\u269B', color: '#06B6D4', bgColor: '#ECFEFF', label: 'React Components' },
  hook: { icon: '\u21A9', color: '#10B981', bgColor: '#ECFDF5', label: 'Hooks' },
  type: { icon: 'T', color: '#EC4899', bgColor: '#FDF2F8', label: 'Types' },
  interface: { icon: 'I', color: '#F59E0B', bgColor: '#FFFBEB', label: 'Interfaces' }
}

function CodeGroupNodeComponent({ data }: CodeGroupNodeProps): JSX.Element {
  const { type, items, isCollapsed } = data
  const toggleCodeGroup = useGraphStore((state) => state.toggleCodeGroup)
  const style = codeGroupStyles[type] || codeGroupStyles.const

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleCodeGroup(type)
    },
    [type, toggleCodeGroup]
  )

  const renderItem = (item: CodeItem): JSX.Element => (
    <div
      key={item.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderBottom: '1px solid #f3f4f6',
        backgroundColor: '#ffffff'
      }}
    >
      <span
        style={{
          fontWeight: 500,
          fontSize: '12px',
          color: '#1f2937',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {item.name}
        {item.signature && (
          <span style={{ color: '#9ca3af', fontFamily: 'monospace', marginLeft: '4px' }}>
            {item.signature}
          </span>
        )}
      </span>
      <div style={{ display: 'flex', gap: '4px', fontSize: '9px' }}>
        {item.isExported && (
          <span
            style={{
              padding: '1px 4px',
              backgroundColor: '#DEF7EC',
              color: '#046C4E',
              borderRadius: '3px'
            }}
          >
            export
          </span>
        )}
        {item.isDefault && (
          <span
            style={{
              padding: '1px 4px',
              backgroundColor: '#E1EFFE',
              color: '#1E40AF',
              borderRadius: '3px'
            }}
          >
            default
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div
      className="code-group-node"
      style={{
        minWidth: '280px',
        maxWidth: '400px',
        backgroundColor: '#ffffff',
        border: `2px solid ${style.color}`,
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: style.color }} />

      {/* Header */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          backgroundColor: style.bgColor,
          borderBottom: isCollapsed ? 'none' : `1px solid ${style.color}20`,
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        {/* Type icon */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: style.color,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '14px',
            flexShrink: 0
          }}
        >
          {style.icon}
        </div>

        {/* Label and count */}
        <div style={{ flex: 1 }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: '#1f2937'
            }}
          >
            {style.label}
          </span>
          <span
            style={{
              marginLeft: '8px',
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: 500
            }}
          >
            ({items.length})
          </span>
        </div>

        {/* Expand/collapse button */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: style.color + '20',
            color: style.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
            transition: 'transform 0.2s ease',
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
          }}
        >
          ▼
        </div>
      </div>

      {/* Items list (when expanded) */}
      {!isCollapsed && (
        <div
          style={{
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {items.map(renderItem)}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: style.color }} />
    </div>
  )
}

export const CodeGroupNode = memo(CodeGroupNodeComponent)
