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

import type { DeclarationType } from '../../../renderer/src/types/ast.types'
import type { CSharpVisibility } from '../core/types'

/**
 * Mapping of C# AST node types to CodeItem types
 */
export const CSHARP_NODE_TYPE_MAP: Record<string, DeclarationType> = {
  'class_declaration': 'class',
  'interface_declaration': 'interface',
  'struct_declaration': 'class',      // Map struct to class
  'record_declaration': 'class',       // Map record to class
  'enum_declaration': 'enum',
  'delegate_declaration': 'type',      // Map delegate to type
  'method_declaration': 'function',
  'property_declaration': 'const',     // Map property to const
  'field_declaration': 'const',        // Map field to const
  'constructor_declaration': 'function',
  'event_declaration': 'const'         // Map event to const
}

/**
 * C# visibility modifiers in order of accessibility (most accessible to least)
 */
export const VISIBILITY_ORDER: CSharpVisibility[] = [
  'public',
  'protected internal',
  'internal',
  'protected',
  'private protected',
  'private'
]

/**
 * Check if a C# element is considered "exported" (public or internal)
 */
export function isExported(visibility: CSharpVisibility): boolean {
  return visibility === 'public' || visibility === 'internal' || visibility === 'protected internal'
}

/**
 * Parse visibility from tree-sitter modifier nodes
 */
export function parseVisibility(modifiers: string[]): CSharpVisibility {
  const hasPublic = modifiers.includes('public')
  const hasPrivate = modifiers.includes('private')
  const hasProtected = modifiers.includes('protected')
  const hasInternal = modifiers.includes('internal')

  if (hasPublic) return 'public'
  if (hasPrivate && hasProtected) return 'private protected'
  if (hasProtected && hasInternal) return 'protected internal'
  if (hasProtected) return 'protected'
  if (hasInternal) return 'internal'
  if (hasPrivate) return 'private'

  // Default visibility in C# is internal for top-level types, private for members
  return 'private'
}

/**
 * Node types that represent type declarations (top-level constructs)
 */
export const TYPE_DECLARATION_NODES = [
  'class_declaration',
  'interface_declaration',
  'struct_declaration',
  'record_declaration',
  'enum_declaration',
  'delegate_declaration'
]

/**
 * Node types that represent member declarations
 */
export const MEMBER_DECLARATION_NODES = [
  'method_declaration',
  'property_declaration',
  'field_declaration',
  'constructor_declaration',
  'event_declaration',
  'indexer_declaration',
  'operator_declaration',
  'conversion_operator_declaration'
]

/**
 * .NET Framework namespace patterns (external dependencies)
 */
export const DOTNET_FRAMEWORK_NAMESPACES = [
  'System',
  'Microsoft',
  'Windows',
  'Newtonsoft',
  'NuGet',
  'EntityFramework',
  'NLog',
  'Serilog',
  'AutoMapper',
  'FluentValidation',
  'Dapper',
  'MediatR',
  'Polly',
  'Moq',
  'xUnit',
  'NUnit',
  'MSTest'
]

/**
 * Check if a namespace is from .NET Framework or common NuGet packages
 */
export function isFrameworkNamespace(namespace: string): boolean {
  return DOTNET_FRAMEWORK_NAMESPACES.some(
    prefix => namespace === prefix || namespace.startsWith(prefix + '.')
  )
}
