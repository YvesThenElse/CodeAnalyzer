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

import { parentPort, workerData } from 'worker_threads'
import { parseFile } from '../astParser'

interface WorkerData {
  files: string[]
}

interface ProgressMessage {
  type: 'progress'
  current: number
  total: number
  file: string
  result?: Awaited<ReturnType<typeof parseFile>>
  error?: { message: string }
}

interface DoneMessage {
  type: 'done'
}

type WorkerMessage = ProgressMessage | DoneMessage

const { files } = workerData as WorkerData
let cancelled = false

// Listen for cancel message
parentPort?.on('message', (msg) => {
  if (msg === 'cancel') {
    cancelled = true
  }
})

async function analyze(): Promise<void> {
  const total = files.length

  for (let i = 0; i < files.length; i++) {
    if (cancelled) {
      break
    }

    const file = files[i]
    let result: Awaited<ReturnType<typeof parseFile>> | undefined
    let error: { message: string } | undefined

    try {
      result = await parseFile(file)
    } catch (e) {
      error = { message: (e as Error).message }
    }

    const message: ProgressMessage = {
      type: 'progress',
      current: i + 1,
      total,
      file,
      result,
      error
    }

    parentPort?.postMessage(message)
  }

  const doneMessage: DoneMessage = { type: 'done' }
  parentPort?.postMessage(doneMessage)
}

analyze().catch((error) => {
  console.error('Worker error:', error)
  process.exit(1)
})
