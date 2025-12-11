import React from 'react'
import { useC4Store } from '../../store/c4Store'
import { getNodeColors } from '../Diagram/BaseC4Node'
import { C4Level } from '../../types/c4.types'
import './NodeDetailsPanel.less'

const levelLabels: Record<C4Level, string> = {
  [C4Level.SYSTEM_CONTEXT]: 'System Context',
  [C4Level.CONTAINER]: 'Container',
  [C4Level.COMPONENT]: 'Component',
  [C4Level.CODE]: 'Code'
}

const typeLabels: Record<string, string> = {
  person: 'Person',
  system: 'System',
  external_system: 'External System',
  cloud_service: 'Cloud Service',
  container_frontend: 'Frontend',
  container_backend: 'Backend',
  container_database: 'Database',
  component: 'Component',
  code_function: 'Function',
  code_component: 'React Component',
  code_hook: 'Hook'
}

export function NodeDetailsPanel(): JSX.Element | null {
  const { getSelectedElement, setSelectedNodeId, project } = useC4Store()
  const element = getSelectedElement()

  if (!element) {
    return null
  }

  const colors = getNodeColors(element.type)

  // Find children elements by their IDs
  const childElements = element.children?.map((childId) => {
    if (!project) return null
    for (const level of Object.values(project.levels)) {
      const found = level.find((el) => el.id === childId)
      if (found) return found
    }
    return null
  }).filter(Boolean) || []

  return (
    <aside className="node-details-panel">
      <header
        className="node-details-panel__header"
        style={{ backgroundColor: colors.backgroundColor }}
      >
        <div className="node-details-panel__header-content">
          <span
            className="node-details-panel__badge"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: colors.textColor
            }}
          >
            {typeLabels[element.type] || element.type}
          </span>
          <h2
            className="node-details-panel__title"
            style={{ color: colors.textColor }}
          >
            {element.name}
          </h2>
        </div>
        <button
          className="node-details-panel__close"
          onClick={() => setSelectedNodeId(null)}
          style={{ color: colors.textColor }}
          title="Fermer"
        >
          &times;
        </button>
      </header>

      <div className="node-details-panel__content">
        {/* Description */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Description</h3>
          <p className="node-details-panel__description">{element.description}</p>
        </section>

        {/* Level */}
        <section className="node-details-panel__section">
          <h3 className="node-details-panel__section-title">Niveau C4</h3>
          <p className="node-details-panel__value">{levelLabels[element.level]}</p>
        </section>

        {/* File path */}
        {element.metadata?.filePath && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">Fichier source</h3>
            <code className="node-details-panel__file-path">
              {element.metadata.filePath}
              {element.metadata.lineNumber && `:${element.metadata.lineNumber}`}
            </code>
          </section>
        )}

        {/* Children */}
        {childElements.length > 0 && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">
              Enfants ({childElements.length})
            </h3>
            <ul className="node-details-panel__list">
              {childElements.map((child) => child && (
                <li key={child.id} className="node-details-panel__list-item">
                  <span
                    className="node-details-panel__child-badge"
                    style={{ backgroundColor: getNodeColors(child.type).backgroundColor }}
                  />
                  {child.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Detection sources */}
        {element.metadata?.detectedVia && element.metadata.detectedVia.length > 0 && (
          <section className="node-details-panel__section">
            <h3 className="node-details-panel__section-title">
              Sources de detection ({element.metadata.detectedVia.length})
            </h3>
            <ul className="node-details-panel__list">
              {element.metadata.detectedVia.map((detection, index) => (
                <li key={index} className="node-details-panel__detection">
                  <code className="node-details-panel__detection-source">
                    {detection.source}
                  </code>
                  <span className="node-details-panel__detection-location">
                    {detection.file.split(/[/\\]/).pop()}:{detection.line}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  )
}
