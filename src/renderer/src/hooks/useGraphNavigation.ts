import { useCallback } from 'react'
import { useGraphStore } from '../store/graphStore'
import { GraphLevel } from '../types/graph.types'

/**
 * Hook for navigating the dependency graph
 */
export function useGraphNavigation() {
  const {
    currentLevel,
    focusedFileId,
    selectedFileId,
    focusOnFile,
    drillDownToCode,
    goBackToFiles,
    highlightRelatedFiles,
    clearHighlight,
    graph
  } = useGraphStore()

  /**
   * Handle single click on a file node
   * - At FILES level: recenters the graph on this file
   */
  const handleFileClick = useCallback(
    (fileId: string) => {
      if (currentLevel === GraphLevel.FILES) {
        focusOnFile(fileId)
      }
    },
    [currentLevel, focusOnFile]
  )

  /**
   * Handle double click on a file node
   * - At FILES level: drills down to show file's code
   */
  const handleFileDoubleClick = useCallback(
    (fileId: string) => {
      if (currentLevel === GraphLevel.FILES) {
        drillDownToCode(fileId)
      }
    },
    [currentLevel, drillDownToCode]
  )

  /**
   * Handle mouse enter on a file node
   * - Highlights related files
   */
  const handleFileMouseEnter = useCallback(
    (fileId: string) => {
      highlightRelatedFiles(fileId)
    },
    [highlightRelatedFiles]
  )

  /**
   * Handle mouse leave on a file node
   * - Clears highlight
   */
  const handleFileMouseLeave = useCallback(() => {
    clearHighlight()
  }, [clearHighlight])

  /**
   * Navigate back from CODE level to FILES level
   */
  const handleBackToFiles = useCallback(() => {
    goBackToFiles()
  }, [goBackToFiles])

  /**
   * Check if we can go back (only at CODE level)
   */
  const canGoBack = currentLevel === GraphLevel.CODE

  /**
   * Check if we can drill down (only at FILES level with focused file)
   */
  const canDrillDown = currentLevel === GraphLevel.FILES && focusedFileId !== null

  /**
   * Get the current file being viewed (at CODE level)
   */
  const getCurrentFile = useCallback(() => {
    if (currentLevel !== GraphLevel.CODE || !selectedFileId || !graph) return null
    return graph.files.get(selectedFileId) || null
  }, [currentLevel, selectedFileId, graph])

  /**
   * Get the focused file (at FILES level)
   */
  const getFocusedFile = useCallback(() => {
    if (!focusedFileId || !graph) return null
    return graph.files.get(focusedFileId) || null
  }, [focusedFileId, graph])

  return {
    // State
    currentLevel,
    focusedFileId,
    selectedFileId,
    canGoBack,
    canDrillDown,

    // Actions
    handleFileClick,
    handleFileDoubleClick,
    handleFileMouseEnter,
    handleFileMouseLeave,
    handleBackToFiles,
    focusOnFile,
    drillDownToCode,

    // Getters
    getCurrentFile,
    getFocusedFile
  }
}
