import React from 'react'
import { useGraphStore } from '../../store/graphStore'
import { ClusteringMode } from '../../types/graph.types'

export function ClusteringToggle(): JSX.Element {
  const { clusteringMode, setClusteringMode, showClusters, setShowClusters } = useGraphStore()

  return (
    <div
      className="clustering-toggle"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        fontSize: '13px'
      }}
    >
      {/* Show/Hide clusters toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer'
        }}
      >
        <input
          type="checkbox"
          checked={showClusters}
          onChange={(e) => setShowClusters(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ color: '#64748b' }}>Grouper</span>
      </label>

      {/* Mode selector */}
      {showClusters && (
        <div
          style={{
            display: 'flex',
            backgroundColor: '#e2e8f0',
            borderRadius: '6px',
            padding: '2px'
          }}
        >
          <button
            onClick={() => setClusteringMode(ClusteringMode.FOLDER)}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: clusteringMode === ClusteringMode.FOLDER ? 600 : 400,
              backgroundColor:
                clusteringMode === ClusteringMode.FOLDER ? '#ffffff' : 'transparent',
              color:
                clusteringMode === ClusteringMode.FOLDER ? '#1e40af' : '#64748b',
              boxShadow:
                clusteringMode === ClusteringMode.FOLDER
                  ? '0 1px 2px rgba(0,0,0,0.05)'
                  : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Par dossier
          </button>
          <button
            onClick={() => setClusteringMode(ClusteringMode.COMMUNITY)}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: clusteringMode === ClusteringMode.COMMUNITY ? 600 : 400,
              backgroundColor:
                clusteringMode === ClusteringMode.COMMUNITY ? '#ffffff' : 'transparent',
              color:
                clusteringMode === ClusteringMode.COMMUNITY ? '#1e40af' : '#64748b',
              boxShadow:
                clusteringMode === ClusteringMode.COMMUNITY
                  ? '0 1px 2px rgba(0,0,0,0.05)'
                  : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Par liens
          </button>
        </div>
      )}
    </div>
  )
}
