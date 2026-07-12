# Statuz IDE — Long-Term Development Plan

> **Document Status:** Draft for Team Review
> **Last Updated:** 2026-07-12
> **Repository:** https://github.com/Oasis-Company/Statuz-IDE
> **Engine Repository:** `D:\github projects\statuz` (statuz-core, Rust)

---

## 1. Vision Statement

**Statuz IDE = VS Code + Statuz Graph Engine.**

We do additive engineering, not replacement. Statuz IDE retains 100% of VS Code's capabilities — editor, terminal, debugger, Git, extension marketplace, language servers, settings sync, everything. The Statuz Graph Engine is layered on top as a new first-class capability, the same way Git support or the terminal were added to VS Code over time.

The core thesis: every software project has a hidden topology — dependencies, data flows, ownership, responsibility chains. VS Code lets you edit the code but gives you no way to see or query that topology. Statuz IDE closes that gap.

The Statuz Graph Engine (Rust) provides three primitive queries that answer all topological reasoning needs:

| Query | Question | Algorithm |
|-------|----------|-----------|
| `traverse(node, relation?)` | "What does this connect to?" | Adjacency list lookup |
| `impact(node)` | "If this changes, who is affected?" | Reverse BFS (blast radius) |
| `path(from, to)` | "How do I get from A to B?" | BFS shortest path |

These three queries, combined with the Cluster/Field/Bridge multi-layer architecture, form the computational foundation. The IDE adds a visual, queryable, and programmable interface for these graphs — alongside the full VS Code experience the user already knows.

---

## 2. Current State Assessment

### 2.1 Statuz-IDE (this repository)

**Origin:** Fork of Void (itself a fork of VS Code).

**What exists:**
- Brand replacement: `product.json`, `package.json` updated to Statuz branding (partially complete — React component paths still being migrated).
- Directory structure: `src/vs/workbench/contrib/statuz/` contains the former Void AI assistant features (chat, inline edit, autocomplete, settings, MCP integration).
- React components: Sidebar, Settings, Onboarding, Editor Widgets, Quick Edit — all inherited from Void, with `void-` prefixes being migrated to `statuz-`.
- Electron main process: LLM message channel, MCP channel, SCM service, update service.
- Build system: tsup for React components, scope-tailwind for CSS isolation, gulp for VS Code compilation.

**What's missing:**
- No connection to the Rust graph engine.
- No `.stz` file support.
- No graph visualization UI.
- No query console.
- The AI assistant features are positioned as the primary product, not as tools serving the graph engine.

### 2.2 Statuz Engine (`D:\github projects\statuz`)

**Rust Core (`crates/statuz-core/`):**

| Component | Status | Description |
|-----------|--------|-------------|
| `GraphEngine` | Stable | In-memory directed graph with adjacency list. Supports add/remove nodes/edges, traverse, impact (reverse BFS), path (BFS), centrality, reachable, health report. |
| `Cluster` | Stable | Top-level container. Centralized node registry + multiple Fields + bidirectional Bridge edges. Cross-field traversal, impact, and path queries. |
| `Field` | Stable | Named sub-graph with its own GraphEngine instance. Represents different "views" of the same ecosystem. |
| `Storage` | Stable | `.stz` binary format: `STZ\0` magic (4B) + version (2B) + flags (2B) + msgpack content + blake3 hash (32B). Serialize, deserialize, verify, JSON export. |
| `Sharing` | Stable | Clone with options (reset password/timestamps), merge with strategies (skip/overwrite/rename/merge-meta). |
| `Security` | Stable | argon2 password hashing, visibility levels (public/private/organization). |

**TypeScript SDK (`packages/sdk-ts/`):**
- YAML-based Statuz document read/write/validate (older design, predates Rust engine).
- Niche layer: manifest, context, signal, assessment, calibration, outcome.
- SYN layer: human governance request/resolution.
- Arrow Map (66) layer: topological abstraction with proposals.
- Calibration engine: drift detection.
- Lease manager: time-boxed responsibility.
- User action tracker.

**Other packages:**
- `packages/cli/`: CLI tool for statuz init/validate/resume + niche/syn/arrow-map/bus commands.
- `packages/mcp-server/`: MCP server exposing 20+ statuz tools.
- `packages/signal-bus/`: HTTP-based signal transport, agent registry, discovery.
- `packages/vscode-extension/`: Standalone VS Code extension (will be absorbed into Statuz IDE).

**Engine Roadmap Status (from `leftover/ROADMAP.md`):**
- 0.1–0.4: Core protocol, CLI, SDK, MCP server — all stable.
- 0.5–0.9: Niche/SYN/Calibration schemas — working drafts, schemas complete.
- 1.0: Stable protocol — in progress.
- 1.1: Ecosystem architecture (Arrow Map Cluster, Status Keeper) — in progress.
- **Rust engine (`statuz-core`)** is the newest layer, not yet integrated with any IDE.

---

## 3. Target Architecture

**Design philosophy: additive layering.** Statuz IDE is VS Code with an additional Statuz layer. We do not fork VS Code's core features — we extend them. All changes live in `contrib/statuz/` and configuration files. The VS Code core (editor, terminal, debugger, Git, extensions, language servers) remains untouched and tracks upstream.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Statuz IDE                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  VS Code Core (UNTOUCHED — tracks upstream)                   │   │
│  │                                                                │   │
│  │  Editor · Terminal · Debugger · Git · Extensions              │   │
│  │  Language Servers · Settings Sync · Marketplace · Search      │   │
│  │  Command Palette · Keybindings · Themes · Snippets            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               ▲                                      │
│                        extends (additive)                            │
│                               ▲                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Statuz Layer (NEW — all in contrib/statuz/)                  │   │
│  │                                                                │   │
│  │                                                                │   │
│  │  ┌─────────────────────┐  ┌─────────────────────────────┐    │   │
│  │  │ Graph Engine UI     │  │ AI Assistant (from Void)     │    │   │
│  │  │                     │  │                              │    │   │
│  │  │ ┌─────────────────┐ │  │ ┌──────────┐ ┌───────────┐ │    │   │
│  │  │ │ Cluster         │ │  │ │ Chat     │ │ Inline    │ │    │   │
│  │  │ │ Explorer        │ │  │ │ Sidebar  │ │ Edit      │ │    │   │
│  │  │ │ (sidebar)       │ │  │ └──────────┘ └───────────┘ │    │   │
│  │  │ └─────────────────┘ │  │ ┌──────────┐ ┌───────────┐ │    │   │
│  │  │ ┌─────────────────┐ │  │ │ Auto-    │ │ MCP       │ │    │   │
│  │  │ │ Graph           │ │  │ │ complete │ │ Server    │ │    │   │
│  │  │ │ Visualizer      │ │  │ └──────────┘ └───────────┘ │    │   │
│  │  │ │ (editor panel)  │ │  │                              │    │   │
│  │  │ └─────────────────┘ │  │ AI serves graph engine:      │    │   │
│  │  │ ┌─────────────────┐ │  │  "what depends on this?"     │    │   │
│  │  │ │ Query Console   │ │  │   → impact() query           │    │   │
│  │  │ │ (bottom panel)  │ │  │  "relationship between A/B?" │    │   │
│  │  │ └─────────────────┘ │  │   → path() query             │    │   │
│  │  │ ┌─────────────────┐ │  └──────────────────────────────┘    │   │
│  │  │ │ Impact Analyzer │ │                                       │   │
│  │  │ │ (panel)         │ │  ┌──────────────────────────────┐    │   │
│  │  │ └─────────────────┘ │  │ .stz File Association        │    │   │
│  │  │ ┌─────────────────┐ │  │ (custom editor provider)     │    │   │
│  │  │ │ Health Dashboard│ │  └──────────────────────────────┘    │   │
│  │  │ │ (panel)         │ │                                       │   │
│  │  │ └─────────────────┘ │                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               ▲                                      │
│                          IPC (electron)                              │
│                               ▲                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Statuz Service Layer (TypeScript — in contrib/statuz/)       │   │
│  │                                                                │   │
│  │  IStatuzEngineService                                          │   │
│  │    ├── createCluster / loadCluster / saveCluster              │   │
│  │    ├── registerNode / unregisterNode / createField           │   │
│  │    ├── addEdge / addBridge                                    │   │
│  │    ├── traverse / impact / path / centrality / health        │   │
│  │    ├── cloneCluster / mergeClusters                          │   │
│  │    └── exportJSON / verifyStzFile                            │   │
│  │                                                                │   │
│  │  IStatuzFileService (file association, .stz handling)         │   │
│  │  IGraphRenderService (layout computation, Cytoscape bridge)   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               ▲                                      │
│                          napi-rs (FFI)                               │
│                               ▲                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Native Engine Layer (Rust — in statuz/crates/statuz-core/)   │   │
│  │                                                                │   │
│  │  statuz-core (compiled to Node.js native addon via napi-rs)   │   │
│  │    ├── GraphEngine (adjacency list, BFS, reverse BFS)        │   │
│  │    ├── Cluster (multi-field, bridges, cross-field queries)   │   │
│  │    ├── Storage (.stz binary: msgpack + blake3)               │   │
│  │    └── Sharing (clone, merge, password, visibility)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  AI Assistant Layer (inherited from Void, repositioned)       │   │
│  │                                                                │   │
│  │  Capabilities (serve the graph engine, not replace it):       │   │
│  │    ├── "Analyze this project's dependency structure" → build │   │
│  │    ├── "If I delete this file, who's affected?" → impact()   │   │
│  │    ├── "What's the relationship between A and B?" → path()   │   │
│  │    ├── "Check graph integrity" → health()                    │   │
│  │    └── Auto-infer nodes/edges from code structure            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Architecture Principles

1. **Additive only:** Statuz IDE = VS Code + Statuz. All Statuz code lives in `contrib/statuz/`. VS Code core files are modified only for brand identity (product.json, package.json) and file association registration. No VS Code feature is removed or disabled.
2. **Upstream compatibility:** Statuz IDE must be able to merge any VS Code upstream release without manual conflict resolution beyond `contrib/statuz/` and brand files.
3. **Engine-first for graph logic:** The Rust engine is the source of truth for all graph operations. TypeScript only calls and renders — no graph algorithms in the UI layer.
4. **File-native:** `.stz` files are first-class citizens — double-click to open, drag to share, diff to compare.
5. **Query-driven UI:** Every graph visualization is backed by an explicit engine query (`traverse`, `impact`, `path`, `health`). No hidden state.
6. **AI as servant, not master:** The AI assistant executes engine commands; it does not maintain its own graph model.
7. **Incremental migration:** The existing Void AI features remain functional throughout the transition. No big-bang rewrite.

---

## 4. Phased Roadmap

### Phase 0: Brand Shell Completion (Current — ~70% done)

**Goal:** Complete the Void → Statuz brand replacement so the IDE builds and runs as "Statuz IDE."

| Task | Status | Notes |
|------|--------|-------|
| `product.json` brand fields | Done | nameShort, nameLong, applicationName, bundleId, urlProtocol |
| `package.json` metadata | Done | name, repository, bugs, scripts |
| Directory rename `contrib/void` → `contrib/statuz` | Done | |
| Internal code references `void` → `statuz` | In Progress | Service identifiers, type names, CSS scopes |
| React component path migration (`void-*` → `statuz-*`) | In Progress | tsup.config.js entries, build.js scope-tailwind prefixes |
| Icon replacement | Done | SVG → ICO/PNG conversion |
| `.voidrules` → `.statuzrules` | Done | |
| TSC type check pass | Blocked | Pre-existing type errors in original Void code |
| First successful boot | Pending | Requires native module compilation in real terminal |

**Exit Criteria:** `npm run buildreact && npm run compile && ./scripts/code.sh` launches "Statuz IDE" with functional AI sidebar.

---

### Phase 1: Rust Engine Integration (Foundation)

**Goal:** The Rust graph engine runs inside the IDE process. TypeScript code can call `traverse`, `impact`, `path` directly.

#### 1.1 napi-rs Native Module

**What:** Compile `statuz-core` into a Node.js native addon.

**Approach:**
```
statuz/crates/statuz-core/
  └── napi/                    # New napi-rs wrapper crate
        ├── Cargo.toml         # depends on statuz-core + napi
        ├── lib.rs             # #[napi] wrappers for Cluster, GraphEngine
        └── build.rs
```

**Wrapped API surface (Phase 1 minimal):**
```rust
#[napi]
pub fn create_cluster(name: String, visibility: String) -> ClusterHandle;

#[napi]
pub fn load_stz_file(path: String) -> Result<ClusterHandle, Error>;

#[napi]
pub fn save_stz_file(handle: &ClusterHandle, path: String) -> Result<(), Error>;

#[napi]
pub fn register_node(handle: &ClusterHandle, node: NodeInput) -> Result<(), Error>;

#[napi]
pub fn create_field(handle: &ClusterHandle, id: String, name: String) -> Result<(), Error>;

#[napi]
pub fn add_edge(handle: &ClusterHandle, field_id: String, edge: EdgeInput) -> Result<(), Error>;

#[napi]
pub fn add_bridge(handle: &ClusterHandle, from_field: String, to_field: String,
                  source: String, target: String, desc: String, weight: f64) -> Result<(), Error>;

#[napi]
pub fn traverse(handle: &ClusterHandle, field_id: String, node_id: String,
                relation: Option<String>, cross_field: bool) -> TraverseResult;

#[napi]
pub fn impact(handle: &ClusterHandle, node_id: String) -> ImpactResult;

#[napi]
pub fn path(handle: &ClusterHandle, from: String, to: String, cross_field: bool) -> PathResult;

#[napi]
pub fn health(handle: &ClusterHandle, field_id: String) -> HealthResult;

#[napi]
pub fn cluster_info(handle: &ClusterHandle) -> ClusterInfo;
```

**Build targets:** Windows x64, macOS x64/arm64, Linux x64/arm64.

**Deliverable:** `@statuz/engine-native` npm package, importable from Electron main process.

#### 1.2 IStatuzEngineService

**File:** `src/vs/workbench/contrib/statuz/common/engine/statuzEngineService.ts`

```typescript
export interface IStatuzEngineService {
    readonly _serviceBrand: undefined;

    // Cluster lifecycle
    createCluster(name: string, visibility: 'public' | 'private' | 'organization'): Promise<ClusterHandle>;
    loadCluster(path: string): Promise<ClusterHandle>;
    saveCluster(handle: ClusterHandle, path: string): Promise<void>;
    verifyStzFile(path: string): Promise<boolean>;

    // Node & Field management
    registerNode(handle: ClusterHandle, node: NodeInput): Promise<void>;
    createField(handle: ClusterHandle, id: string, name: string, description?: string): Promise<void>;
    addEdge(handle: ClusterHandle, fieldId: string, edge: EdgeInput): Promise<void>;
    addBridge(handle: ClusterHandle, fromField: string, toField: string,
              source: string, target: string, desc: string, weight: number): Promise<void>;

    // Queries
    traverse(handle: ClusterHandle, fieldId: string, nodeId: string,
             relation?: string, crossField?: boolean): Promise<TraverseResult>;
    impact(handle: ClusterHandle, nodeId: string): Promise<ImpactResult>;
    path(handle: ClusterHandle, from: string, to: string, crossField: boolean): Promise<PathResult>;
    centrality(handle: ClusterHandle, fieldId: string, limit: number): Promise<string[]>;
    health(handle: ClusterHandle, fieldId: string): Promise<HealthResult>;

    // Cluster info
    clusterInfo(handle: ClusterHandle): Promise<ClusterInfo>;

    // Sharing
    cloneCluster(handle: ClusterHandle, options: CloneOptions): Promise<ClusterHandle>;
    mergeClusters(target: ClusterHandle, source: ClusterHandle, strategy: MergeStrategy): Promise<MergeResult>;
}
```

#### 1.3 IPC Channel

**File:** `src/vs/workbench/contrib/statuz/electron-main/engine/statuzEngineChannel.ts`

Electron main process holds the native module reference. Renderer process calls via IPC.

**Exit Criteria:** From the Developer Tools console in Statuz IDE, an engineer can execute:
```javascript
const svc = window.statuz.engine;
const cluster = await svc.createCluster('demo', 'private');
await svc.registerNode(cluster, { id: 'svc-a', type: 'service', label: 'Service A', status: 'active' });
await svc.registerNode(cluster, { id: 'svc-b', type: 'service', label: 'Service B', status: 'active' });
await svc.createField(cluster, 'arch', 'Architecture');
await svc.addEdge(cluster, 'arch', { id: 'e1', source: 'svc-a', target: 'svc-b', relation: 'depends_on', weight: 1.0, description: 'A depends on B' });
const result = svc.traverse(cluster, 'arch', 'svc-a', null, false);
console.log(result); // → { nodes: ['svc-b'], edges: [...] }
```

---

### Phase 2: Core Graph UI

**Goal:** The IDE has a visual interface for clusters, fields, nodes, edges, and queries.

#### 2.1 Cluster Explorer (Sidebar)

**Location:** Activity Bar → Statuz icon (added alongside existing VS Code activity bar icons like Explorer, Search, Git). Does not replace any existing view.

**Views:**
- **Cluster selector:** Active cluster dropdown + "Open .stz file" button.
- **Field tree:** Hierarchical view of Fields → Nodes → Edges.
- **Node inspector:** Click a node to see type, status, meta, incoming/outgoing edges.
- **Quick actions:** Add node, add edge, create field, add bridge (context menus).

**File:** `src/vs/workbench/contrib/statuz/browser/engine/clusterExplorerView.ts`

#### 2.2 Graph Visualizer (Custom Editor Panel)

**What:** A custom editor (registered via VS Code's `CustomEditorProvider` API) that opens `.stz` files as interactive graphs. This is the same mechanism VS Code uses for binary file viewers — it coexists with the standard text editor, not replaces it.

**Technology decision (see Section 5):** Cytoscape.js.

**Features:**
- Force-directed layout with field-based grouping.
- Node color by status (active=green, dormant=gray, blocked=red, done=blue, planned=yellow).
- Edge style by relation (solid=depends_on, dashed=consumes, dotted=informs, double=bridges).
- Click node → highlight connected edges.
- Shift+click node → run `impact()` and highlight affected nodes in red.
- Select two nodes → run `path()` and highlight shortest path.
- Field toggle: show/hide individual fields.
- Bridge visualization: cross-field edges rendered as curved connectors with field labels.
- Zoom/pan, minimap, search by node label.

**File:** `src/vs/workbench/contrib/statuz/browser/engine/graphVisualizer.ts`

#### 2.3 Query Console (Bottom Panel)

**What:** A REPL-like panel for ad-hoc graph queries.

**Interface:**
```
statuz> traverse("api-gateway", "depends_on", false)
→ [auth-service, orchestrator]

statuz> impact("payment-service")
→ 3 nodes affected: [notification-service, orchestrator, api-gateway]
→ Critical path: YES

statuz> path("api-gateway", "db-primary", false)
→ Found (2 steps): api-gateway → auth-service → db-primary

statuz> health("system-arch")
→ 7 nodes, 5 edges, 0 orphans, 1 sink, 1 component
→ Top centrality: orchestrator (degree: 4)
```

**File:** `src/vs/workbench/contrib/statuz/browser/engine/queryConsole.ts`

#### 2.4 Impact Analyzer (Dedicated Panel)

**What:** A specialized view for blast-radius analysis.

**Layout:**
- Left: node selector (searchable tree).
- Center: graph with affected nodes highlighted in concentric rings (by BFS depth).
- Right: affected nodes list (sorted by distance), with "jump to node" links.
- Bottom: critical path indicator + recommendation text.

**File:** `src/vs/workbench/contrib/statuz/browser/engine/impactAnalyzer.ts`

#### 2.5 .stz File Association

**What:** Double-clicking a `.stz` file in the file explorer opens it as a Cluster in the Graph Visualizer.

**Implementation:**
- Register `.stz` file extension in VS Code's file association system.
- Custom editor provider that reads the binary file, calls `loadCluster()`, and renders the graph.
- "Save" writes back to `.stz` via `saveCluster()`.
- "Export to JSON" option for debugging.

**File:** `src/vs/workbench/contrib/statuz/browser/engine/stzFileEditor.ts`

**Exit Criteria:** An engineer can open a `.stz` file, see the graph, run queries in the console, and visualize impact analysis — all without leaving the IDE.

---

### Phase 3: AI Integration

**Goal:** The AI assistant (inherited from Void) is repositioned to serve the graph engine.

#### 3.1 Graph-Aware AI Commands

The AI assistant gains new system commands that map directly to engine queries:

| User says | AI executes | Engine call |
|-----------|-------------|-------------|
| "What depends on this file?" | `impact(selectedFile)` | `impact(nodeId)` |
| "How does this module connect to that module?" | `path(fileA, fileB)` | `path(from, to)` |
| "Show me the dependency graph of this project" | Auto-build from imports | `registerNode` + `addEdge` (batch) |
| "Check graph health" | `health(activeField)` | `health(fieldId)` |
| "What are the most critical nodes?" | `centrality(field, 10)` | `centrality(limit)` |

#### 3.2 Auto-Graph-Builder

**What:** A service that scans the workspace's code structure and automatically builds/maintains a Cluster.

**Inference rules (Phase 3a — file/module level):**
- Node per file (type: `file`).
- Edge `depends_on` per import/require statement.
- Edge `contains` per directory → file relationship.
- Node status from git status (modified = active, committed = done, untracked = planned).

**Inference rules (Phase 3b — semantic level):**
- Node per function/class (type: `function` / `class`).
- Edge `produces` / `consumes` for function return types and parameters.
- Edge `validates` for test files → source files.
- Edge `delegates_to` for function call chains.

**File:** `src/vs/workbench/contrib/statuz/browser/engine/autoGraphBuilder.ts`

#### 3.3 Context Bridge

**What:** The AI chat automatically includes graph context in its prompts.

When the user asks the AI a question, the system automatically:
1. Identifies the active file as a node in the graph.
2. Runs `traverse(activeFile, null, false)` to find immediate dependencies.
3. Runs `impact(activeFile)` to find what would be affected by changes.
4. Includes this context in the LLM prompt.

This makes the AI "graph-aware" without explicit user commands.

**File:** Modified `src/vs/workbench/contrib/statuz/browser/chatThreadService.ts`

**Exit Criteria:** An engineer can ask "if I refactor this function, what breaks?" and the AI responds with an accurate impact analysis backed by actual graph queries.

---

### Phase 4: Advanced Features

#### 4.1 Cluster Health Dashboard

**What:** A dashboard view showing graph health metrics over time.

**Metrics:**
- Node/edge count trends.
- Orphan node detection (nodes with no connections — potential dead code).
- Sink/source analysis (nodes that only receive or only send).
- Disconnected component count (isolated sub-graphs).
- Centrality distribution (identifying single points of failure).
- Field coverage (which fields have the most/least edges).

**File:** `src/vs/workbench/contrib/statuz/browser/engine/healthDashboard.ts`

#### 4.2 Cross-Field Bridge Visualization

**What:** Visual representation of bridges between Fields.

- Side-by-side field panels with bridge connectors.
- Click a bridge to traverse across fields.
- "Follow bridge" mode: animates the path from one field to another.

#### 4.3 Cluster Clone & Merge UI

**What:** Visual interface for the sharing primitives.

- Clone dialog: name, password, keep timestamps options.
- Merge dialog: select source cluster, choose strategy (skip/overwrite/rename/merge-meta), preview changes, execute.
- Diff view: compare two clusters side-by-side (nodes added/removed/modified, edges changed).

#### 4.4 Multi-Cluster Workspace

**What:** Support for multiple clusters in a single workspace.

- Cluster switcher in the sidebar.
- Cross-cluster search (find a node across all open clusters).
- Cluster templates (pre-built graphs for common architectures: microservice, monolith, serverless).

#### 4.5 Time-Travel (Future)

**What:** Track graph changes over time and replay history.

- Each save creates a snapshot (content-addressed via blake3).
- Timeline UI to scrub through graph states.
- "What changed between v1 and v2?" diff query.

---

### Phase 5: Ecosystem

#### 5.1 MCP Server Integration (In-Process)

**What:** The MCP server tools (`packages/mcp-server/`) are registered directly in the IDE's MCP service, not as an external process.

This allows external AI tools (Claude, Cursor, etc.) to query the graph engine via MCP when connected to Statuz IDE.

#### 5.2 Signal Bus Integration

**What:** The Signal Bus (`packages/signal-bus/`) runs as an in-process HTTP server.

- Other agents/tools can register and send signals.
- Graph changes emit signals automatically.
- Multi-agent collaboration: when Agent A modifies a node, Agent B receives a signal and can run `impact()` to check if it affects them.

#### 5.3 .stz File Format Standardization

**What:** Publish the `.stz` binary format as an open standard.

- Format specification document.
- Reference implementations in Rust (canonical), TypeScript, Python.
- File format versioning and migration strategy.
- Integration with git: `.stz` files are diff-friendly via JSON export.

#### 5.4 Cluster Registry (Future)

**What:** A registry for sharing public clusters.

- Upload/download public clusters (like Docker Hub for graphs).
- Organization-private registries.
- Cluster versioning and provenance tracking.

---

## 5. Technical Decision Matrix

| Decision | Options | Recommendation | Rationale |
|----------|---------|----------------|-----------|
| **Rust → Node.js bridge** | A) napi-rs<br>B) WASM<br>C) Child process + IPC | **A) napi-rs** | Direct FFI, zero-copy for large graphs, synchronous calls possible. WASM adds overhead for serialization. Child process adds latency. |
| **Graph visualization library** | A) Cytoscape.js<br>B) D3-force<br>C) vis-network<br>D) Custom WebGL | **A) Cytoscape.js** | Purpose-built for graph visualization, built-in layouts, performant up to 10k nodes, extensible, MIT license. |
| **Layout algorithm** | A) Force-directed (Cytoscape built-in)<br>B) Hierarchical (dagre)<br>C) Concentric<br>D) Manual | **A+B** | Force-directed for exploration, hierarchical for dependency trees, user-switchable. |
| **.stz file editing** | A) Custom editor (binary)<br>B) JSON proxy<br>C) Text-based format | **A) Custom editor** | Binary format is core to the design (msgpack + blake3). Custom editor reads binary, renders as graph. JSON export for debugging only. |
| **TypeScript SDK future** | A) Deprecate entirely<br>B) Keep as compatibility layer<br>C) Migrate to Rust | **B) Keep as compat layer** | The YAML-based SDK (niche, SYN, calibration) serves a different purpose (agent runtime status, not graph topology). Long-term, migrate to Rust, but not blocking. |
| **Existing Void AI features** | A) Remove all<br>B) Keep all, reposition<br>C) Keep core, remove extras | **B) Keep all, reposition** | Chat, inline edit, autocomplete are valuable when repositioned as graph-serving tools. Removing them would waste existing work. |
| **VS Code Extension package** | A) Absorb into IDE<br>B) Keep as standalone<br>C) Deprecate | **A) Absorb** | The extension's features (validation, tree view, SYN decision view) become native IDE features. Standalone extension serves users who don't want the full IDE. |
| **State management** | A) VS Code built-in (services)<br>B) External (Redux/Zustand)<br>C) Reactive (RxJS) | **A) VS Code services** | Consistent with VS Code architecture, leverages existing DI system, no extra dependencies. React components use VS Code's context bridge. |

---

## 6. Architecture Constraints & Principles

### 6.1 Hard Constraints

1. **No VS Code feature removal.** Statuz IDE retains 100% of VS Code's capabilities. We add, we never remove. The editor, terminal, debugger, Git, extensions, marketplace, language servers, settings sync — all remain fully functional and untouched.
2. **No VS Code core modifications beyond brand.** All Statuz logic lives in `contrib/statuz/`. The only VS Code core files modified are `product.json` (brand identity), `package.json` (metadata + scripts), and file association registration. This ensures clean upstream merges.
3. **No graph logic in TypeScript.** All graph algorithms (traverse, impact, path, centrality, health) live in the Rust engine. TypeScript only calls and renders.
4. **No network dependency for core functionality.** The IDE must work fully offline. Signal Bus and Cluster Registry are optional add-ons.
5. **No breaking changes to .stz format without migration.** The format version field (`u16`) supports forward compatibility. Breaking changes require a migration tool.
6. **No AI dependency for core functionality.** Graph creation, querying, and visualization work without any LLM. AI is an enhancement, not a prerequisite.
7. **Code in English only.** All source code, comments, commit messages, and technical documentation must be in English. No mixed Chinese-English.

### 6.2 Design Principles

1. **Engine is the source of truth.** If the UI shows a graph, it came from an engine query. If the user modifies a graph, it goes through the engine API.
2. **Files over networks.** `.stz` files are the primary sharing mechanism. Networks (Signal Bus, Registry) are secondary.
3. **Explicit over implicit.** Every graph operation should be visible to the user. No hidden auto-modifications without user consent.
4. **Progressive disclosure.** The IDE starts simple (open a .stz file, see a graph). Advanced features (multi-cluster, bridges, AI) are discoverable but not overwhelming.
5. **Vercel-grade aesthetics.** The UI follows modern, clean, minimalist design. No hand-drawn elements, no playful animations, no multiple font families. Subtle gradients, static glows, unified sans-serif.

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| napi-rs cross-platform compilation issues | Medium | High | Start with Windows x64 only. Add platforms incrementally. Use CI matrix builds early. |
| Cytoscape.js performance with large graphs (>10k nodes) | Medium | Medium | Implement level-of-detail rendering. Virtualize off-screen nodes. Consider WebGL fallback for very large graphs. |
| VS Code fork maintenance burden | High | High | Stay close to upstream VS Code. Merge upstream regularly. Minimize fork divergence to brand + contrib/statuz. |
| Electron + Rust native module conflicts | Medium | High | Use prebuilt binaries (napi-rs supports this). Avoid runtime compilation. Ship prebuilt .node files per platform. |
| React component migration breaking existing AI features | Medium | Medium | Feature-flag the migration. Keep old paths working until new paths are verified. TSC validation before every commit. |

### 7.2 Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scope creep (trying to rebuild VS Code) | High | High | Strict additive policy: all Statuz code in `contrib/statuz/`. VS Code core is never modified beyond brand files. Upstream merges must be conflict-free outside `contrib/statuz/`. |
| Unclear value proposition vs. existing tools | Medium | High | The .stz format + traverse/impact/path queries are unique. No existing IDE has a built-in graph engine. This is the differentiator. |
| Adoption barrier (users must understand graphs) | Medium | Medium | Auto-graph-builder (Phase 3.2) removes the manual graph creation burden. Users see value immediately when they open a project. |
| Rust team bottleneck | Medium | High | The napi-rs wrapper is a thin layer. Most development happens in TypeScript. Only engine-level changes require Rust expertise. |

### 7.3 Mitigation Strategy

- **Weekly upstream sync:** Merge VS Code upstream changes every week to minimize divergence.
- **TSC gate:** No commit passes without `tsc --noEmit` success. Pre-existing errors are tracked separately.
- **Phase-gated releases:** Each phase has explicit exit criteria. No phase starts until the previous phase's exit criteria are met.
- **Dual-path testing:** Every engine query has a Rust unit test AND a TypeScript integration test.

---

## 8. Success Metrics

### Phase 0 (Brand Shell)
- [ ] `npm run buildreact` succeeds without errors
- [ ] `tsc --noEmit` passes (excluding pre-existing Void errors)
- [ ] IDE launches and displays "Statuz IDE" branding
- [ ] AI sidebar is functional

### Phase 1 (Engine Integration)
- [ ] `@statuz/engine-native` package builds for Windows x64
- [ ] `IStatuzEngineService` is registered and callable from renderer
- [ ] `.stz` file can be loaded, queried, and saved round-trip
- [ ] `self-test` from `statuz-core` passes through the IDE

### Phase 2 (Core Graph UI)
- [ ] `.stz` files open as interactive graphs
- [ ] Cluster Explorer shows fields, nodes, edges
- [ ] Query Console executes traverse/impact/path
- [ ] Impact Analyzer visualizes blast radius
- [ ] Graph renders correctly with 100+ nodes

### Phase 3 (AI Integration)
- [ ] AI can answer "what depends on this?" using `impact()`
- [ ] Auto-graph-builder generates a valid cluster from a TypeScript project
- [ ] Chat context includes graph awareness

### Phase 4 (Advanced)
- [ ] Health Dashboard shows real-time metrics
- [ ] Cross-field bridges are visually navigable
- [ ] Clone & merge operations work via UI

### Phase 5 (Ecosystem)
- [ ] External MCP clients can query the graph engine
- [ ] Signal Bus enables multi-agent graph awareness
- [ ] `.stz` format specification is published

---

## 9. Team & Resource Requirements

### 9.1 Roles

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4-5 |
|------|---------|---------|---------|-----------|
| Rust Engineer (napi-rs wrapper) | 1 | 0.5 | 0.5 | 0.5 |
| TypeScript Engineer (services + UI) | 1 | 2 | 2 | 1 |
| Frontend Engineer (React + Cytoscape) | 0 | 1.5 | 1 | 0.5 |
| AI/LLM Engineer (integration) | 0 | 0 | 1 | 0.5 |
| DevOps (CI/CD, cross-platform builds) | 0.5 | 0.5 | 0.5 | 0.5 |

### 9.2 Dependencies

- **statuz-core Rust crate** must be stable (currently is, with comprehensive self-test).
- **napi-rs** toolchain setup (Rust + Node.js + platform build tools).
- **Cytoscape.js** license review (MIT — compatible).
- **VS Code upstream** version pinning strategy.

---

## 10. Open Questions for Team Review

1. **napi-rs vs WASM:** napi-rs gives us native performance but complicates cross-platform builds. Should we evaluate WASM as a fallback for platforms where native compilation is problematic?

2. **Cytoscape.js vs custom WebGL:** Cytoscape is convenient but adds ~400KB to the bundle. For graphs >10k nodes, a custom WebGL renderer might be necessary. When do we make this decision?

3. **TypeScript SDK migration:** The YAML-based SDK (niche, SYN, calibration) is a different paradigm from the Rust graph engine. Do we migrate these to Rust, or keep them as a parallel TypeScript layer? What's the user-facing relationship between `.statuz/statuz.yaml` and `.stz` files?

4. **VS Code extension future:** Do we maintain the standalone `packages/vscode-extension/` as a lightweight alternative, or deprecate it once Statuz IDE is mature?

5. **Graph data sources:** Beyond manual creation and code-import inference, should we support importing from: package.json dependencies, Docker Compose files, Terraform configurations, Kubernetes manifests? Which formats are highest priority?

6. **Licensing:** Statuz IDE is a fork of VS Code (MIT). The statuz engine is Apache-2.0. Do we need to review any licensing implications before distributing the combined product?

7. **Upstream sync strategy:** How often do we merge VS Code upstream? Monthly? Quarterly? Do we maintain a patch set, or do we try to keep our changes isolated to `contrib/statuz/`?

---

## Appendix A: File Structure (Target)

```
src/vs/workbench/contrib/statuz/
├── browser/
│   ├── engine/                          # Graph engine UI
│   │   ├── clusterExplorerView.ts       # Sidebar: cluster/field/node tree
│   │   ├── graphVisualizer.ts           # Main: Cytoscape graph view
│   │   ├── queryConsole.ts              # Bottom: traverse/impact/path REPL
│   │   ├── impactAnalyzer.ts            # Panel: blast radius visualization
│   │   ├── healthDashboard.ts           # Panel: graph health metrics
│   │   ├── stzFileEditor.ts             # Custom editor for .stz files
│   │   └── autoGraphBuilder.ts          # Service: infer graph from code
│   ├── ...existing AI assistant files... # Chat, edit, settings (repositioned)
│   └── react/
│       └── src/
│           └── engine/                   # React components for engine UI
│               ├── cluster-explorer-tsx/
│               ├── graph-visualizer-tsx/
│               ├── query-console-tsx/
│               └── impact-analyzer-tsx/
├── common/
│   ├── engine/                          # Engine service definitions
│   │   ├── statuzEngineTypes.ts         # TypeScript types matching Rust structs
│   │   ├── statuzEngineService.ts       # IStatuzEngineService interface
│   │   ├── graphRenderTypes.ts          # Layout & rendering types
│   │   └── autoGraphTypes.ts            # Code-to-graph inference types
│   └── ...existing service types...
├── electron-main/
│   ├── engine/
│   │   ├── statuzEngineChannel.ts       # IPC channel for engine calls
│   │   └── nativeModuleLoader.ts        # napi-rs module loading
│   └── ...existing channels...
└── ...existing directories...

statuz/crates/statuz-core/
├── src/
│   ├── graph/                           # GraphEngine (existing)
│   ├── cluster/                         # Cluster, Field, Bridge (existing)
│   ├── storage/                         # .stz binary format (existing)
│   └── napi/                            # NEW: napi-rs wrapper
│       ├── Cargo.toml
│       ├── lib.rs
│       └── types.rs                     # napi-compatible type conversions
└── Cargo.toml
```

---

## Appendix B: Engine API Surface (Complete)

### Rust → napi-rs → TypeScript Type Mapping

| Rust Type | napi-rs Type | TypeScript Type |
|-----------|-------------|-----------------|
| `String` | `String` | `string` |
| `f64` | `f64` | `number` |
| `bool` | `bool` | `boolean` |
| `Option<T>` | `Option<T>` | `T \| undefined` |
| `Vec<T>` | `Vec<T>` | `T[]` |
| `HashMap<String, String>` | `Object` | `Record<string, string>` |
| `Node` | `NodeObject` | `{ id, type, label, status, meta? }` |
| `Edge` | `EdgeObject` | `{ id, source, target, relation, weight, description, target_field?, meta? }` |
| `ImpactResult` | `ImpactResultObject` | `{ changed, affected[], blast_radius[], critical_path }` |
| `PathResult` | `PathResultObject` | `{ from, to, path[], field_path[], length, exists }` |
| `HealthReport` | `HealthReportObject` | `{ total_nodes, total_edges, orphans[], sinks[], sources[], high_centrality[], disconnected_components }` |
| `Cluster` | `ClusterHandle` (opaque) | `ClusterHandle` (opaque reference) |

---

*End of document. Please direct review comments and questions to the team channel.*
