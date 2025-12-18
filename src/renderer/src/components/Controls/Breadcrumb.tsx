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

import React from 'react'
import { useGraphStore } from '../../store/graphStore'
import { GraphLevel } from '../../types/graph.types'

export function Breadcrumb(): JSX.Element | null {
  const {
    graph,
    currentLevel,
    selectedFileId,
    selectedFunction,
    goBackToFiles,
    goBackToCode
  } = useGraphStore()

  // Only show breadcrumb when navigating deeper than FILES
  if (!graph || currentLevel === GraphLevel.FILES) {
    return null
  }

  const file = selectedFileId ? graph.files.get(selectedFileId) : null

  const handleProjectClick = (): void => {
    goBackToFiles()
  }

  const handleFileClick = (): void => {
    if (currentLevel === GraphLevel.FUNCTION_LOGIC) {
      goBackToCode()
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
  }

  const clickableStyle: React.CSSProperties = {
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background 0.15s ease'
  }

  const separatorStyle: React.CSSProperties = {
    color: '#64748b',
    fontSize: '12px'
  }

  const currentStyle: React.CSSProperties = {
    color: '#94a3b8',
    fontWeight: 500
  }

  return (
    <div style={containerStyle}>
      {/* Project level */}
      <span
        style={clickableStyle}
        onClick={handleProjectClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#334155'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
        title="Retour aux fichiers"
      >
        <span style={{ marginRight: '6px' }}>📁</span>
        {graph.name}
      </span>

      {/* Separator */}
      <span style={separatorStyle}>›</span>

      {/* File level */}
      {file && (
        <>
          {currentLevel === GraphLevel.FUNCTION_LOGIC ? (
            <span
              style={clickableStyle}
              onClick={handleFileClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#334155'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="Retour au code"
            >
              <span style={{ marginRight: '6px' }}>📄</span>
              {file.fileName}
            </span>
          ) : (
            <span style={currentStyle}>
              <span style={{ marginRight: '6px' }}>📄</span>
              {file.fileName}
            </span>
          )}
        </>
      )}

      {/* Function level */}
      {currentLevel === GraphLevel.FUNCTION_LOGIC && selectedFunction && (
        <>
          <span style={separatorStyle}>›</span>
          <span style={currentStyle}>
            <span style={{ marginRight: '6px' }}>ƒ</span>
            {selectedFunction.name}()
          </span>
        </>
      )}
    </div>
  )
}
