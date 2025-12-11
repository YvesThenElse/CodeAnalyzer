import { useCallback } from 'react'
import { toPng } from 'html-to-image'
import { getNodesBounds, getViewportForBounds, useReactFlow } from '@xyflow/react'
import { useC4Store } from '../store/c4Store'
import { C4Level } from '../types/c4.types'

function generateFileName(ext: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `c4-diagram-${date}.${ext}`
}

export function useExport() {
  const { getNodes } = useReactFlow()
  const { project, currentLevel, breadcrumb } = useC4Store()

  // Export diagram as PNG
  const exportPng = useCallback(async () => {
    const nodes = getNodes()
    if (nodes.length === 0) return

    const nodesBounds = getNodesBounds(nodes)
    const viewport = getViewportForBounds(
      nodesBounds,
      nodesBounds.width,
      nodesBounds.height,
      0.5,
      2,
      0.2
    )

    const flowElement = document.querySelector('.react-flow__viewport') as HTMLElement
    if (!flowElement) return

    try {
      const dataUrl = await toPng(flowElement, {
        backgroundColor: '#FAFAFA',
        width: nodesBounds.width + 100,
        height: nodesBounds.height + 100,
        style: {
          width: String(nodesBounds.width + 100),
          height: String(nodesBounds.height + 100),
          transform: `translate(${viewport.x + 50}px, ${viewport.y + 50}px) scale(${viewport.zoom})`
        }
      })

      // Convert data URL to buffer
      const base64 = dataUrl.split(',')[1]
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Save file via Electron
      const fileName = generateFileName('png')
      await window.electronAPI.saveFile({
        defaultPath: fileName,
        filters: [{ name: 'Images', extensions: ['png'] }],
        data: Buffer.from(bytes)
      })
    } catch (error) {
      console.error('Export PNG failed:', error)
    }
  }, [getNodes])

  // Export project as JSON
  const exportJson = useCallback(async () => {
    if (!project) return

    const exportData = {
      name: project.name,
      rootPath: project.rootPath,
      exportedAt: new Date().toISOString(),
      analyzedAt: project.analyzedAt,
      currentView: {
        level: currentLevel,
        levelName: C4Level[currentLevel],
        path: breadcrumb.map((b) => b.name).join(' > ')
      },
      c4Model: {
        systemContext: project.levels[C4Level.SYSTEM_CONTEXT],
        containers: project.levels[C4Level.CONTAINER],
        components: project.levels[C4Level.COMPONENT],
        code: project.levels[C4Level.CODE],
        relations: project.relations,
        externalSystems: project.externalSystems
      }
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const fileName = generateFileName('json')

    await window.electronAPI.saveFile({
      defaultPath: fileName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      data: jsonString
    })
  }, [project, currentLevel, breadcrumb])

  return { exportPng, exportJson }
}
