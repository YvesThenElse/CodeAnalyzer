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
import type { CodeItemNodeData, CodeItemType } from '../../types/graph.types'

type CodeItemNodeProps = NodeProps<CodeItemNodeData>

// Icon and color mapping for code item types
const codeItemStyles: Record<CodeItemType, { icon: string; color: string; bgColor: string }> = {
  function: { icon: '\u0192', color: '#3B82F6', bgColor: '#EFF6FF' },
  class: { icon: 'C', color: '#8B5CF6', bgColor: '#F5F3FF' },
  const: { icon: '=', color: '#6B7280', bgColor: '#F9FAFB' },
  react_component: { icon: '\u269B', color: '#06B6D4', bgColor: '#ECFEFF' },
  hook: { icon: '\u21A9', color: '#10B981', bgColor: '#ECFDF5' },
  type: { icon: 'T', color: '#EC4899', bgColor: '#FDF2F8' },
  interface: { icon: 'I', color: '#F59E0B', bgColor: '#FFFBEB' }
}

function CodeItemNodeComponent({ data, selected }: CodeItemNodeProps): JSX.Element {
  const { item, file } = data
  const style = codeItemStyles[item.type] || codeItemStyles.const

  return (
    <div
      className={`code-item-node ${selected ? 'code-item-node--selected' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        backgroundColor: selected ? style.bgColor : '#ffffff',
        border: `2px solid ${selected ? style.color : '#e5e7eb'}`,
        borderRadius: '6px',
        minWidth: '200px',
        maxWidth: '350px',
        boxShadow: selected ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.15s ease'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: style.color }}
      />

      {/* Type icon */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          backgroundColor: style.bgColor,
          color: style.color,
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

      {/* Name and details */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: '13px',
              color: '#1f2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {item.name}
          </span>
          {item.signature && (
            <span
              style={{
                fontSize: '11px',
                color: '#6b7280',
                fontFamily: 'monospace'
              }}
            >
              {item.signature}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '4px',
            fontSize: '10px',
            color: '#9ca3af'
          }}
        >
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
          <span>L{item.line}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: style.color }}
      />
    </div>
  )
}

export const CodeItemNode = memo(CodeItemNodeComponent)
