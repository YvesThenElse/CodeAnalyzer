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
import { GraphLevel, type CodeItem, type FileNode } from '../../types/graph.types'
import { getDarkerColor } from '../../utils/colorUtils'
import { FunctionCodePanel } from './FunctionCodePanel'
import './NodeDetailsPanel.less'

const typeIcons: Record<string, string> = {
  function: 'ƒ',
  class: 'C',
  const: '○',
  let: '○',
  var: '○',
  type: 'T',
  interface: 'I',
  enum: 'E',
  'react-component': '⚛',
  hook: '↩'
}

const typeLabels: Record<string, string> = {
  function: 'Fonction',
  class: 'Classe',
  const: 'Constante',
  let: 'Variable (let)',
  var: 'Variable (var)',
  type: 'Type',
  interface: 'Interface',
  enum: 'Enum',
  'react-component': 'Composant React',
  hook: 'Hook'
}

function getCodeItemDisplayType(item: CodeItem): string {
  if (item.type === 'function' || item.type === 'const') {
    if (item.name.startsWith('use') && item.name.length > 3 && item.name[3] === item.name[3].toUpperCase()) {
      return 'hook'
    }
    if (item.name[0] === item.name[0].toUpperCase()) {
      return 'react-component'
    }
  }
  return item.type
}

function EmptyPanel(): JSX.Element {
  return (
    <aside className="node-details-panel">
      <header className="node-details-panel__header node-details-panel__header--empty">
        <div className="node-details-panel__header-content">
          <h2 className="node-details-panel__title">Détails</h2>
        </div>
      </header>
      <div className="node-details-panel__content">
        <div className="node-details-panel__empty">
          <span className="node-details-panel__empty-icon">📋</span>
          <p>Sélectionnez un élément pour voir ses détails</p>
        </div>
      </div>
    </aside>
  )
}

export function NodeDetailsPanel(): JSX.Element {
  const { graph, currentLevel, selectedFileId, selectedNodeId, setSelectedNodeId, focusedFileId } = useGraphStore()

  if (!graph) {
    return <EmptyPanel />
  }

  // Files level - show file details
  if (currentLevel === GraphLevel.FILES) {
    // Priority: selectedNodeId > focusedFileId
    const fileIdToShow = selectedNodeId || focusedFileId
    if (!fileIdToShow) return <EmptyPanel />

    const file = graph.files.get(fileIdToShow)
    if (!file) return <EmptyPanel />

    // Only show close button if it's a selection (not just focused)
    const handleClose = selectedNodeId ? () => setSelectedNodeId(null) : undefined

    return <FileDetailsPanel file={file} graph={graph} onClose={handleClose} />
  }

  // Code level - show code item details
  if (currentLevel === GraphLevel.CODE && selectedFileId) {
    const file = graph.files.get(selectedFileId)
    if (!file) return <EmptyPanel />

    if (selectedNodeId) {
      const codeItem = file.codeItems.find((item) => item.id === selectedNodeId)
      if (codeItem) {
        return (
          <CodeItemDetailsPanel
            codeItem={codeItem}
            file={file}
            onClose={() => setSelectedNodeId(null)}
          />
        )
      }
    }

    // Show file details if no code item is selected
    return <FileDetailsPanel file={file} graph={graph} onClose={undefined} />
  }

  // Function logic level - show function code panel
  if (currentLevel === GraphLevel.FUNCTION_LOGIC) {
    return <FunctionCodePanel />
  }

  return <EmptyPanel />
}

interface FileDetailsPanelProps {
  file: FileNode
  graph: ReturnType<typeof useGraphStore>['graph']
  onClose?: () => void
}

function FileDetailsPanel({ file, graph, onClose }: FileDetailsPanelProps): JSX.Element {
  const description = useGraphStore((state) => state.descriptions[file.relativePath])
  const headerColor = file.color || '#64748b'
  const textColor = '#ffffff'

  // Find files that import this file
  const importedBy = graph
    ? Array.from(graph.files.values()).filter((f) =>
        f.imports.some((imp) => imp.targetFileId && imp.targetFileId === file.id)
      )
    : []

  // Get imported files - filter out invalid targetFileIds and undefined results
  const importsFiles = file.imports
    .filter((imp) => imp.targetFileId && imp.targetFileId.length > 0)
    .map((imp) => (graph ? graph.files.get(imp.targetFileId) : undefined))
    .filter((f): f is FileNode => f !== undefined && f !== null)

  return (
    <aside className="node-details-panel">
      <header
        className="node-details-panel__header"
        style={{ backgroundColor: headerColor }}
      >
        <div className="node-details-panel__header-content">
          <span
            className="node-details-panel__badge"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: textColor
            }}
          >
            Fichier
          </span>
          <h2 className="node-details-panel__title" style={{ color: textColor }}>
            {file.fileName}
          </h2>
        </div>
        {onClose && (
          <button
            className="node-details-panel__close"
            onClick={onClose}
            style={{ color: textColor }}
            title="Fermer"
          >
            &times;
          </button>
        )}
      </header>

      <div className="node-details-panel__content">
        {/* Folder path */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Dossier</h3>
          <p className="node-details-panel__value">{file.folder || '/'}</p>
        </section>

        {/* Full path */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Chemin</h3>
          <code className="node-details-panel__file-path">{file.relativePath}</code>
        </section>

        {/* File type */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Type</h3>
          <p className="node-details-panel__value">{file.type}</p>
        </section>

        {/* AI Description */}
        {description?.long && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">
              Description (IA)
            </h3>
            <p
              className="node-details-panel__description"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
                fontSize: '13px'
              }}
            >
              {description.long}
            </p>
          </section>
        )}

        {/* Community */}
        {file.communityId && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">Communauté</h3>
            <p className="node-details-panel__value">#{file.communityId}</p>
          </section>
        )}

        {/* Imports this file makes */}
        {file.imports.length > 0 && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">
              Importe ({file.imports.length})
            </h3>
            <ul className="node-details-panel__list">
              {importsFiles.map((importedFile) => (
                <li key={importedFile.id} className="node-details-panel__list-item">
                  <span
                    className="node-details-panel__child-badge"
                    style={{ backgroundColor: importedFile.color || '#64748b' }}
                  />
                  {importedFile.fileName}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* External imports */}
        {file.externalImports.length > 0 && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">
              Imports externes ({file.externalImports.length})
            </h3>
            <ul className="node-details-panel__list">
              {file.externalImports.slice(0, 10).map((extImport, index) => (
                <li key={`${extImport}-${index}`} className="node-details-panel__list-item">
                  <code className="node-details-panel__external-import">{extImport}</code>
                </li>
              ))}
              {file.externalImports.length > 10 && (
                <li className="node-details-panel__list-item node-details-panel__list-item--more">
                  +{file.externalImports.length - 10} autres...
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Files that import this one */}
        {importedBy.length > 0 && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">
              Importé par ({importedBy.length})
            </h3>
            <ul className="node-details-panel__list">
              {importedBy.map((f) => (
                <li key={f.id} className="node-details-panel__list-item">
                  <span
                    className="node-details-panel__child-badge"
                    style={{ backgroundColor: f.color || '#64748b' }}
                  />
                  {f.fileName}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Code items in this file */}
        {file.codeItems.length > 0 && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">
              Déclarations ({file.codeItems.length})
            </h3>
            <ul className="node-details-panel__list">
              {file.codeItems.map((item) => {
                const displayType = getCodeItemDisplayType(item)
                return (
                  <li key={item.id} className="node-details-panel__list-item">
                    <span className="node-details-panel__code-icon">
                      {typeIcons[displayType] || '○'}
                    </span>
                    <span className="node-details-panel__code-name">{item.name}</span>
                    {item.isExported && (
                      <span className="node-details-panel__export-badge">export</span>
                    )}
                    {item.isDefault && (
                      <span className="node-details-panel__default-badge">default</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </aside>
  )
}

interface CodeItemDetailsPanelProps {
  codeItem: CodeItem
  file: FileNode
  onClose: () => void
}

function CodeItemDetailsPanel({
  codeItem,
  file,
  onClose
}: CodeItemDetailsPanelProps): JSX.Element {
  const displayType = getCodeItemDisplayType(codeItem)
  const headerColor = file.color || '#64748b'
  const textColor = '#ffffff'

  return (
    <aside className="node-details-panel">
      <header
        className="node-details-panel__header"
        style={{ backgroundColor: headerColor }}
      >
        <div className="node-details-panel__header-content">
          <span
            className="node-details-panel__badge"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: textColor
            }}
          >
            {typeLabels[displayType] || displayType}
          </span>
          <h2 className="node-details-panel__title" style={{ color: textColor }}>
            {codeItem.name}
          </h2>
        </div>
        <button
          className="node-details-panel__close"
          onClick={onClose}
          style={{ color: textColor }}
          title="Fermer"
        >
          &times;
        </button>
      </header>

      <div className="node-details-panel__content">
        {/* File info */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Fichier</h3>
          <code className="node-details-panel__file-path">
            {file.relativePath}:{codeItem.line}
          </code>
        </section>

        {/* Export status */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Statut</h3>
          <div className="node-details-panel__badges">
            {codeItem.isExported ? (
              <span className="node-details-panel__status-badge node-details-panel__status-badge--exported">
                Exporté
              </span>
            ) : (
              <span className="node-details-panel__status-badge node-details-panel__status-badge--private">
                Privé
              </span>
            )}
            {codeItem.isDefault && (
              <span className="node-details-panel__status-badge node-details-panel__status-badge--default">
                Default
              </span>
            )}
          </div>
        </section>

        {/* Signature */}
        {codeItem.signature && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">Signature</h3>
            <code className="node-details-panel__signature">{codeItem.signature}</code>
          </section>
        )}

        {/* Line number */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Ligne</h3>
          <p className="node-details-panel__value">{codeItem.line}</p>
        </section>
      </div>
    </aside>
  )
}
