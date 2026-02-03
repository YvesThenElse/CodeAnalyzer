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

import * as path from 'path'
import type { IImportResolver } from '../core/interfaces'
import type { LanguageId } from '../core/types'
import { isPathAlias, COMMON_FOLDER_ALIASES } from './patterns'

/**
 * TypeScript/JavaScript import resolver
 */
export class TypeScriptResolver implements IImportResolver {
  readonly languageId: LanguageId = 'typescript'

  /**
   * Check if an import is external (npm package)
   */
  isExternalImport(source: string): boolean {
    const isRelative = source.startsWith('.') || source.startsWith('/')
    const isAlias = isPathAlias(source)
    return !isRelative && !isAlias
  }

  /**
   * Resolve an import source to a file ID
   */
  resolveImport(source: string, sourceFolder: string, fileIds: Set<string>): string | null {
    // Normalize the import path
    let resolvedPath: string

    if (source.startsWith('./')) {
      // Relative to current folder
      resolvedPath = path.join(sourceFolder, source.slice(2)).replace(/\\/g, '/')
    } else if (source.startsWith('../')) {
      // Relative to parent folder
      resolvedPath = path.join(sourceFolder, source).replace(/\\/g, '/')
    } else if (source.startsWith('/')) {
      // Absolute from root
      resolvedPath = source.slice(1)
    } else {
      // Try to resolve as alias
      const aliasResolved = this.resolveAliasPath(source)
      if (aliasResolved) {
        resolvedPath = aliasResolved
      } else {
        // Can't resolve without config
        return null
      }
    }

    // Try different file extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']

    for (const ext of extensions) {
      const candidate = resolvedPath + ext
      if (fileIds.has(candidate)) {
        return candidate
      }
    }

    // Try without 'src/' prefix if present
    if (resolvedPath.startsWith('src/')) {
      const withoutSrc = resolvedPath.slice(4)
      for (const ext of extensions) {
        const candidate = withoutSrc + ext
        if (fileIds.has(candidate)) {
          return candidate
        }
      }
    }

    // Try with 'src/' prefix if not present
    if (!resolvedPath.startsWith('src/')) {
      const withSrc = 'src/' + resolvedPath
      for (const ext of extensions) {
        const candidate = withSrc + ext
        if (fileIds.has(candidate)) {
          return candidate
        }
      }
    }

    return null
  }

  /**
   * Try to resolve an alias import to a path
   */
  private resolveAliasPath(importSource: string): string | null {
    // @/ or @src/ -> src/
    if (importSource.startsWith('@/')) {
      return 'src/' + importSource.slice(2)
    }

    // @src/ -> src/
    if (importSource.startsWith('@src/')) {
      return 'src/' + importSource.slice(5)
    }

    // ~/ -> src/
    if (importSource.startsWith('~/')) {
      return 'src/' + importSource.slice(2)
    }

    // @renderer/ -> src/renderer/ (Electron projects)
    if (importSource.startsWith('@renderer/')) {
      return 'src/renderer/' + importSource.slice(10)
    }

    // @main/ -> src/main/ (Electron projects)
    if (importSource.startsWith('@main/')) {
      return 'src/main/' + importSource.slice(6)
    }

    // @components/, @utils/, @hooks/, etc.
    for (const folder of COMMON_FOLDER_ALIASES) {
      const aliasPattern = `@${folder}/`
      if (importSource.startsWith(aliasPattern)) {
        return 'src/' + folder + '/' + importSource.slice(aliasPattern.length)
      }
    }

    // #/ -> src/ (alternative alias)
    if (importSource.startsWith('#/')) {
      return 'src/' + importSource.slice(2)
    }

    // src/ without alias (direct reference)
    if (importSource.startsWith('src/')) {
      return importSource
    }

    return null
  }
}
