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

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('React Error Boundary caught an error:', error)
    console.error('Component stack:', errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    })
    window.location.reload()
  }

  /**
   * Generate detailed error report for Claude Code
   */
  generateErrorReport = (): string => {
    const { error, errorInfo } = this.state
    const timestamp = new Date().toISOString()

    // Extract file and line info from stack trace
    const stackLines = error?.stack?.split('\n') || []
    const relevantStack = stackLines
      .filter(line => line.includes('/src/') && !line.includes('node_modules'))
      .slice(0, 10)
      .join('\n')

    // Extract component stack (simplified)
    const componentStack = errorInfo?.componentStack
      ?.split('\n')
      .filter(line => line.trim())
      .slice(0, 15)
      .join('\n') || 'N/A'

    // Parse first relevant file from stack
    const firstFileMatch = error?.stack?.match(/at\s+\w+\s+\(([^)]+)\)/) ||
                          error?.stack?.match(/at\s+([^\s]+:\d+:\d+)/)
    const firstFile = firstFileMatch ? firstFileMatch[1] : 'Unknown'

    const report = `## Erreur React dans CodeAnalyzer

**Message d'erreur:**
\`\`\`
${error?.message || 'Unknown error'}
\`\`\`

**Fichier probable:** ${firstFile}

**Type d'erreur:** ${error?.name || 'Error'}

**Stack trace (fichiers du projet):**
\`\`\`
${relevantStack || error?.stack?.slice(0, 1000) || 'N/A'}
\`\`\`

**Component Stack:**
\`\`\`
${componentStack}
\`\`\`

**Timestamp:** ${timestamp}

---
Corrige cette erreur dans le code source.`

    return report
  }

  handleCopyToClipboard = async (): Promise<void> => {
    const report = this.generateErrorReport()

    try {
      await navigator.clipboard.writeText(report)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = report
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorInfo, copied } = this.state

      return (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            color: '#1f2937',
            backgroundColor: '#f9fafb',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              maxWidth: '700px',
              width: '100%'
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#dc2626' }}>
              Une erreur est survenue
            </h1>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
              L'application a rencontre un probleme inattendu.
            </p>

            {error && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px',
                  textAlign: 'left'
                }}
              >
                <p
                  style={{
                    fontWeight: 600,
                    color: '#991b1b',
                    marginBottom: '8px',
                    fontSize: '14px'
                  }}
                >
                  Erreur:
                </p>
                <code
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: '#7f1d1d',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {error.message}
                </code>
              </div>
            )}

            {errorInfo && (
              <details
                style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '24px',
                  textAlign: 'left'
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: '#374151'
                  }}
                >
                  Details techniques
                </summary>
                <pre
                  style={{
                    fontSize: '11px',
                    marginTop: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    color: '#6b7280',
                    backgroundColor: '#e5e7eb',
                    padding: '12px',
                    borderRadius: '6px'
                  }}
                >
                  {this.generateErrorReport()}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleCopyToClipboard}
                style={{
                  backgroundColor: copied ? '#10b981' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {copied ? (
                  <>
                    <span>✓</span> Copie !
                  </>
                ) : (
                  <>
                    <span>📋</span> Copier pour Claude Code
                  </>
                )}
              </button>

              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
              >
                Recharger l'application
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
