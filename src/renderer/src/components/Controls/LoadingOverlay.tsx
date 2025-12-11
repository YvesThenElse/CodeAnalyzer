import React, { useCallback } from 'react'
import { useC4Store } from '../../store/c4Store'

const phaseLabels = {
  scanning: 'Analyse des fichiers...',
  parsing: 'Parsing du code...',
  analyzing: 'Analyse des dépendances...',
  building: 'Construction du modèle C4...'
}

export function LoadingOverlay(): JSX.Element {
  const { progress, setLoading } = useC4Store()

  const handleCancel = useCallback(async () => {
    await window.electronAPI.cancelAnalysis()
    setLoading(false)
  }, [setLoading])

  const percentage = progress ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="loading-overlay">
      <div className="loading-overlay__content">
        <div className="loading-overlay__spinner" />

        <div className="loading-overlay__phase">
          {progress ? phaseLabels[progress.phase] : 'Chargement...'}
        </div>

        {progress?.currentFile && (
          <div className="loading-overlay__file" title={progress.currentFile}>
            {progress.currentFile.split(/[/\\]/).pop()}
          </div>
        )}

        {progress && (
          <div className="loading-overlay__progress">
            <div
              className="loading-overlay__progress-bar"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}

        {progress && (
          <div style={{ fontSize: '12px', color: '#666' }}>
            {progress.current} / {progress.total} fichiers
          </div>
        )}

        <button className="btn btn--danger loading-overlay__cancel" onClick={handleCancel}>
          Annuler
        </button>
      </div>
    </div>
  )
}
