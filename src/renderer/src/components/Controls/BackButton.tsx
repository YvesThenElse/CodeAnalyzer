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
        padding: '8px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        color: '#475569',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f8fafc'
        e.currentTarget.style.borderColor = '#cbd5e1'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#ffffff'
        e.currentTarget.style.borderColor = '#e2e8f0'
      }}
    >
      <span style={{ fontSize: '16px' }}>\u2190</span>
      <span>Retour</span>
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
