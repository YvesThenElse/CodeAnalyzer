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

import * as fs from 'fs/promises'
import * as path from 'path'
import type { CsprojParseResult } from '../core/types'

/**
 * Parse a .csproj file to extract project information
 */
export async function parseCsprojFile(csprojPath: string): Promise<CsprojParseResult | null> {
  try {
    const content = await fs.readFile(csprojPath, 'utf-8')
    return parseCsprojContent(content, csprojPath)
  } catch (error) {
    console.error(`Failed to parse .csproj file: ${csprojPath}`, error)
    return null
  }
}

/**
 * Parse .csproj XML content (simple regex-based parsing, no XML lib needed)
 */
function parseCsprojContent(content: string, filePath: string): CsprojParseResult {
  const projectName = path.basename(filePath, '.csproj')

  // Extract TargetFramework
  const targetFrameworkMatch = content.match(/<TargetFramework>([^<]+)<\/TargetFramework>/i)
  const targetFrameworksMatch = content.match(/<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i)
  const targetFramework = targetFrameworkMatch?.[1] || targetFrameworksMatch?.[1]?.split(';')[0]

  // Extract PackageReferences
  const packageReferences: Array<{ name: string; version?: string }> = []
  const packageRefRegex = /<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?[^>]*\/?>/gi
  let match: RegExpExecArray | null

  while ((match = packageRefRegex.exec(content)) !== null) {
    packageReferences.push({
      name: match[1],
      version: match[2]
    })
  }

  // Also check for PackageReference with Version as child element
  const packageRefWithChildRegex = /<PackageReference\s+Include="([^"]+)"[^>]*>[\s\S]*?<Version>([^<]+)<\/Version>[\s\S]*?<\/PackageReference>/gi
  while ((match = packageRefWithChildRegex.exec(content)) !== null) {
    // Only add if not already present
    if (!packageReferences.some(p => p.name === match![1])) {
      packageReferences.push({
        name: match[1],
        version: match[2]
      })
    }
  }

  // Extract ProjectReferences
  const projectReferences: string[] = []
  const projectRefRegex = /<ProjectReference\s+Include="([^"]+)"[^>]*\/?>/gi

  while ((match = projectRefRegex.exec(content)) !== null) {
    // Normalize path
    const refPath = match[1].replace(/\\/g, '/')
    projectReferences.push(refPath)
  }

  // Extract Assembly References (for .NET Framework projects)
  const assemblyReferences: string[] = []
  const assemblyRefRegex = /<Reference\s+Include="([^"]+)"[^>]*\/?>/gi

  while ((match = assemblyRefRegex.exec(content)) !== null) {
    // Extract assembly name (before the comma if present)
    const assemblyName = match[1].split(',')[0].trim()
    assemblyReferences.push(assemblyName)
  }

  return {
    projectName,
    targetFramework,
    assemblyReferences,
    packageReferences,
    projectReferences
  }
}

/**
 * Find .csproj files in a directory
 */
export async function findCsprojFiles(dirPath: string): Promise<string[]> {
  const results: string[] = []

  async function scan(currentPath: string): Promise<void> {
    try {
      const stat = await fs.stat(currentPath)

      if (stat.isDirectory()) {
        const name = path.basename(currentPath)
        // Skip common non-project directories
        if (['node_modules', 'bin', 'obj', '.git', '.vs', 'packages'].includes(name)) {
          return
        }

        const entries = await fs.readdir(currentPath)
        for (const entry of entries) {
          await scan(path.join(currentPath, entry))
        }
      } else if (currentPath.endsWith('.csproj')) {
        results.push(currentPath)
      }
    } catch {
      // Ignore access errors
    }
  }

  await scan(dirPath)
  return results
}

/**
 * Get project references map for a directory (maps project name to csproj path)
 */
export async function buildProjectReferencesMap(
  dirPath: string
): Promise<Map<string, string>> {
  const csprojFiles = await findCsprojFiles(dirPath)
  const map = new Map<string, string>()

  for (const csprojPath of csprojFiles) {
    const projectName = path.basename(csprojPath, '.csproj')
    map.set(projectName, csprojPath)
  }

  return map
}
