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
import { useGraphNavigation } from '../../hooks/useGraphNavigation'

export function BackButton(): JSX.Element | null {
  const { canGoBack, handleBackToFiles, getCurrentFile } = useGraphNavigation()

  if (!canGoBack) {
    return null
  }

  const currentFile = getCurrentFile()

  return (
    <button
      onClick={handleBackToFiles}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: '#1e293b',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        color: '#ffffff',
        transition: 'all 0.15s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#334155'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#1e293b'
      }}
    >
      <span style={{ fontSize: '16px' }}>←</span>
      <span>Retour aux fichiers</span>
      {currentFile && (
        <span
          style={{
            color: '#94a3b8',
            fontSize: '12px',
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          ({currentFile.fileName})
        </span>
      )}
    </button>
  )
}
