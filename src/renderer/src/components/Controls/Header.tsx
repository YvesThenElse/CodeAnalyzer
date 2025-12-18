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

import React, { useCallback, useState, useEffect } from 'react'
import { useGraphStore } from '../../store/graphStore'
import { LLMConfigModal } from './LLMConfigModal'

export function Header(): JSX.Element {
  const {
    graph,
    isLoading,
    setLoading,
    setGraph,
    setError,
    setProgress,
    reset,
    llmConfig,
    llmLoading,
    llmProgress,
    setLLMConfig,
    setLLMLoading,
    setLLMProgress,
    setDescriptions
  } = useGraphStore()

  const [configModalOpen, setConfigModalOpen] = useState(false)

  // Setup LLM event listeners
  useEffect(() => {
    const unsubProgress = window.electronAPI.llm.onProgress((progress) => {
      setLLMProgress(progress)
    })

    const unsubComplete = window.electronAPI.llm.onComplete((descriptions) => {
      setDescriptions(descriptions)
      setLLMLoading(false)
      setLLMProgress(null)
    })

    const unsubError = window.electronAPI.llm.onError((error) => {
      console.warn('LLM error:', error.message, error.file)
      // Continue with other files, don't stop loading
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [setLLMProgress, setDescriptions, setLLMLoading])

  // Load LLM config and descriptions when graph changes
  useEffect(() => {
    if (graph?.rootPath) {
      // Load config
      window.electronAPI.llm.getConfig(graph.rootPath).then((config) => {
        setLLMConfig(config)

        // Load existing descriptions
        window.electronAPI.llm.getDescriptions(graph.rootPath).then((descriptions) => {
          if (Object.keys(descriptions).length > 0) {
            setDescriptions(descriptions)
          } else if (config) {
            // Auto-generate if config exists but no descriptions
            setLLMLoading(true)
            window.electronAPI.llm.generateDescriptions(graph.rootPath)
          }
        })
      })
    }
  }, [graph?.rootPath, setLLMConfig, setDescriptions, setLLMLoading])

  const handleGenerateDescriptions = useCallback(
    async (forceRegenerate = false) => {
      if (!graph?.rootPath || !llmConfig) return

      setLLMLoading(true)
      await window.electronAPI.llm.generateDescriptions(graph.rootPath, forceRegenerate)
    },
    [graph?.rootPath, llmConfig, setLLMLoading]
  )

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

    // Invalidate LLM cache on refresh
    if (llmConfig) {
      await window.electronAPI.llm.invalidateCache(graph.rootPath)
    }

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
        // Regenerate descriptions after refresh if config exists
        if (llmConfig) {
          setLLMLoading(true)
          window.electronAPI.llm.generateDescriptions(graph.rootPath, true)
        }
      }
    } finally {
      unsubProgress()
      unsubError()
      setLoading(false)
      setProgress(null)
    }
  }, [graph?.rootPath, setLoading, setProgress, setGraph, setError, llmConfig, setLLMLoading])

  return (
    <div className="header">
      <div className="header__logo">CodeAnalyzer</div>

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

        <button
          className="btn btn--icon"
          onClick={() => setConfigModalOpen(true)}
          disabled={!graph}
          title="Configuration LLM"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {llmConfig && graph && (
          <button
            className="btn btn--secondary btn--small"
            onClick={() => handleGenerateDescriptions(false)}
            disabled={llmLoading}
            title="Générer les descriptions IA"
          >
            {llmLoading ? 'Génération...' : 'Générer descriptions'}
          </button>
        )}
      </div>

      {graph && (
        <div className="header__info">
          <span className="header__project-name">{graph.name}</span>
          <span className="header__file-count">{graph.files.size} fichiers</span>
        </div>
      )}

      {llmProgress && (
        <div className="header__llm-progress">
          <span className="header__llm-progress-text">
            IA: {llmProgress.current}/{llmProgress.total}
          </span>
          <span className="header__llm-progress-file">{llmProgress.currentFile}</span>
        </div>
      )}

      <LLMConfigModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
    </div>
  )
}
