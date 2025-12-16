import React, { useCallback } from 'react'
import { useGraphStore } from '../../store/graphStore'

export function Header(): JSX.Element {
  const { graph, isLoading, setLoading, setGraph, setError, setProgress, reset } = useGraphStore()

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
          // Pass serialized graph to store - store will deserialize it
          setGraph(result)
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
  }, [reset, setLoading, setProgress, setGraph, setError])

  const handleRefresh = useCallback(async () => {
    if (!graph?.rootPath) return

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
      const result = await window.electronAPI.analyzeProject(graph.rootPath)
      if (result) {
        // Pass serialized graph to store - store will deserialize it
        setGraph(result)
      }
    } finally {
      unsubProgress()
      unsubError()
      setLoading(false)
      setProgress(null)
    }
  }, [graph?.rootPath, setLoading, setProgress, setGraph, setError])

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
          disabled={isLoading || !graph}
        >
          Rafraîchir
        </button>
      </div>

      {graph && (
        <div className="header__info">
          <span className="header__project-name">{graph.name}</span>
          <span className="header__file-count">{graph.files.size} fichiers</span>
        </div>
      )}
    </div>
  )
}
