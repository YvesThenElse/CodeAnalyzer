import React from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/Controls/Header'
import { BackButton } from './components/Controls/BackButton'
import { ClusteringToggle } from './components/Controls/ClusteringToggle'
import { DiagramView } from './components/Diagram/DiagramView'
import { LoadingOverlay } from './components/Controls/LoadingOverlay'
import { NodeDetailsPanel } from './components/Panels/NodeDetailsPanel'
import { FileTreePanel } from './components/Panels/FileTreePanel'
import { useGraphStore } from './store/graphStore'

function App(): JSX.Element {
  const isLoading = useGraphStore((state) => state.isLoading)

  return (
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
      </div>
    </ReactFlowProvider>
  )
}

export default App
