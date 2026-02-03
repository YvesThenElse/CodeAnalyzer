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

import type { IImportResolver } from '../core/interfaces'
import type { LanguageId } from '../core/types'
import { isFrameworkNamespace } from './nodeTypes'

/**
 * C# import resolver - resolves using directives to files
 */
export class CSharpResolver implements IImportResolver {
  readonly languageId: LanguageId = 'csharp'

  // Map of namespace -> file IDs (built during analysis)
  private namespaceToFiles: Map<string, string[]> = new Map()

  /**
   * Set the namespace to files mapping
   * This should be called after parsing all files to enable resolution
   */
  setNamespaceMap(namespaceMap: Map<string, string[]>): void {
    this.namespaceToFiles = namespaceMap
  }

  /**
   * Check if an import is external (.NET Framework or NuGet package)
   */
  isExternalImport(source: string): boolean {
    // Check if it's a .NET Framework namespace
    if (isFrameworkNamespace(source)) {
      return true
    }

    // If we don't have it in our namespace map, it's external
    if (!this.namespaceToFiles.has(source)) {
      // Also check partial namespaces
      const hasAnyMatch = Array.from(this.namespaceToFiles.keys()).some(
        ns => ns === source || ns.startsWith(source + '.')
      )
      return !hasAnyMatch
    }

    return false
  }

  /**
   * Resolve a using directive to file IDs
   * Note: In C#, one namespace can span multiple files, so we return the first match
   */
  resolveImport(source: string, _sourceFolder: string, fileIds: Set<string>): string | null {
    // Direct namespace match
    const files = this.namespaceToFiles.get(source)
    if (files && files.length > 0) {
      // Return the first file that exists in our fileIds set
      for (const file of files) {
        if (fileIds.has(file)) {
          return file
        }
      }
    }

    // Try partial namespace match (e.g., "MyApp.Services" might resolve to files in "MyApp.Services.Impl")
    for (const [namespace, nsFiles] of this.namespaceToFiles.entries()) {
      if (namespace.startsWith(source + '.')) {
        for (const file of nsFiles) {
          if (fileIds.has(file)) {
            return file
          }
        }
      }
    }

    return null
  }

  /**
   * Build namespace map from parsed files
   */
  static buildNamespaceMap(
    files: Map<string, { namespace?: string }>
  ): Map<string, string[]> {
    const namespaceMap = new Map<string, string[]>()

    for (const [fileId, fileInfo] of files.entries()) {
      if (fileInfo.namespace) {
        const existing = namespaceMap.get(fileInfo.namespace) || []
        existing.push(fileId)
        namespaceMap.set(fileInfo.namespace, existing)
      }
    }

    return namespaceMap
  }
}
