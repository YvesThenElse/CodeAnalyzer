# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeAnalyzer is an Electron + React + TypeScript application that analyzes React/TypeScript project source code and generates interactive dependency graphs with two navigation levels: Files and Code.

## Tech Stack

- **Electron** with **electron-vite** for build tooling
- **React 18+** with TypeScript (renderer process)
- **@xyflow/react** (React Flow) for interactive graph visualization
- **Zustand** for state management
- **dagre** for automatic graph layout
- **@typescript-eslint/typescript-estree** for AST parsing
- **Less** for styling with CSS variables

## Architecture

```
/src
  /main                       # Electron main process
    index.ts                  # Main entry, window management
    ipcHandlers.ts            # IPC communication handlers
    fileAnalyzer.ts           # File system traversal
    astParser.ts              # TypeScript/JSX AST parsing
    graphBuilder.ts           # Dependency graph construction
    communityDetection.ts     # Louvain algorithm for clustering
    /workers
      analyzerWorker.ts       # Background analysis worker

  /preload
    index.ts                  # Secure IPC bridge (contextBridge)

  /renderer/src               # React application
    App.tsx                   # Main app component
    main.tsx                  # React entry point

    /components
      /Diagram                # React Flow components
        DiagramView.tsx       # Main graph view with auto-centering
        FileNode.tsx          # File node with gradient colors
        CodeItemNode.tsx      # Code declaration node
        ImportEdge.tsx        # Import relationship edge

      /Controls
        Header.tsx            # App header with folder selection
        BackButton.tsx        # Navigation back button
        LoadingOverlay.tsx    # Loading indicator

      /Panels
        FileTreePanel.tsx     # Left sidebar file tree
        NodeDetailsPanel.tsx  # Right sidebar node details

      ErrorBoundary.tsx       # Error handling with copy-to-clipboard

    /store
      graphStore.ts           # Zustand store for graph state

    /hooks
      useGraphNavigation.ts   # Navigation logic (focus, drill-down)
      useExport.ts            # PNG/JSON export

    /types
      graph.types.ts          # Main types (FileNode, CodeItem, etc.)
      ast.types.ts            # AST parsing types
      electron.types.ts       # IPC API types

    /utils
      layoutUtils.ts          # dagre layout configuration
      graphUtils.ts           # Graph manipulation utilities
      colorUtils.ts           # HSL color utilities (gradients, contrast)

    /styles
      variables.less          # CSS variables
      main.less               # Global styles
      diagram.less            # Diagram styles
      controls.less           # Controls styles
```

## Graph Levels

1. **FILES** - Shows all project files as nodes with import relationships as edges
   - Click to select, double-click to drill down to CODE level
   - Files colored by root folder (HSL hues)
   - Shows import count, dependent count, declarations count

2. **CODE** - Shows declarations (functions, classes, components, hooks, types) inside a single file
   - Displays exported/private status
   - Shows function signatures

## Key Data Types

```typescript
// Main graph structure
interface AnalyzedGraph {
  files: Map<string, FileNode>
  relations: ImportRelation[]
  clusters: { folder: Cluster[], community: Cluster[] }
}

// File representation
interface FileNode {
  id: string              // relativePath as ID
  imports: FileImport[]   // Internal imports with resolved targetFileId
  externalImports: string[] // npm packages
  codeItems: CodeItem[]   // Declarations
  color: string           // HSL color based on folder
}

// Code declaration
interface CodeItem {
  name: string
  type: 'function' | 'class' | 'const' | 'react_component' | 'hook' | 'type' | 'interface'
  isExported: boolean
  isDefault: boolean
}
```

## Import Resolution

The `graphBuilder.ts` resolves imports in this order:
1. Relative paths (`./`, `../`)
2. Path aliases (`@/`, `@components/`, `~/`, etc.) - resolved to `src/` prefix
3. External packages (npm) - stored in `externalImports`

Common alias patterns supported:
- `@/` or `@src/` -> `src/`
- `@components/`, `@utils/`, `@hooks/`, etc. -> `src/<folder>/`
- `@renderer/`, `@main/` -> `src/renderer/`, `src/main/` (Electron)

## IPC Communication

Graph data is serialized for IPC transfer (Map -> Array) via:
- `serializeGraph()` in main process
- `deserializeGraph()` in renderer process

## Key Implementation Notes

- Analysis ignores `node_modules`, `dist`, `build`, `.git`, `.next`
- AST parsing handles malformed files gracefully with detailed error reporting
- Community detection uses Louvain algorithm for automatic file grouping
- Auto-centering on focused file with smooth animations
- ErrorBoundary provides "Copy for Claude Code" button for debugging

## Build Commands

```bash
npm run dev        # Development mode with hot reload
npm run build      # Build for production
npm run build:win  # Build Windows installer
npm run build:mac  # Build macOS installer
npm run build:linux # Build Linux installer
```
