import React from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Header } from './components/Controls/Header'
import { BackButton } from './components/Controls/BackButton'
import { ClusteringToggle } from './components/Controls/ClusteringToggle'
import { DiagramView } from './components/Diagram/DiagramView'
import { LoadingOverlay } from './components/Controls/LoadingOverlay'
import { NodeDetailsPanel } from './components/Panels/NodeDetailsPanel'
import { FileTreePanel } from './components/Panels/FileTreePanel'
import { useGraphStore } from './store/graphStore'

function ErrorDisplay(): JSX.Element | null {
  const error = useGraphStore((state) => state.error)
  const setError = useGraphStore((state) => state.setError)

  if (!error) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        padding: '16px 24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: '500px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}
    >
      <span style={{ fontSize: '20px' }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, color: '#991b1b', fontWeight: 500 }}>Erreur</p>
        <p style={{ margin: '4px 0 0', color: '#7f1d1d', fontSize: '14px' }}>{error}</p>
      </div>
      <button
        onClick={() => setError(null)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          color: '#991b1b',
          padding: '0'
        }}
      >
        ×
      </button>
    </div>
  )
}

function App(): JSX.Element {
  const isLoading = useGraphStore((state) => state.isLoading)

  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <div className="app">
          <header className="app__header">
            <Header />
          </header>
          <nav className="app__toolbar">
            <BackButton />
            <ClusteringToggle />
          </nav>
          <div className="app__main">
            <FileTreePanel />
            <main className="app__content">
              <DiagramView />
            </main>
            <NodeDetailsPanel />
          </div>
          {isLoading && <LoadingOverlay />}
          <ErrorDisplay />
        </div>
      </ReactFlowProvider>
    </ErrorBoundary>
  )
}

export default App
