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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useGraphStore } from '../../store/graphStore'
import './FunctionCodePanel.less'

const PANEL_MIN_WIDTH = 250
const PANEL_DEFAULT_WIDTH = 350
const STORAGE_KEY_WIDTH = 'functionCodePanelWidth'
const STORAGE_KEY_WRAP = 'functionCodePanelWrap'

export function FunctionCodePanel(): JSX.Element | null {
  const { functionLogic, hoveredLogicNodeId, selectedLogicNodeId, getLogicNodeLine } = useGraphStore()

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH)
    return stored ? Math.max(PANEL_MIN_WIDTH, parseInt(stored, 10)) : PANEL_DEFAULT_WIDTH
  })
  const [isResizing, setIsResizing] = useState(false)
  const [wrapLines, setWrapLines] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_WRAP)
    return stored === 'true'
  })

  const panelRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Persist width to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WIDTH, String(panelWidth))
  }, [panelWidth])

  // Persist wrap preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WRAP, String(wrapLines))
  }, [wrapLines])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent): void => {
      // Calculate width from right edge of window (no max limit)
      const newWidth = Math.max(PANEL_MIN_WIDTH, window.innerWidth - e.clientX)
      setPanelWidth(newWidth)
    }

    const handleMouseUp = (): void => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Get the line to highlight (hover takes precedence over selection)
  const highlightedLine = useMemo(() => {
    if (hoveredLogicNodeId) {
      return getLogicNodeLine(hoveredLogicNodeId)
    }
    if (selectedLogicNodeId) {
      return getLogicNodeLine(selectedLogicNodeId)
    }
    return null
  }, [hoveredLogicNodeId, selectedLogicNodeId, getLogicNodeLine])

  // Auto-scroll to highlighted line
  useEffect(() => {
    if (highlightedLine && contentRef.current) {
      const lineElement = contentRef.current.querySelector(`[data-line="${highlightedLine}"]`)
      if (lineElement) {
        lineElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }, [highlightedLine])

  // Parse source code into lines
  const lines = useMemo(() => {
    if (!functionLogic?.sourceCode) return []
    return functionLogic.sourceCode.split('\n')
  }, [functionLogic?.sourceCode])

  // Render a line with comment highlighting
  const renderLineContent = useCallback((line: string): React.ReactNode => {
    if (!line) return ' '

    // Check for single-line comment (//)
    const singleLineCommentIndex = line.indexOf('//')
    if (singleLineCommentIndex !== -1) {
      // Make sure it's not inside a string
      const beforeComment = line.substring(0, singleLineCommentIndex)
      const quoteCount = (beforeComment.match(/"/g) || []).length + (beforeComment.match(/'/g) || []).length + (beforeComment.match(/`/g) || []).length
      if (quoteCount % 2 === 0) {
        // It's a real comment
        const code = line.substring(0, singleLineCommentIndex)
        const comment = line.substring(singleLineCommentIndex)
        return (
          <>
            {code}
            <span className="function-code-panel__comment">{comment}</span>
          </>
        )
      }
    }

    // Check for block comment start (/* ... */)
    const blockCommentStart = line.indexOf('/*')
    const blockCommentEnd = line.indexOf('*/')
    if (blockCommentStart !== -1) {
      const beforeComment = line.substring(0, blockCommentStart)
      if (blockCommentEnd !== -1 && blockCommentEnd > blockCommentStart) {
        // Complete block comment on same line
        const comment = line.substring(blockCommentStart, blockCommentEnd + 2)
        const afterComment = line.substring(blockCommentEnd + 2)
        return (
          <>
            {beforeComment}
            <span className="function-code-panel__comment">{comment}</span>
            {afterComment}
          </>
        )
      } else {
        // Block comment starts but doesn't end on this line
        const comment = line.substring(blockCommentStart)
        return (
          <>
            {beforeComment}
            <span className="function-code-panel__comment">{comment}</span>
          </>
        )
      }
    }

    // Check if line is inside a block comment (starts with * or ends block comment)
    const trimmed = line.trim()
    if (trimmed.startsWith('*') || trimmed.startsWith('*/')) {
      return <span className="function-code-panel__comment">{line}</span>
    }

    return line
  }, [])

  if (!functionLogic) {
    return null
  }

  const { functionName, startLine } = functionLogic

  const getLineClasses = (lineNumber: number): string => {
    const classes = ['function-code-panel__line']
    if (lineNumber === highlightedLine) {
      classes.push('function-code-panel__line--highlighted')
      if (hoveredLogicNodeId) {
        classes.push('function-code-panel__line--hovered')
      } else {
        classes.push('function-code-panel__line--selected')
      }
    }
    return classes.join(' ')
  }

  const panelClassName = `function-code-panel${isResizing ? ' function-code-panel--resizing' : ''}`

  return (
    <aside
      ref={panelRef}
      className={panelClassName}
      style={{ width: `${panelWidth}px` }}
    >
      <div className="function-code-panel__resize-handle" onMouseDown={handleResizeStart} />

      <header className="function-code-panel__header">
        <span className="function-code-panel__title">Code source</span>
        <span className="function-code-panel__function-name">{functionName}()</span>
      </header>

      <div className="function-code-panel__content" ref={contentRef}>
        {lines.map((line, index) => {
          const lineNumber = startLine + index
          return (
            <div
              key={index}
              data-line={lineNumber}
              className={getLineClasses(lineNumber)}
            >
              <span className="function-code-panel__line-number">{lineNumber}</span>
              <code className={`function-code-panel__code${wrapLines ? ' function-code-panel__code--wrap' : ''}`}>
                {renderLineContent(line)}
              </code>
            </div>
          )
        })}
      </div>

      <footer className="function-code-panel__footer">
        <label className="function-code-panel__checkbox">
          <input
            type="checkbox"
            checked={wrapLines}
            onChange={(e) => setWrapLines(e.target.checked)}
          />
          Retour à la ligne
        </label>
      </footer>
    </aside>
  )
}
