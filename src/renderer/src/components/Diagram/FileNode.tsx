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
import type { FileNodeData } from '../../types/graph.types'
import { getContrastingTextColor, getDarkerColor, getGradientBackground, getColorWithAlpha } from '../../utils/colorUtils'
import { useGraphStore } from '../../store/graphStore'

type FileNodeProps = NodeProps<FileNodeData>

function FileNodeComponent({ data, selected }: FileNodeProps): JSX.Element {
  const { file, isPrimary, isHighlighted, importCount, dependentCount } = data
  const description = useGraphStore((state) => state.descriptions[file.relativePath])

  const borderColor = getDarkerColor(file.color, 10)
  const textColor = getContrastingTextColor(file.color)

  // Generate gradient background for non-primary nodes
  const gradientBg = getGradientBackground(file.color, 'to bottom')
  const accentColor = getColorWithAlpha(file.color, 0.15)

  // Icon based on file type
  const getFileIcon = (): string => {
    switch (file.type) {
      case 'index_file':
        return '📁' // folder emoji
      case 'test_file':
        return '🧪' // test tube emoji
      case 'config_file':
        return '⚙️' // gear emoji
      default:
        return '📄' // document emoji
    }
  }

  // Background style based on state
  const getBackgroundStyle = (): string => {
    if (isPrimary) {
      return file.color
    }
    return gradientBg
  }

  return (
    <div
      className={`file-node ${isPrimary ? 'file-node--primary' : ''} ${isHighlighted ? 'file-node--highlighted' : ''} ${selected ? 'file-node--selected' : ''}`}
      style={{
        borderColor: borderColor,
        borderWidth: isPrimary ? '3px' : '2px',
        borderStyle: 'solid',
        borderRadius: '10px',
        padding: '12px 16px',
        background: getBackgroundStyle(),
        borderLeftWidth: isPrimary ? '3px' : '4px',
        borderLeftColor: file.color,
        color: isPrimary ? textColor : '#1f2937',
        minWidth: '180px',
        maxWidth: '250px',
        boxShadow: isPrimary
          ? `0 4px 16px ${getColorWithAlpha(file.color, 0.3)}`
          : isHighlighted
            ? `0 3px 12px ${getColorWithAlpha(file.color, 0.2)}`
            : `0 2px 6px ${getColorWithAlpha(file.color, 0.1)}`,
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: borderColor }}
      />

      <div className="file-node__header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '14px' }}>{getFileIcon()}</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {file.fileName}
        </span>
      </div>

      {description?.short && (
        <div
          className="file-node__description"
          style={{
            fontSize: '14px',
            color: '#1f2937',
            marginBottom: '6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.3',
            fontWeight: 500
          }}
          title={description.short}
        >
          {description.short}
        </div>
      )}

      <div
        className="file-node__stats"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          fontSize: '11px',
          opacity: 0.85
        }}
      >
        <span
          title={`Imports: ${importCount}\nCe fichier importe ${importCount} autre(s) fichier(s) du projet`}
          style={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: '3px' }}
        >
          <span style={{ fontSize: '13px' }}>→</span> {importCount}
        </span>
        <span
          title={`Dépendants: ${dependentCount}\n${dependentCount} fichier(s) importent ce fichier`}
          style={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: '3px' }}
        >
          <span style={{ fontSize: '13px' }}>←</span> {dependentCount}
        </span>
        <span
          title={`Déclarations: ${file.codeItems.length}\nFonctions, classes, composants, hooks, types... exportés ou non`}
          style={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: '3px' }}
        >
          <span>📝</span> {file.codeItems.length}
        </span>
      </div>

      {isPrimary && (
        <div
          className="file-node__hint"
          style={{
            fontSize: '9px',
            marginTop: '4px',
            opacity: 0.6,
            textAlign: 'center'
          }}
        >
          Double-clic pour voir le code
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor }}
      />
    </div>
  )
}

export const FileNode = memo(FileNodeComponent)
