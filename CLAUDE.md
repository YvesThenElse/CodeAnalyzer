# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReactAnalyzer is an Electron + React + TypeScript application that analyzes React project source code and generates interactive C4 diagrams with zoom-level navigation.

## Tech Stack

- **Electron** (main process in TypeScript)
- **React 18+** with TypeScript (renderer process)
- **React Flow** for diagram visualization
- **@typescript-eslint/parser** or **@babel/parser** for AST parsing
- **Less** for styling (C4 diagram color variables)

## Architecture

```
/src
  /main                 # Electron main process
    index.ts
    fileAnalyzer.ts     # File system analysis
    astParser.ts        # AST code parsing
  /renderer             # React app
    /components
      /Diagram          # React Flow diagram components
      /Controls         # Header, Breadcrumb, ExportMenu
    /hooks              # useProjectAnalysis, useC4Navigation
    /types              # C4 types (System, Container, Component, Code)
    /utils              # Export utilities
/electron
  preload.ts            # Secure IPC bridge
```

## C4 Diagram Levels

1. **System Context** - Main app, users/actors, external systems (detected via fetch/axios/SDK imports)
2. **Containers** - Frontend, Backend, Electron Main, databases (via ORM imports), external services
3. **Components** - Features grouped by folder structure, with import-based relationships
4. **Code** - Exported functions, React components, custom hooks (names only)

## Key Implementation Notes

- Analysis ignores `node_modules`, `dist`, `build`, `.git`
- Use web workers for analyzing large projects
- Handle malformed file parsing gracefully
- Remember last analyzed directory
- Navigation: double-click to drill down, breadcrumb for navigation
- Export: PNG (image) and JSON (structured C4 data)
