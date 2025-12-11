import React from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { ImportEdgeData } from '../../types/graph.types'

type ImportEdgeProps = EdgeProps<ImportEdgeData>

export function ImportEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected
}: ImportEdgeProps): JSX.Element {
  const isHighlighted = data?.isHighlighted || false

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  })

  const strokeColor = isHighlighted || selected ? '#3B82F6' : '#94a3b8'
  const strokeWidth = isHighlighted || selected ? 2 : 1.5

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease'
        }}
        markerEnd="url(#import-arrow)"
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: '10px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              backgroundColor: isHighlighted || selected ? '#EFF6FF' : '#f8fafc',
              border: `1px solid ${isHighlighted || selected ? '#3B82F6' : '#e2e8f0'}`,
              borderRadius: '4px',
              color: '#475569',
              pointerEvents: 'all',
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Arrow marker definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker
            id="import-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerUnits="strokeWidth"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
          </marker>
        </defs>
      </svg>
    </>
  )
}
