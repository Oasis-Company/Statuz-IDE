# Statuz IDE

**Topology-Aware Development Environment**

<div align="center">

**Every codebase has a hidden topology — dependencies, data flows, ownership chains. Statuz IDE makes it visible, queryable, and actionable.**

</div>

---

## What is Statuz IDE?

Statuz IDE is a full-featured development environment built on VS Code, extended with the **Statuz Graph Engine** — a Rust-powered computational infrastructure for topological reasoning about software systems.

**The core thesis:** VS Code lets you edit code. Statuz IDE lets you *understand* it.

Every software project contains implicit graphs — module dependencies, service call chains, team ownership, responsibility delegation. These structures determine how changes propagate, where risks concentrate, and why things break. Traditional IDEs give you no way to see or query this topology. Statuz IDE closes that gap.

**Key principle: additive engineering.** Statuz IDE retains 100% of VS Code's capabilities — editor, terminal, debugger, Git, extension marketplace, language servers, settings sync, everything. The Statuz Graph Engine is layered on top as a new first-class capability, not a replacement.

---

## Three Primitive Queries

The Statuz Graph Engine provides three queries that cover all topological reasoning:

| Query | Question | Algorithm |
|-------|----------|-----------|
| `traverse(node, relation?)` | "What does this connect to?" | Adjacency list lookup |
| `impact(node)` | "If this changes, who is affected?" | Reverse BFS (blast radius) |
| `path(from, to)` | "How do I get from A to B?" | BFS shortest path |

Combined with the Cluster/Field/Bridge multi-layer architecture, these primitives form the computational foundation. The IDE adds a visual, queryable, and programmable interface for these graphs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Statuz IDE                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  VS Code Core (untouched — tracks upstream)                   │   │
│  │  Editor · Terminal · Debugger · Git · Extensions · Marketplace│   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               ▲                                      │
│                        additive layer                                │
│                               ▲                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Statuz Layer                                                 │   │
│  │  Graph Engine UI · Cluster Explorer · Query Console           │   │
│  │  Impact Analyzer · AI Assistant · .stz File Support           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               ▲                                      │
│                          napi-rs bridge                              │
│                               ▲                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Statuz Engine (Rust — separate repository)                   │   │
│  │  GraphEngine · Cluster · Field · Bridge · .stz Storage        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Python >= 3 (for node-gyp)
- Windows: Visual Studio Build Tools (MSVC)
- macOS: Xcode Command Line Tools
- Linux: build-essential, libx11-dev, libxkbfile-dev

### Build & Run

```bash
# Clone
git clone https://github.com/Oasis-Company/Statuz-IDE.git
cd Statuz-IDE

# Install dependencies
npm install

# Compile
npm run compile

# Launch
scripts/code.bat    # Windows
scripts/code.sh     # macOS / Linux
```

---

## Project Structure

```
Statuz-IDE/
├── src/vs/workbench/contrib/statuz/     # Statuz Layer (all new code)
│   ├── common/engine/                    #   Engine types, service interface, IPC protocol
│   ├── browser/                          #   React UI components (future)
│   └── electron-main/engine/            #   IPC channel (main process)
├── src/vs/code/electron-main/app.ts      # Channel registration
├── product.json                          # Branding & configuration
├── build/                                # Build tooling (gulp, tsb, esbuild)
├── extensions/                           # Built-in VS Code extensions
├── docs/                                 # Documentation
│   └── PHASE_1_DETAILED_PLAN.md          # Phase 1 implementation plan
└── STATUZ_IDE_ROADMAP.md                # Long-term development roadmap
```

---

## Current Status

**Phase 1 (Infrastructure) — In Progress**

- [x] Statuz branding (`product.json`, `package.json`)
- [x] Engine type definitions (15 interfaces mapping Rust structs)
- [x] IPC channel protocol definition (21 methods)
- [x] Service interface + stub implementation (DI-registered)
- [x] Electron main process IPC channel skeleton
- [x] Build system fixes (ansi-colors, policy-watcher, dependencies)
- [ ] Graph Engine UI (Cluster Explorer, Graph Visualizer, Query Console)
- [ ] .stz file association and rendering
- [ ] Rust engine integration via napi-rs

See [ROADMAP](./STATUZ_IDE_ROADMAP.md) and [Phase 1 Plan](./docs/PHASE_1_DETAILED_PLAN.md) for details.

---

## The Statuz Engine

The Rust graph engine is developed in a separate repository and is not yet integrated. It provides:

- **GraphEngine** — In-memory directed graph with adjacency list, supporting traverse/impact/path/centrality/health queries
- **Cluster** — Top-level container with centralized node registry + multiple Fields + Bridge edges
- **Field** — Named sub-graph representing different views of the same ecosystem
- **Storage** — `.stz` binary format (STZ magic + msgpack + blake3 hash)
- **Security** — argon2 password hashing, visibility levels (public/private/organization)

The engine will be integrated into Statuz IDE via napi-rs native modules when ready.

---

## Origin & License

Statuz IDE is a fork of [Void](https://github.com/voideditor/void), which is itself a fork of [VS Code](https://github.com/microsoft/vscode).

This project is licensed under the [MIT License](./LICENSE.txt). The VS Code portions are licensed under the [MIT License](./LICENSE-VS-Code.txt) as provided by Microsoft.

---

## Made by [Oasis Company](https://github.com/Oasis-Company)

Statuz IDE is designed and developed by Oasis Company. We believe that the next leap in developer tooling comes not from more AI autocomplete, but from making the hidden structures in software visible and computable.

- [Report an Issue](https://github.com/Oasis-Company/Statuz-IDE/issues/new)
- [Statuz Engine Repository](https://github.com/Oasis-Company/statuz)
