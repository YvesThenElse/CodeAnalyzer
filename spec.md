# Spécifications : C4 Diagram Generator pour projets React

## Contexte du projet

Créer une application **Electron + React + TypeScript** qui analyse le code source d'un projet React et génère automatiquement des diagrammes C4 interactifs avec navigation par niveaux de zoom.

## Stack technique

- **Electron** (main process en TypeScript)
- **React 18+** avec TypeScript (renderer process)
- **React Flow** pour la visualisation des diagrammes
- **Node.js** pour l'analyse du système de fichiers
- Parser TypeScript/JavaScript : `@typescript-eslint/parser` ou `@babel/parser`

---

## Fonctionnalités principales

### 1. Sélection et analyse de projet

- Bouton "Sélectionner répertoire" ouvrant un dialog natif Electron
- Analyse récursive du code source uniquement (ignorer `node_modules`, `dist`, `build`, `.git`)
- Bouton "Refresh" pour relancer l'analyse sur le même répertoire
- Indicateur de chargement pendant l'analyse

### 2. Niveaux C4 à implémenter

#### Niveau 1 : System Context

Afficher :

- L'application analysée (centre)
- Les utilisateurs/acteurs (si détectables)
- Les systèmes externes détectés via :
  - Appels `fetch`, `axios`, `ky`, ou autres clients HTTP
  - Imports de SDK (Firebase, AWS SDK, Stripe, etc.)
  - Variables d'environnement pointant vers des URLs externes

> **Important** : Afficher dans l'interface un panneau latéral ou tooltip listant comment les systèmes externes ont été détectés (ex: "Détecté via: axios.get('/api/users') dans src/services/api.ts:42")

#### Niveau 2 : Containers

Identifier et afficher les containers du projet :

- **Frontend** : dossier contenant les composants React
- **Backend** : dossier serveur si présent (ex: `/server`, `/api`, `/backend`)
- **Electron Main Process** : fichiers main process
- Base de données si configurée (détection via ORM imports : Prisma, TypeORM, Mongoose)
- Services externes (repris du niveau 1)

#### Niveau 3 : Components

Pour chaque container, afficher les composants **regroupés par dossier/feature** :

- Analyser la structure des dossiers (ex: `/features/auth`, `/features/dashboard`)
- Chaque feature devient une boîte
- Les relations sont détectées via :
  - Les imports entre modules
  - L'utilisation de hooks partagés

#### Niveau 4 : Code

Pour chaque component/feature, afficher :

- Liste des fonctions exportées (nom uniquement)
- Liste des composants React (fonction ou classe)
- Liste des hooks customs
- Pas de détail d'implémentation

### 3. Navigation interactive

- **Double-clic** sur une boîte : zoom vers le niveau inférieur (drill-down)
- **Bouton "Back"** : remonter d'un niveau
- **Breadcrumb** affiché en haut : `System Context > Frontend > AuthModule > LoginForm`
- Clic sur un élément du breadcrumb pour naviguer directement

### 4. Interface utilisateur

```
┌─────────────────────────────────────────────────────────────────┐
│ [Sélectionner répertoire] [Refresh] [Export ▼]                  │
│ Breadcrumb...                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                    DIAGRAMME PLEIN ÉCRAN                        │
│                       (React Flow)                              │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Header fixe avec les contrôles
- Diagramme en plein écran (reste de l'espace)
- Zoom/pan natif de React Flow
- Minimap optionnelle en bas à droite

### 5. Export

Bouton dropdown "Export" avec options :

- **PNG** : export image du diagramme actuel
- **JSON** : export des données structurées C4

---

## Style des boîtes (conventions C4)

| Type | Couleur fond | Couleur bordure | Exemple |
|------|--------------|-----------------|---------|
| Personne/Acteur | `#08427B` (bleu foncé) | `#052E56` | "Personal Banking Customer" |
| Système principal | `#1168BD` (bleu) | `#0B4884` | "Internet Banking System" |
| Système externe | `#999999` (gris) | `#6B6B6B` | "Core Banking System" |
| Service cloud externe | `#DD8400` (orange) | `#B36D00` | "AWS SES", "Firebase" |
| Container Frontend | `#438DD5` (bleu clair) | `#2E6295` | "Single-Page Application" |
| Container Backend | `#438DD5` (bleu clair) | `#2E6295` | "API Application" |
| Container Database | `#438DD5` (bleu clair) | `#2E6295` | "Database" |
| Component | `#85BBF0` (bleu très clair) | `#5A9BD5` | "AuthModule" |
| Code/Fonction | `#FFFFFF` (blanc) | `#CCCCCC` | "handleLogin()" |

> Texte blanc sur fonds foncés, texte noir sur fonds clairs.
> utilise un fichier .less qui va contenir variables pour les styles CSS pour les diagrammes C4

---

## Contenu des boîtes

Chaque boîte affiche :

- **Nom** (titre en gras)
- **Description courte** (générée automatiquement) :
  - Système : "Application React analysée"
  - Container : "Frontend SPA - 45 composants"
  - Component : "Module d'authentification - 8 fichiers"
  - Code : "Fonction - exported"

---

## Relations (flèches)

- Style : flèches avec courbes (bezier)
- Labels sur les flèches décrivant la relation :
  - "imports"
  - "uses hook"
  - "calls API"
  - "sends email via"
- Couleur : gris foncé `#707070`

---

## Structure de fichiers suggérée

```
/src
  /main                 # Electron main process
    index.ts
    fileAnalyzer.ts     # Analyse du système de fichiers
    astParser.ts        # Parsing AST du code
  /renderer             # React app
    /components
      /Diagram
        DiagramView.tsx
        NodeTypes.tsx   # Custom nodes React Flow
        EdgeTypes.tsx
      /Controls
        Header.tsx
        Breadcrumb.tsx
        ExportMenu.tsx
    /hooks
      useProjectAnalysis.ts
      useC4Navigation.ts
    /types
      c4.types.ts       # Types C4 (System, Container, Component, Code)
    /utils
      exportUtils.ts
    App.tsx
    main.tsx
/electron
  preload.ts
```

---

## Contraintes importantes

1. **Analyse locale uniquement** : ne pas suivre les imports vers `node_modules`
2. **Performance** : utiliser des workers pour l'analyse de gros projets
3. **Robustesse** : gérer les erreurs de parsing gracieusement (fichiers malformés)
4. **Mémorisation** : garder en mémoire le chemin du dernier répertoire analysé

---

## Pour commencer

1. Initialiser le projet Electron avec electron-vite ou electron-forge
2. Configurer React + TypeScript pour le renderer
3. Installer React Flow et créer les custom nodes
4. Implémenter l'analyseur AST dans le main process
5. Connecter via IPC (preload secure)
6. Implémenter la navigation par niveaux
