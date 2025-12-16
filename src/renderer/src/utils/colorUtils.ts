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

import type { FolderColorMap } from '../types/graph.types'

// Base colors for root folders (distinct hues)
const FOLDER_BASE_COLORS = [
  { hue: 210, name: 'blue' },    // Blue
  { hue: 150, name: 'green' },   // Green
  { hue: 35, name: 'orange' },   // Orange
  { hue: 270, name: 'purple' },  // Purple
  { hue: 0, name: 'red' },       // Red
  { hue: 330, name: 'pink' },    // Pink
  { hue: 185, name: 'cyan' },    // Cyan
  { hue: 75, name: 'lime' }      // Lime
]

/**
 * Generate colors for all folders based on their root folder and depth
 */
export function generateFolderColors(
  folders: string[],
  rootFolders: string[]
): FolderColorMap {
  const colorMap: FolderColorMap = {}

  for (const folder of folders) {
    const rootFolder = getRootFolder(folder, rootFolders)
    const depth = getFolderDepth(folder, rootFolder)
    const color = getFolderColor(rootFolder, rootFolders, depth)
    colorMap[folder] = color
  }

  return colorMap
}

/**
 * Get the root folder for a given folder path
 */
export function getRootFolder(folderPath: string, rootFolders: string[]): string {
  // Find the root folder that this path belongs to
  for (const root of rootFolders) {
    if (folderPath === root || folderPath.startsWith(root + '/')) {
      return root
    }
  }
  // If no match, return the first segment
  return folderPath.split('/')[0]
}

/**
 * Get the depth of a folder relative to its root folder
 */
export function getFolderDepth(folderPath: string, rootFolder: string): number {
  if (folderPath === rootFolder) return 0

  const relativePath = folderPath.slice(rootFolder.length + 1)
  if (!relativePath) return 0

  return relativePath.split('/').length
}

/**
 * Generate HSL color for a folder based on root folder index and depth
 */
export function getFolderColor(
  rootFolder: string,
  rootFolders: string[],
  depth: number
): string {
  const rootIndex = rootFolders.indexOf(rootFolder)
  const colorIndex = rootIndex >= 0 ? rootIndex : 0

  // Get base hue from predefined colors (cycle if more folders than colors)
  const baseColor = FOLDER_BASE_COLORS[colorIndex % FOLDER_BASE_COLORS.length]
  const hue = baseColor.hue

  // Saturation stays constant
  const saturation = 70

  // Lightness increases with depth (deeper = lighter)
  // Base: 45%, each level adds 10%, max 80%
  const lightness = Math.min(45 + depth * 10, 80)

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Get a contrasting text color (black or white) for a given background HSL
 */
export function getContrastingTextColor(hslColor: string): string {
  // Parse HSL
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return '#000000'

  const lightness = parseInt(match[3], 10)

  // If lightness is above 60%, use dark text, otherwise use light text
  return lightness > 60 ? '#1f2937' : '#ffffff'
}

/**
 * Convert HSL string to hex color
 */
export function hslToHex(hslColor: string): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return '#3B82F6'

  const h = parseInt(match[1], 10) / 360
  const s = parseInt(match[2], 10) / 100
  const l = parseInt(match[3], 10) / 100

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Get lighter version of a color (for hover states, backgrounds)
 */
export function getLighterColor(hslColor: string, amount = 15): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return hslColor

  const h = parseInt(match[1], 10)
  const s = parseInt(match[2], 10)
  const l = Math.min(parseInt(match[3], 10) + amount, 95)

  return `hsl(${h}, ${s}%, ${l}%)`
}

/**
 * Get darker version of a color (for borders, active states)
 */
export function getDarkerColor(hslColor: string, amount = 15): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return hslColor

  const h = parseInt(match[1], 10)
  const s = parseInt(match[2], 10)
  const l = Math.max(parseInt(match[3], 10) - amount, 20)

  return `hsl(${h}, ${s}%, ${l}%)`
}

/**
 * Generate a color for community clusters (different palette)
 */
export function getCommunityColor(communityIndex: number, totalCommunities: number): string {
  // Use golden ratio for better distribution
  const goldenRatio = 0.618033988749895
  const hue = ((communityIndex * goldenRatio) % 1) * 360

  return `hsl(${Math.round(hue)}, 65%, 55%)`
}

/**
 * Generate a subtle gradient background from a color
 * Used for file cards and tree items
 */
export function getGradientBackground(hslColor: string, direction: 'to right' | 'to bottom' = 'to right'): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return `linear-gradient(${direction}, #f8fafc, #ffffff)`

  const h = parseInt(match[1], 10)
  const s = parseInt(match[2], 10)

  // Create a subtle gradient from the color (very light) to white
  const startColor = `hsl(${h}, ${Math.min(s, 40)}%, 95%)`
  const endColor = `hsl(${h}, ${Math.min(s, 20)}%, 99%)`

  return `linear-gradient(${direction}, ${startColor}, ${endColor})`
}

/**
 * Generate a more vibrant gradient for highlighted/hovered items
 */
export function getVibrantGradientBackground(hslColor: string, direction: 'to right' | 'to bottom' = 'to right'): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return `linear-gradient(${direction}, #e0f2fe, #f0f9ff)`

  const h = parseInt(match[1], 10)
  const s = parseInt(match[2], 10)

  // Create a more noticeable gradient
  const startColor = `hsl(${h}, ${Math.min(s, 50)}%, 90%)`
  const endColor = `hsl(${h}, ${Math.min(s, 30)}%, 97%)`

  return `linear-gradient(${direction}, ${startColor}, ${endColor})`
}

/**
 * Get color with alpha channel
 */
export function getColorWithAlpha(hslColor: string, alpha: number): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return `rgba(100, 116, 139, ${alpha})`

  const h = parseInt(match[1], 10)
  const s = parseInt(match[2], 10)
  const l = parseInt(match[3], 10)

  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`
}
