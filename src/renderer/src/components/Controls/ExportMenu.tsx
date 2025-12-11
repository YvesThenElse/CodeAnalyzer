import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useExport } from '../../hooks/useExport'

interface ExportMenuProps {
  disabled?: boolean
}

export function ExportMenu({ disabled }: ExportMenuProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { exportPng, exportJson } = useExport()

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExportPng = useCallback(async () => {
    setIsOpen(false)
    await exportPng()
  }, [exportPng])

  const handleExportJson = useCallback(async () => {
    setIsOpen(false)
    await exportJson()
  }, [exportJson])

  return (
    <div className={`export-menu ${isOpen ? 'export-menu--open' : ''}`} ref={menuRef}>
      <button
        className="btn btn--secondary export-menu__trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        Export
        <span className="export-menu__arrow">▼</span>
      </button>

      {isOpen && (
        <ul className="export-menu__dropdown">
          <li>
            <button onClick={handleExportPng}>
              <span className="icon">🖼️</span>
              Export PNG
            </button>
          </li>
          <li>
            <button onClick={handleExportJson}>
              <span className="icon">📄</span>
              Export JSON
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
