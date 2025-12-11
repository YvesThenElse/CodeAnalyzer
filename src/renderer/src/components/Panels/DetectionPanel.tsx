import React, { useState } from 'react'
import { useC4Store } from '../../store/c4Store'
import type { ExternalSystemDetection } from '../../types/c4.types'
import './DetectionPanel.less'

export function DetectionPanel(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false)
  const { project } = useC4Store()

  if (!project || project.externalSystems.length === 0) {
    return null
  }

  return (
    <div className={`detection-panel ${isOpen ? 'detection-panel--open' : ''}`}>
      <button
        className="detection-panel__toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Systèmes externes détectés"
      >
        <span className="detection-panel__icon">🔍</span>
        <span className="detection-panel__count">{project.externalSystems.length}</span>
      </button>

      {isOpen && (
        <div className="detection-panel__content">
          <div className="detection-panel__header">
            <h3>Systèmes externes détectés</h3>
            <button
              className="detection-panel__close"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="detection-panel__list">
            {project.externalSystems.map((system, index) => (
              <SystemItem key={index} system={system} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface SystemItemProps {
  system: ExternalSystemDetection
}

function SystemItem({ system }: SystemItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const typeLabels = {
    api: 'API',
    sdk: 'SDK',
    database: 'Base de données',
    cloud_service: 'Service Cloud'
  }

  const typeColors = {
    api: '#999999',
    sdk: '#1168BD',
    database: '#438DD5',
    cloud_service: '#DD8400'
  }

  return (
    <div className="system-item">
      <button
        className="system-item__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="system-item__badge"
          style={{ backgroundColor: typeColors[system.type] }}
        >
          {typeLabels[system.type]}
        </span>
        <span className="system-item__name">{system.name}</span>
        <span className="system-item__detections">
          {system.detections.length} détection{system.detections.length > 1 ? 's' : ''}
        </span>
        <span className={`system-item__arrow ${expanded ? 'expanded' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <ul className="system-item__details">
          {system.detections.map((detection, index) => (
            <li key={index} className="detection-detail">
              <code className="detection-detail__source">{detection.source}</code>
              <span className="detection-detail__location">
                {detection.file.split(/[/\\]/).pop()}:{detection.line}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
