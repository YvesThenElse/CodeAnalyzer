import { useCallback } from 'react'
import { useC4Store } from '../store/c4Store'
import { C4Level } from '../types/c4.types'

export function useC4Navigation() {
  const {
    currentLevel,
    currentElementId,
    breadcrumb,
    project,
    setCurrentLevel,
    setCurrentElementId,
    addToBreadcrumb,
    navigateToBreadcrumb
  } = useC4Store()

  // Drill-down: go to next level focused on a specific element
  const drillDown = useCallback(
    (elementId: string) => {
      const nextLevel = (currentLevel + 1) as C4Level
      if (nextLevel > C4Level.CODE) return

      // Find the element to get its name for breadcrumb
      if (!project) return

      setCurrentLevel(nextLevel)
      setCurrentElementId(elementId)
      addToBreadcrumb(elementId)
    },
    [currentLevel, project, setCurrentLevel, setCurrentElementId, addToBreadcrumb]
  )

  // Go back: navigate to previous level
  const goBack = useCallback(() => {
    if (breadcrumb.length <= 1) return

    const previousItem = breadcrumb[breadcrumb.length - 2]
    navigateToBreadcrumb(previousItem.id)
  }, [breadcrumb, navigateToBreadcrumb])

  // Navigate to specific breadcrumb item
  const navigateTo = useCallback(
    (itemId: string) => {
      navigateToBreadcrumb(itemId)
    },
    [navigateToBreadcrumb]
  )

  // Check if we can navigate
  const canGoBack = breadcrumb.length > 1
  const canDrillDown = currentLevel < C4Level.CODE

  return {
    currentLevel,
    currentElementId,
    breadcrumb,
    drillDown,
    goBack,
    navigateTo,
    canGoBack,
    canDrillDown
  }
}
