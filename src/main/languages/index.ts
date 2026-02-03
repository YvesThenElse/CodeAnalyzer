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

// Core exports
export * from './core'

// TypeScript/JavaScript exports
export { TypeScriptParser, TypeScriptResolver } from './typescript'

// C# exports
export { CSharpParser, CSharpResolver } from './csharp'

// Import classes for registration
import { getParserRegistry } from './core'
import { TypeScriptParser } from './typescript/parser'
import { TypeScriptResolver } from './typescript/resolver'
import { CSharpParser } from './csharp/parser'
import { CSharpResolver } from './csharp/resolver'

/**
 * Initialize the parser registry with all supported language parsers
 */
export function initializeParserRegistry(): void {
  const registry = getParserRegistry()

  // Register TypeScript/JavaScript parser and resolver
  registry.registerParser(new TypeScriptParser())
  registry.registerResolver(new TypeScriptResolver())

  // Register C# parser and resolver
  registry.registerParser(new CSharpParser())
  registry.registerResolver(new CSharpResolver())
}

/**
 * Get list of all supported file extensions across all languages
 */
export function getAllSupportedExtensions(): string[] {
  return getParserRegistry().getAllSupportedExtensions()
}
