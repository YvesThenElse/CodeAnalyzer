import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FileNodeData } from '../../types/graph.types'
import { getContrastingTextColor, getDarkerColor, getGradientBackground, getColorWithAlpha } from '../../utils/colorUtils'

type FileNodeProps = NodeProps<FileNodeData>

function FileNodeComponent({ data, selected }: FileNodeProps): JSX.Element {
  const { file, isPrimary, isHighlighted, importCount, dependentCount } = data

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

      <div
        className="file-node__folder"
        style={{
          fontSize: '11px',
          opacity: 0.7,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '8px'
        }}
      >
        {file.folder || '.'}
      </div>

      <div
        className="file-node__stats"
        style={{
          display: 'flex',
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
            fontSize: '10px',
            marginTop: '8px',
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
