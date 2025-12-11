import React, { useCallback } from 'react'
import { useC4Store } from '../../store/c4Store'
import { useC4Navigation } from '../../hooks/useC4Navigation'
import { ExportMenu } from './ExportMenu'

export function Header(): JSX.Element {
  const { project, isLoading, setLoading, setProject, setError, setProgress, reset } = useC4Store()
  const { goBack, canGoBack } = useC4Navigation()

  const handleSelectDirectory = useCallback(async () => {
    try {
      const dirPath = await window.electronAPI.selectDirectory()
      if (!dirPath) return

      // Reset state before new analysis
      reset()
      setLoading(true)

      // Setup progress listener
      const unsubProgress = window.electronAPI.onAnalysisProgress((progress) => {
        setProgress(progress)
      })

      // Setup error listener
      const unsubError = window.electronAPI.onAnalysisError((error) => {
        if (!error.recoverable) {
          setError(error.message)
        }
        console.warn('Analysis warning:', error)
      })

      try {
        const result = await window.electronAPI.analyzeProject(dirPath)
        if (result) {
          setProject(result)
        }
      } finally {
        unsubProgress()
        unsubError()
        setLoading(false)
        setProgress(null)
      }
    } catch (error) {
      setError((error as Error).message)
      setLoading(false)
    }
  }, [reset, setLoading, setProgress, setProject, setError])

  const handleRefresh = useCallback(async () => {
    if (!project?.rootPath) return

    setLoading(true)

    const unsubProgress = window.electronAPI.onAnalysisProgress((progress) => {
      setProgress(progress)
    })

    const unsubError = window.electronAPI.onAnalysisError((error) => {
      if (!error.recoverable) {
        setError(error.message)
      }
    })

    try {
      const result = await window.electronAPI.analyzeProject(project.rootPath)
      if (result) {
        setProject(result)
      }
    } finally {
      unsubProgress()
      unsubError()
      setLoading(false)
      setProgress(null)
    }
  }, [project?.rootPath, setLoading, setProgress, setProject, setError])

  return (
    <div className="header">
      <div className="header__logo">ReactAnalyzer</div>

      <div className="header__actions">
        <button
          className="btn btn--primary"
          onClick={handleSelectDirectory}
          disabled={isLoading}
        >
          Sélectionner répertoire
        </button>

        <button
          className="btn btn--secondary"
          onClick={handleRefresh}
          disabled={isLoading || !project}
        >
          Refresh
        </button>

        <button
          className="btn btn--secondary"
          onClick={goBack}
          disabled={isLoading || !canGoBack}
          title="Remonter d'un niveau"
        >
          ← Back
        </button>
      </div>

      <div className="header__spacer" />

      <ExportMenu disabled={!project || isLoading} />
    </div>
  )
}
