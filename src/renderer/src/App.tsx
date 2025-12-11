import React from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/Controls/Header'
import { Breadcrumb } from './components/Controls/Breadcrumb'
import { DiagramView } from './components/Diagram/DiagramView'
import { LoadingOverlay } from './components/Controls/LoadingOverlay'
import { DetectionPanel } from './components/Panels/DetectionPanel'
import { NodeDetailsPanel } from './components/Panels/NodeDetailsPanel'
import { FileTreePanel } from './components/Panels/FileTreePanel'
import { useC4Store } from './store/c4Store'

function App(): JSX.Element {
  const isLoading = useC4Store((state) => state.isLoading)

  return (
    <ReactFlowProvider>
      <div className="app">
        <header className="app__header">
          <Header />
        </header>
        <nav className="app__breadcrumb">
          <Breadcrumb />
        </nav>
        <div className="app__main">
          <FileTreePanel />
          <main className="app__content">
            <DiagramView />
          </main>
          <NodeDetailsPanel />
        </div>
        <DetectionPanel />
        {isLoading && <LoadingOverlay />}
      </div>
    </ReactFlowProvider>
  )
}

export default App
