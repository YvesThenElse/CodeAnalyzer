# ReactAnalyzer

Générateur de diagrammes C4 interactifs pour projets React.

## Description

ReactAnalyzer est une application desktop qui analyse le code source d'un projet React et génère automatiquement des diagrammes C4 interactifs avec navigation par niveaux de zoom.

## Fonctionnalités

- **Analyse automatique** du code source React/TypeScript
- **4 niveaux C4** : System Context, Containers, Components, Code
- **Détection des systèmes externes** : APIs (fetch, axios), SDKs cloud (Firebase, AWS, Stripe), bases de données (Prisma, TypeORM, Mongoose)
- **Navigation interactive** : double-clic pour explorer, breadcrumb pour naviguer
- **Export** : PNG (image) et JSON (données structurées)
- **Performance** : Worker Thread pour l'analyse de gros projets

## Stack technique

- **Electron** - Application desktop cross-platform
- **React 18** - Interface utilisateur
- **TypeScript** - Typage statique
- **React Flow** - Visualisation des diagrammes
- **Zustand** - State management
- **@typescript-eslint/parser** - Parsing AST
- **dagre** - Layout automatique des nodes
- **Less** - Préprocesseur CSS

## Installation

```bash
# Cloner le repository
git clone <repository-url>
cd ReactAnalyzer

# Installer les dépendances
npm install
```

## Utilisation

### Développement

```bash
npm run dev
```

### Build de production

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Preview

```bash
npm run preview
```

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # Point d'entrée
│   ├── ipcHandlers.ts       # Handlers IPC
│   ├── fileAnalyzer.ts      # Scan des répertoires
│   ├── astParser.ts         # Parsing AST
│   ├── c4Builder.ts         # Construction modèle C4
│   └── workers/
│       └── analyzerWorker.ts
├── preload/
│   └── index.ts             # API sécurisée (contextBridge)
└── renderer/                # React app
    └── src/
        ├── components/
        │   ├── Controls/    # Header, Breadcrumb, ExportMenu
        │   └── Diagram/     # React Flow nodes et edges
        ├── hooks/           # useC4Navigation, useExport
        ├── store/           # Zustand store
        ├── styles/          # Variables LESS, styles C4
        ├── types/           # Types TypeScript
        └── utils/           # Utilitaires (layout)
```

## Niveaux C4

### Niveau 1 : System Context
- Application principale analysée
- Systèmes externes détectés (APIs, SDKs, bases de données)
- Acteurs/utilisateurs (si détectables)

### Niveau 2 : Containers
- Frontend (React SPA)
- Backend (si dossier server/api/backend présent)
- Electron Main Process
- Base de données (si ORM détecté)

### Niveau 3 : Components
- Modules/features regroupés par dossier
- Relations basées sur les imports

### Niveau 4 : Code
- Fonctions exportées
- Composants React
- Hooks customs

## Couleurs C4

| Type | Couleur |
|------|---------|
| Personne/Acteur | `#08427B` |
| Système principal | `#1168BD` |
| Système externe | `#999999` |
| Service cloud | `#DD8400` |
| Container | `#438DD5` |
| Component | `#85BBF0` |
| Code | `#FFFFFF` |

## Configuration

L'application mémorise automatiquement le dernier répertoire analysé.

### Répertoires ignorés
- `node_modules`
- `dist`
- `build`
- `.git`
- `coverage`
- `.next`
- `.cache`

### Extensions analysées
- `.ts`, `.tsx`
- `.js`, `.jsx`

## Détection automatique

### APIs HTTP
- `fetch()`
- `axios.get/post/put/delete()`
- `ky.get/post/put/delete()`

### SDKs Cloud
- Firebase (`firebase`, `@firebase/*`)
- AWS (`aws-sdk`, `@aws-sdk/*`)
- Stripe (`stripe`, `@stripe/*`)
- Supabase (`@supabase/*`)
- Twilio, SendGrid, Pusher

### ORMs/Bases de données
- Prisma (`@prisma/client`)
- TypeORM (`typeorm`)
- Mongoose (`mongoose`)
- Sequelize (`sequelize`)
- Drizzle (`drizzle-orm`)

## Raccourcis

| Action | Raccourci |
|--------|-----------|
| Zoom in/out | Molette souris |
| Pan | Clic gauche + glisser |
| Drill down | Double-clic sur un node |
| Sélection | Clic sur un node |

## Licence

MIT
