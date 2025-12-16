# CodeAnalyzer

Interactive dependency graph viewer for TypeScript/JavaScript projects.

## Description

CodeAnalyzer is a desktop application that analyzes source code from TypeScript/JavaScript projects and generates interactive dependency graphs with multi-level navigation.

![Screenshot](images/screenshot.png)

## Features

- **Automatic Analysis** - Parses TypeScript/JavaScript/JSX/TSX files using AST
- **Two Navigation Levels**:
  - **Files Level** - Visualize file dependencies with import relationships
  - **Code Level** - Explore declarations inside a file (functions, classes, components, hooks, types)
- **Path Alias Resolution** - Supports common aliases (`@/`, `@components/`, `~/`, etc.)
- **Smart Coloring** - Files colored by folder with HSL gradients
- **Community Detection** - Automatic grouping using Louvain algorithm
- **File Tree Panel** - Browse project structure with quick navigation
- **Details Panel** - View file imports, exports, and code declarations
- **Auto-centering** - Smooth camera transitions when navigating

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Electron](https://www.electronjs.org/) | Cross-platform desktop app |
| [electron-vite](https://electron-vite.org/) | Build tooling with HMR |
| [React 18](https://react.dev/) | User interface |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [@xyflow/react](https://reactflow.dev/) | Graph visualization |
| [Zustand](https://zustand-demo.pmnd.rs/) | State management |
| [dagre](https://github.com/dagrejs/dagre) | Automatic graph layout |
| [@typescript-eslint/typescript-estree](https://typescript-eslint.io/) | AST parsing |
| [Less](https://lesscss.org/) | CSS preprocessing |

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd CodeAnalyzer

# Install dependencies
npm install
```

## Usage

### Development

```bash
npm run dev
```

### Production Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Preview Production Build

```bash
npm run preview
```

## Architecture

```
src/
├── main/                        # Electron main process
│   ├── index.ts                 # Entry point, window management
│   ├── ipcHandlers.ts           # IPC communication handlers
│   ├── fileAnalyzer.ts          # File system traversal
│   ├── astParser.ts             # TypeScript/JSX AST parsing
│   ├── graphBuilder.ts          # Dependency graph construction
│   ├── communityDetection.ts    # Louvain clustering algorithm
│   └── workers/
│       └── analyzerWorker.ts    # Background analysis worker
│
├── preload/
│   └── index.ts                 # Secure IPC bridge (contextBridge)
│
└── renderer/src/                # React application
    ├── App.tsx                  # Main app component
    ├── components/
    │   ├── Diagram/             # React Flow components
    │   │   ├── DiagramView.tsx  # Main graph view
    │   │   ├── FileNode.tsx     # File node component
    │   │   ├── CodeItemNode.tsx # Code declaration node
    │   │   └── ImportEdge.tsx   # Import relationship edge
    │   ├── Controls/            # Header, BackButton, LoadingOverlay
    │   └── Panels/              # FileTreePanel, NodeDetailsPanel
    ├── store/                   # Zustand state management
    ├── hooks/                   # Custom React hooks
    ├── types/                   # TypeScript type definitions
    ├── utils/                   # Utility functions
    └── styles/                  # Less stylesheets
```

## Supported File Types

| Extension | Status |
|-----------|--------|
| `.ts` | Supported |
| `.tsx` | Supported |
| `.js` | Supported |
| `.jsx` | Supported |

## Path Alias Resolution

CodeAnalyzer automatically resolves common path aliases:

| Alias Pattern | Resolves To |
|---------------|-------------|
| `@/` | `src/` |
| `@components/` | `src/components/` |
| `@utils/`, `@hooks/`, `@stores/` | `src/<folder>/` |
| `@renderer/`, `@main/` | `src/renderer/`, `src/main/` |
| `~/` | `src/` |
| `#/` | `src/` |

## Ignored Directories

The analyzer skips these directories:
- `node_modules`
- `dist`, `build`, `out`
- `.git`, `.svn`
- `.next`, `.nuxt`
- `coverage`
- `.cache`

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Zoom in/out | Mouse wheel |
| Pan | Left click + drag |
| Drill down | Double-click on node |
| Select node | Single click |
| Back | Back button or breadcrumb |

## Roadmap

### Phase 1 - Core Improvements
- [ ] Parse and read `tsconfig.json` / `jsconfig.json` for accurate path alias resolution
- [ ] Support `baseUrl` and `paths` configuration
- [ ] Improve error handling for malformed files
- [ ] Add search/filter functionality in file tree
- [ ] Add platform-specific binaries (Windows, macOS, Linux)
- [ ] Improve code level display

### Phase 2 - Framework Support
- [ ] **Angular** - Support for Angular modules, components, services, and dependency injection
- [ ] **Vue.js** - Parse `.vue` single-file components (SFC)
- [ ] **Svelte** - Parse `.svelte` components
- [ ] **Next.js** - Understand App Router and Pages Router conventions
- [ ] **Nuxt** - Support Nuxt directory structure and auto-imports

### Phase 3 - Language Support
- [ ] **Pure JavaScript** - Improve CommonJS (`require`/`module.exports`) support
- [ ] **ES Modules** - Better handling of dynamic imports
- [ ] **JSON imports** - Track JSON file dependencies
- [ ] **CSS/SCSS imports** - Visualize style dependencies

### Phase 4 - Advanced Features
- [ ] **Circular dependency detection** - Highlight and warn about circular imports
- [ ] **Dead code detection** - Find unused exports
- [ ] **Bundle impact analysis** - Estimate file sizes and import costs
- [ ] **Git integration** - Show recently modified files, blame info
- [ ] **Diff view** - Compare dependency graphs between commits/branches

### Phase 5 - Export & Integration
- [ ] **PNG/SVG export** - High-quality image export
- [ ] **JSON export** - Structured graph data for external tools
- [ ] **Mermaid export** - Generate Mermaid diagram syntax
- [ ] **CI/CD integration** - CLI mode for automated analysis
- [ ] **VS Code extension** - Integrate directly into the editor

### Phase 6 - Collaboration
- [ ] **Project presets** - Save and share analysis configurations
- [ ] **Annotations** - Add notes to files and relationships
- [ ] **Report generation** - Create documentation from analysis

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run the app in dev mode: `npm run dev`
5. Commit your changes: `git commit -m 'Add my feature'`
6. Push to the branch: `git push origin feature/my-feature`
7. Open a Pull Request

## License

This project is licensed under the **GNU General Public License v3.0** (GPLv3).

See the [LICENSE](LICENSE) file for details.

```
CodeAnalyzer - Interactive dependency graph viewer
Copyright (C) 2024

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
```
