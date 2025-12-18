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

import React, { useState, useEffect, useCallback } from 'react'
import { useGraphStore } from '../../store/graphStore'
import { LLM_MODELS, type LLMConfig, type LLMProvider } from '../../types/electron.types'

interface LLMConfigModalProps {
  open: boolean
  onClose: () => void
}

export function LLMConfigModal({ open, onClose }: LLMConfigModalProps): JSX.Element | null {
  const { graph, llmConfig, setLLMConfig } = useGraphStore()

  const [provider, setProvider] = useState<LLMProvider>('openai')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [saving, setSaving] = useState(false)

  // Load existing config when modal opens
  useEffect(() => {
    if (open && graph?.rootPath) {
      window.electronAPI.llm.getConfig(graph.rootPath).then((config) => {
        if (config) {
          setProvider(config.provider)
          setModel(config.model)
          setApiKey(config.apiKey)
          setOllamaUrl(config.ollamaUrl || 'http://localhost:11434')
          setLLMConfig(config)
        } else {
          // Set default model for provider
          setModel(LLM_MODELS[provider][0])
        }
      })
    }
  }, [open, graph?.rootPath, setLLMConfig])

  // Update model when provider changes
  useEffect(() => {
    const models = LLM_MODELS[provider]
    if (!models.includes(model)) {
      setModel(models[0])
    }
  }, [provider, model])

  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing')
    setTestError('')

    const config: LLMConfig = {
      provider,
      model,
      apiKey,
      ollamaUrl: provider === 'ollama' ? ollamaUrl : undefined
    }

    try {
      const result = await window.electronAPI.llm.testConnection(config)
      if (result.success) {
        setTestStatus('success')
      } else {
        setTestStatus('error')
        setTestError(result.error || 'Unknown error')
      }
    } catch (error) {
      setTestStatus('error')
      setTestError((error as Error).message)
    }
  }, [provider, model, apiKey, ollamaUrl])

  const handleSave = useCallback(async () => {
    if (!graph?.rootPath) return

    setSaving(true)

    const config: LLMConfig = {
      provider,
      model,
      apiKey,
      ollamaUrl: provider === 'ollama' ? ollamaUrl : undefined
    }

    try {
      const success = await window.electronAPI.llm.saveConfig(graph.rootPath, config)
      if (success) {
        setLLMConfig(config)
        onClose()
      }
    } catch (error) {
      console.error('Failed to save LLM config:', error)
    } finally {
      setSaving(false)
    }
  }, [graph?.rootPath, provider, model, apiKey, ollamaUrl, setLLMConfig, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal llm-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Configuration LLM</h2>
          <button className="modal__close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal__content">
          <div className="form-group">
            <label htmlFor="provider">Fournisseur</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as LLMProvider)
                setTestStatus('idle')
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="model">Modèle</label>
            <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
              {LLM_MODELS[provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {provider !== 'ollama' && (
            <div className="form-group">
              <label htmlFor="apiKey">Clé API</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setTestStatus('idle')
                }}
                placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
              />
            </div>
          )}

          {provider === 'ollama' && (
            <div className="form-group">
              <label htmlFor="ollamaUrl">URL Ollama</label>
              <input
                id="ollamaUrl"
                type="text"
                value={ollamaUrl}
                onChange={(e) => {
                  setOllamaUrl(e.target.value)
                  setTestStatus('idle')
                }}
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          <div className="form-group form-group--actions">
            <button
              className="btn btn--secondary"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || (provider !== 'ollama' && !apiKey)}
            >
              {testStatus === 'testing' ? 'Test en cours...' : 'Tester la connexion'}
            </button>

            {testStatus === 'success' && (
              <span className="test-status test-status--success">Connexion réussie</span>
            )}
            {testStatus === 'error' && (
              <span className="test-status test-status--error">{testError}</span>
            )}
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || (provider !== 'ollama' && !apiKey)}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
