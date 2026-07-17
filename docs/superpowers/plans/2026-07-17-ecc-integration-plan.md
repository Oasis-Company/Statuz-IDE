# ECC Integration Execution Plan — Full-Page Harness Engineering Panel

> **Status**: Draft — Awaiting Review  
> **Created**: 2026-07-17  
> **Standard**: Most Rigorous — stability over speed, multiple rounds of review, reasoning, retries, and optimization  
> **Key Decisions**: `EditorPane` replaces `ViewPane` (full-page editor area) | ECC `.trae/` target shortens install path | `IAgentSkillItem` interface unchanged | Visual card-grid layout replaces sidebar list | Five Gates selection criteria

---

## Architectural Decision: Full-Page EditorPane

### Problem

The current `AgentManagementViewPane` is a `ViewPane` registered in `ViewContainerLocation.Sidebar`. This means:
- Constrained to the sidebar width (typically 200-350px)
- Cannot provide a dashboard-style visual experience
- Horizontal layout is cramped — list/detail pattern is the only viable option
- No room for a "harness engineering" visual panel with multiple zones

### Solution: EditorPane

Replace the sidebar `ViewPane` with an `EditorPane` that opens in the editor area (full width/height):

```
Current:                                     Future:
┌──────────────────────┐                    ┌──────────────────────────────────────┐
│ Activity Bar         │                    │  Editor Tab: "Agent Management"      │
│ ┌──────┐             │                    │──────────────────────────────────────│
│ │  ◇  │─→ Agent      │                    │  ┌──────┐ ┌────────────────────────┐│
│ │  ◆  │   Mgmt       │                    │  │Side  │ │ Main Content           ││
│ │  ▣  │   (sidebar)  │                    │  │Panel │ │ (card grid, harness    ││
│ └──────┘             │                    │  │      │ │  dashboard, etc.)      ││
└──────────────────────┘                    │  └──────┘ └────────────────────────┘│
                                            └──────────────────────────────────────┘
```

**Registration pattern** (following VS Code's SettingsEditor2):

```
┌─────────────────────────────────────────────────────────────────┐
│  IEditorPaneRegistry.registerEditorPane(                         │
│    EditorPaneDescriptor.create(HarnessEditor, ID, name),         │
│    [SyncDescriptor(HarnessEditorInput)]                          │
│  )                                                               │
│                                                                  │
│  Action: 'statuz.openHarness' → IEditorService.openEditor()      │
│                                                                  │
│  Activity Bar icon (same as before) → triggers the action        │
└─────────────────────────────────────────────────────────────────┘
```

**Key changes from current architecture:**
- `AgentManagementViewPane` (`ViewPane`) → `HarnessEditor` (`EditorPane`)
- `agentManagementPane.ts` → fully rewritten to `harnessEditor.ts`
- `ViewContainer` registration removed → `EditorPane` registration added
- Activity Bar icon stays — just opens the editor instead of the sidebar
- `agentManagementService.ts` kept as-is (facade service)
- `ecc/` subdirectory kept as-is (ECC catalog + install services)

---

## 0. Selection Criteria — The Five Gates

*(Unchanged from previous plan — still applies to all ECC component selection)*

Every ECC agent and skill must pass **all five gates** to be considered for inclusion. A single failure means exclusion — no exceptions.

### Gate 1: Statuz Domain Relevance
Only TypeScript/JavaScript/React/Node.js + VS Code IDE tooling + Agent Engineering.

### Gate 2: No System-Level Dependency
No OS config, hardware, network infra, shell assumptions.

### Gate 3: No Domain-Specific Business Logic
No logistics, customs, energy, healthcare, carrier, inventory, etc.

### Gate 4: No ECC Self-Management
No configure-ecc, skill-creator, continuous-learning, etc.

### Gate 5: No Marketing / Social / Content
No brand, content-engine, SEO, social, etc.

---

## 1. Component Categorization

*(Unchanged from previous plan — see Section 1 for full details)*

- **Agents**: 67 total → 26 MUST + 8 NICE + 33 SKIP
- **Skills**: 277 total → ~45 MUST + ~15 NICE + ~217 SKIP

---

## 2. New Architecture

### 2.1 Target Directory Structure

```
src/vs/workbench/contrib/statuz/browser/
├── agentManagement.types.ts        # EXISTING — NO CHANGES (IAgentSkillItem compatible)
├── agentManagement.css             # EXISTING — kept for shared styles
├── agentManagement.service.ts      # RETAINED — facade service for installed items
├── agentManagementPane.ts          # DEPRECATED — replaced by harnessEditor.ts
├── harness/
│   ├── harnessEditor.ts            # NEW — EditorPane: full-page harness engineering panel
│   ├── harnessEditorInput.ts       # NEW — EditorInput: lightweight input descriptor
│   ├── harness.css                 # NEW — full-page layout styles (600+ lines)
│   ├── harnessSidebar.ts           # NEW — left sidebar: search, filter, sort, categories
│   ├── harnessCardGrid.ts          # NEW — main content: visual card grid with categories
│   ├── harnessDetailPanel.ts       # NEW — right panel: detail view, config editor, install
│   ├── harnessStatusBar.ts         # NEW — bottom status bar
│   └── harnessNavBar.ts            # NEW — top navigation: tabs, actions, refresh
├── ecc/
│   ├── eccCatalogService.ts        # NEW — fetch, parse, filter ECC catalog
│   ├── eccCatalogTypes.ts          # NEW — ECC-specific types
│   ├── eccInstallService.ts        # NEW — install/uninstall ECC components to .trae/
│   └── eccMetadataParser.ts        # NEW — parse YAML frontmatter from SKILL.md / agent .md
```

### 2.2 Full-Page Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HarnessEditor (extends EditorPane) — opens in editor area              │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  harnessNavBar                                                     │   │
│  │  [Catalog] [Installed] [Harness] [Config]  [🔍 Search] [🔄] [⚙] │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                    │   │
│  │  ┌─────────┐  ┌─────────────────────────────────┐ ┌──────────┐    │   │
│  │  │ Sidebar  │  │ Card Grid (Main)                │ │ Detail   │    │   │
│  │  │─────────│  │                                 │ │ Panel    │    │   │
│  │  │ Search   │  │  Agent Engineering              │ │─────────│    │   │
│  │  │ Filter   │  │  ┌──────┐ ┌──────┐ ┌──────┐   │ │ Name     │    │   │
│  │  │ Sort     │  │  │Agent │ │Harness│ │ Eval  │   │ │ Desc     │    │   │
│  │  │          │  │  │Arch  │ │Constr │ │Frame  │   │ │ Version  │    │   │
│  │  │ Status   │  │  │Audit │ │       │ │      │   │ │ Author   │    │   │
│  │  │ Filters  │  │  └──────┘ └──────┘ └──────┘   │ │ Tags     │    │   │
│  │  │          │  │                                 │ │ Config   │    │   │
│  │  │ ───────  │  │  Development Foundations         │ │ [Install] │    │   │
│  │  │ 156 Avail│  │  ┌──────┐ ┌──────┐ ┌──────┐   │ │ [Uninstall]│    │   │
│  │  │ 12 Inst  │  │  │API   │ │Back  │ │Coding │   │ └──────────┘    │   │
│  │  │ 8 Enab   │  │  │Design│ │End   │ │Stand  │   │                │   │
│  │  └─────────┘  │  └──────┘ └──────┘ └──────┘   │                │    │   │
│  │               │                                 │                │    │   │
│  │               │  Frontend & UI                  │                │    │   │
│  │               │  ┌──────┐ ┌──────┐ ┌──────┐   │                │    │   │
│  │               │  │React │ │Motion│ │Web   │   │                │    │   │
│  │               │  │Patt  │ │ UI   │ │Design│   │                │    │   │
│  │               │  └──────┘ └──────┘ └──────┘   │                │    │   │
│  │               └─────────────────────────────────┘                │    │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  harnessStatusBar: "156 available — 12 installed — 8 enabled"    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HarnessEditor (EditorPane) - Full-page, no VS Code chrome constraints │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  harnessNavBar                                                     │   │
│  │  ├─ Tab: "Catalog" → show ECC catalog (filtered, searchable)      │   │
│  │  ├─ Tab: "Installed" → show installed items with status           │   │
│  │  ├─ Tab: "Harness" → visual harness engineering dashboard         │   │
│  │  └─ Tab: "Config" → settings, preferences, about                  │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                    │   │
│  │  ┌──────────┐  ┌──────────────────────────┐ ┌────────────────┐    │   │
│  │  │ Sidebar  │  │ Card Grid                 │ │ Detail Panel  │    │   │
│  │  │ (filters)│  │ (category-grouped cards)  │ │ (metadata)    │    │   │
│  │  └────┬─────┘  └───────────┬──────────────┘ └───────┬───────┘    │   │
│  │       │                    │                          │            │   │
│  │       ▼                    ▼                          ▼            │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  AgentManagementService (facade)                              │  │   │
│  │  │  ├─ getItems() → installed items (from .trae/ scan)          │  │   │
│  │  │  ├─ getCatalogItems() → filtered catalog (from ECC)          │  │   │
│  │  │  ├─ installItem(id) → EccInstallService.install()            │  │   │
│  │  │  └─ uninstallItem(id) → EccInstallService.uninstall()        │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │              │                     │                                │   │
│  │              ▼                     ▼                                │   │
│  │  ┌────────────────────┐  ┌──────────────────────────────┐          │   │
│  │  │  EccCatalogService  │  │  EccInstallService           │          │   │
│  │  │  (catalog fetch)    │  │  (install to .trae/)        │          │   │
│  │  └────────────────────┘  └──────────────────────────────┘          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Key Design Decisions

| Decision | Rationale |
|---|---|
| `EditorPane` instead of `ViewPane` | Full editor area width/height. No sidebar constraints. Proper VS Code pattern for full-page content (SettingsEditor2, KeybindingsEditor). |
| `EditorInput` subclass | Required by `IEditorPaneRegistry` registration. Lightweight — no serialization needed. |
| Activity Bar icon unchanged | Same entry point. Just opens the editor instead of the sidebar. User experience unchanged. |
| 3-zone layout (sidebar / card grid / detail) | Familiar VS Code pattern (used by Settings, Extensions). Sidebar for search/filter, grid for visual browsing, detail panel for deep inspection. |
| Card grid instead of list | Visual browsing is more appropriate for a catalog of 150+ items. Categories group related items. Cards show icon, name, description, status at a glance. |
| Nav tabs (Catalog / Installed / Harness / Config) | Tab bar separates concerns. "Catalog" = browse ECC, "Installed" = manage installed items, "Harness" = visual harness engineering, "Config" = settings. |
| `AgentManagementService` retained as facade | View layer never touches ECC internals. Same service interface, same DI pattern. |
| `ecc/` independent subdirectory | ECC-specific logic (GitHub API, YAML parsing, .trae/ path management) stays cleanly separated. |

---

## 3. Phase Breakdown

### Phase 1: Harness Editor Foundation — Full-Page Shell

**Goal**: Replace the sidebar `AgentManagementViewPane` with a full-page `HarnessEditor` (EditorPane). The shell includes the 3-zone layout, nav tabs, and basic sample data display. No ECC integration yet — just the foundation.

**Estimated**: 5 files, ~600 LOC, 1 commit

#### Commit 1: `feat(harness): replace sidebar AgentManagement ViewPane with full-page EditorPane`

**Files created:**
- `src/vs/workbench/contrib/statuz/browser/harness/harnessEditorInput.ts` (~40 LOC)
  - `HarnessEditorInput extends EditorInput`
  - `static readonly ID = 'workbench.input.statuzHarness'`
  - `resource: URI` with `Schemas.vscodeStatuz` scheme (or similar)
  - Minimal implementation — just enough to satisfy `IEditorPaneRegistry`
- `src/vs/workbench/contrib/statuz/browser/harness/harnessEditor.ts` (~250 LOC)
  - `HarnessEditor extends EditorPane`
  - `static readonly ID = 'workbench.editor.statuzHarness'`
  - `createEditor(parent)` — create the 3-zone layout container
  - `setInput(input, options, context, token)` — load data, render view
  - `layout(height, width)` — resize child zones
  - Imports: `HarnessNavBar`, `HarnessSidebar`, `HarnessCardGrid`, `HarnessDetailPanel`, `HarnessStatusBar`
  - Registration: `IEditorPaneRegistry.registerEditorPane()`
  - Action: `statuz.openHarness` → `IEditorService.openEditor()`
- `src/vs/workbench/contrib/statuz/browser/harness/harness.css` (~300 LOC)
  - Full-page layout: `display:flex;flex-direction:column;height:100%`
  - Nav bar: `display:flex;align-items:center;border-bottom:1px solid var(--vscode-sideBarSectionHeader-border)`
  - Nav tabs: `button` elements with `.active` state
  - Main content: `display:flex;flex:1;overflow:hidden`
  - Sidebar: `width:260px;overflow-y:auto;border-right:1px solid var(--vscode-sideBarSectionHeader-border)`
  - Card grid: `flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))`
  - Detail panel: `width:320px;overflow-y:auto;border-left:1px solid var(--vscode-sideBarSectionHeader-border)`
  - Status bar: `display:flex;justify-content:space-between;border-top:1px solid var(--vscode-sideBarSectionHeader-border)`
  - Card: `border:1px solid var(--vscode-sideBarSectionHeader-border);border-radius:4px;padding:12px;cursor:pointer`
  - Card hover: `background-color:var(--vscode-list-hoverBackground)`
  - Category header: `font-size:13px;font-weight:600;text-transform:uppercase;padding:16px 0 8px`
  - All styles use `--vscode-*` CSS variables for theme compatibility
- `src/vs/workbench/contrib/statuz/browser/harness/harnessNavBar.ts` (~80 LOC)
  - `HarnessNavBar` class
  - Create tab buttons: `Catalog`, `Installed`, `Harness`, `Config`
  - Tab switch callback (provided by editor)
  - Action buttons: `Refresh Catalog`, `Settings`
- `src/vs/workbench/contrib/statuz/browser/harness/harnessStatusBar.ts` (~50 LOC)
  - `HarnessStatusBar` class
  - Display: `"{available} available — {installed} installed — {enabled} enabled"`
  - `update(items, catalog)` method

**Files modified:**
- `src/vs/workbench/contrib/statuz/browser/statuz.contribution.ts`
  - Remove `import './agentManagementPane.js'` (old ViewPane)
  - Add `import './harness/harnessEditor.js'` (new EditorPane)
- `src/vs/workbench/contrib/statuz/browser/agentManagementPane.ts`
  - Delete or deprecate (all registration code removed)
  - Keep the file as a stub with a deprecation notice, or delete entirely

**Files retained (unchanged):**
- `agentManagement.types.ts` — `IAgentSkillItem` interface still used
- `agentManagement.css` — kept for shared styles (some reused in card grid)
- `agentManagementService.ts` — kept as facade service

**Verification:**
- [ ] TSC compilation: 0 errors
- [ ] Click Activity Bar icon → full-page editor opens in editor area
- [ ] Editor shows 3-zone layout: sidebar, main content, detail panel
- [ ] Nav tabs are visible and clickable
- [ ] Status bar shows correct counts
- [ ] Switching between tabs shows/hides appropriate content
- [ ] Resizing editor window re-layouts all zones
- [ ] Old sidebar ViewPane no longer appears in sidebar
- [ ] Activity Bar icon still opens the correct view

---

### Phase 2: ECC Catalog Browser

**Goal**: Integrate the ECC catalog into the `HarnessEditor`. The "Catalog" tab shows all available ECC agents and skills (filtered by Five Gates) in a visual card grid. Search, filter, sort, and category grouping work.

**Estimated**: 4 files, ~400 LOC, 1 commit

#### Commit 2: `feat(harness): add ECC catalog service and visual card grid browser`

**Files created:**
- `src/vs/workbench/contrib/statuz/browser/ecc/eccCatalogTypes.ts` (~60 LOC)
  - `EccAgentMeta`, `EccSkillMeta`, `EccCatalog`, `EccGateResult`
- `src/vs/workbench/contrib/statuz/browser/ecc/eccMetadataParser.ts` (~80 LOC)
  - `parseYamlFrontmatter(content)`, `extractMarkdownBody(content)`, `validateAgentMeta()`, `validateSkillMeta()`
- `src/vs/workbench/contrib/statuz/browser/ecc/eccCatalogService.ts` (~250 LOC)
  - `EccCatalogService` class: `fetchCatalog()`, `applySelectionGates()`, `toAgentSkillItem()`, `getFilteredCatalog()`, `searchCatalog()`, `refresh()`
- `src/vs/workbench/contrib/statuz/browser/harness/harnessCardGrid.ts` (~200 LOC)
  - `HarnessCardGrid` class
  - `render(items: IAgentSkillItem[], container: HTMLElement)` — group by category, render card grid
  - `renderCard(item: IAgentSkillItem)` — card HTML with icon, name, description, type badge, state indicator
  - `onCardClick(item)` — callback to show detail panel
  - `getCategories(items)` — extract unique categories, sort by priority
  - `update(items)` — re-render with new data

**Files modified:**
- `src/vs/workbench/contrib/statuz/browser/harness/harnessSidebar.ts` (~150 LOC)
  - `HarnessSidebar` class
  - Search input (debounced, filters catalog)
  - Filter checkboxes: `All`, `Agents`, `Skills`, `Commands`, `Rules`
  - Sort dropdown: `Name`, `Category`, `Last Used`, `Usage Count`
  - Status filter: `All States`, `Enabled`, `Disabled`, `Error`
  - `getFilter(): IAgentSkillFilter` — returns current filter state
  - `onFilterChange(callback)` — notifies when filter changes
- `src/vs/workbench/contrib/statuz/browser/harness/harnessDetailPanel.ts` (~180 LOC)
  - `HarnessDetailPanel` class
  - `show(item: IAgentSkillItem)` — render detail view
  - `hide()` — clear detail panel
  - Info rows: name, type, version, author, description, category, tags
  - Action buttons: `Install`, `Uninstall`, `Enable`, `Disable`
  - Config editor (JSON textarea, read-only/edit modes)
  - `onInstall(item)`, `onUninstall(item)`, `onToggle(item)` callbacks
- `src/vs/workbench/contrib/statuz/browser/harness/harnessEditor.ts`
  - Wire up `HarnessSidebar`, `HarnessCardGrid`, `HarnessDetailPanel`
  - Add `EccCatalogService` as DI dependency
  - `setInput` → `fetchCatalog()` → render card grid
  - Tab switching: "Catalog" → show catalog, "Installed" → show installed

**Verification:**
- [ ] TSC compilation: 0 errors
- [ ] "Catalog" tab shows 150+ items in card grid, grouped by category
- [ ] Cards show icon, name, type badge, description, state
- [ ] Search filters catalog in real-time
- [ ] Filter by "Agents" shows only agents
- [ ] Filter by "Skills" shows only skills
- [ ] Sort by name, category, last used works
- [ ] Click card → detail panel shows full metadata
- [ ] "Refresh Catalog" button re-fetches from GitHub
- [ ] No ECC self-management, domain-specific, or mobile items visible
- [ ] Sidebar count updates: "156 available"

---

### Phase 3: One-Click Install / Uninstall

**Goal**: Users can install and uninstall ECC agents and skills from the detail panel. Install places files in `.trae/`. Uninstall removes them. State management reflects install status.

**Estimated**: 2 files, ~300 LOC, 1 commit

#### Commit 3: `feat(harness): add ECC install service with one-click install/uninstall to .trae/`

**Files created:**
- `src/vs/workbench/contrib/statuz/browser/ecc/eccInstallService.ts` (~250 LOC)
  - `EccInstallService` class: `install()`, `uninstall()`, `scanInstalled()`, `isInstalled()`, `getInstallPath()`
  - Install: fetch from GitHub → write to `.trae/agents/<name>/` or `.trae/skills/<name>/`
  - Uninstall: remove directory, validate removal
  - Scan: read `.trae/` directory structure

**Files modified:**
- `src/vs/workbench/contrib/statuz/browser/agentManagementService.ts`
  - Add `EccInstallService` as dependency
  - Add `installItem(id)` and `uninstallItem(id)` methods
  - Add `onDidChangeInstallStatus` event
  - `getItems()` now merges installed items from `.trae/` scan
- `src/vs/workbench/contrib/statuz/browser/harness/harnessDetailPanel.ts`
  - Add Install/Uninstall buttons with confirmation
  - Add install progress indicator (spinner)
  - Add error display
- `src/vs/workbench/contrib/statuz/browser/harness/harnessEditor.ts`
  - Wire up install/uninstall callbacks
  - Refresh card grid after install/uninstall

**Verification:**
- [ ] TSC compilation: 0 errors
- [ ] Install an agent → files in `.trae/agents/<name>/`
- [ ] Install a skill → files in `.trae/skills/<name>/`
- [ ] Uninstall → directory removed from `.trae/`
- [ ] State persists across IDE restart
- [ ] "Installed" tab shows installed items
- [ ] Install error (network) → user-friendly message
- [ ] "Installing" spinner shows during install
- [ ] Double-install is idempotent

---

### Phase 4: Catalog Maintenance + Harness Engineering Tab

**Goal**: Add version updates, offline mode, dependency resolution, and the visual "Harness Engineering" dashboard tab.

**Estimated**: 2 files, ~250 LOC, 1 commit

#### Commit 4: `feat(harness): add catalog maintenance, offline mode, and harness engineering dashboard`

**Files modified:**
- `src/vs/workbench/contrib/statuz/browser/ecc/eccCatalogService.ts`
  - Add `checkForUpdates()`, `autoRefresh()`, `getDependencies()`, offline mode
- `src/vs/workbench/contrib/statuz/browser/ecc/eccInstallService.ts`
  - Add `updateItem()`, `installWithDependencies()`, `rollbackInstall()`
- `src/vs/workbench/contrib/statuz/browser/harness/harnessEditor.ts` (~200 LOC)
  - Add "Harness" tab with visual dashboard
  - Show: enabled agents count, installed skills, ECC catalog health
  - Show: quick actions (install recommended, update all, check for updates)
  - Show: harness engineering metrics (agents, skills, commands, rules)
  - Add "Update Available" badges on outdated items
  - Add offline indicator
- `src/vs/workbench/contrib/statuz/browser/harness/harness.css`
  - Add Harness dashboard styles

**Verification:**
- [ ] TSC compilation: 0 errors
- [ ] Harness dashboard shows summary metrics
- [ ] "Update Available" badge on outdated items
- [ ] Offline mode shows cached catalog
- [ ] Dependency resolution installs deps first
- [ ] Rollback removes partial install

---

## 4. What Is Explicitly NOT Included

*(Same exclusions from previous plan, plus:)*

| Exclusion | Rationale |
|---|---|
| Runtime execution of agents/skills | TRAE runtime handles execution. Statuz is a consumer of ECC, not a runtime. |
| MCP server management | Statuz uses its own MCP system. |
| Git hooks | ECC self-management. Statuz has its own hook system. |
| Cross-harness support | Statuz is TRAE-based only. |
| ECC manifest / installer scripts | Statuz installs programmatically via TypeScript. |
| Skill/agent creation wizard | Statuz is a consumer, not a producer. |
| Sidebar ViewPane fallback | The old sidebar ViewPane is fully replaced by the EditorPane. If the user wants sidebar access, a minimal "quick view" could be added later. |
| Drag-and-drop card reordering | Visual card grid is static for now. Drag-and-drop could be added in Phase 5. |
| Multi-select batch operations | MVP supports single-item install/uninstall only. Batch operations in Phase 5. |

---

## 5. Risk Assessment

| Risk | Severity | Probability | Mitigation |
|---|---|---|---|
| `EditorPane` registration conflicts with existing `ViewPane` | Medium | Medium | Remove old ViewPane registration BEFORE adding EditorPane. Verify no duplicate IDs. |
| `EditorInput` serialization breakage | Low | Low | `HarnessEditorInput` is simple — no serialization needed. Override `serialize()` to return empty string. |
| Full-page editor covers entire editor area — no sidebar agent list | Low | Medium | Add "Quick Agent List" as a sidebar view in Phase 5 if needed. |
| GitHub API rate limiting | Medium | High | Cache catalog locally; add optional GITHUB_TOKEN config. |
| `.trae/` path mismatch | Low | Low | ECC's `.trae/` target is confirmed. Verify with `scanInstalled()` before first install. |
| YAML parsing edge cases | Medium | Medium | Defensive parsing; skip malformed items gracefully. |
| Large catalog download | Medium | Medium | Fetch directory listing first (metadata only), full SKILL.md on demand. |
| TSC compilation errors | Low | Medium | No new npm dependencies. All code is hand-rolled TypeScript. |

---

## 6. Verification Checklist

### Pre-Commit (each commit)

- [ ] `tsc -p tsconfig.json --noEmit` → 0 errors
- [ ] All new files follow existing copyright header format
- [ ] All new files use `import { ... } from '...js'` (`.js` extension required by VS Code)
- [ ] No `any` types without explicit justification comment
- [ ] All public methods have JSDoc comments
- [ ] No Chinese characters in code (comments in English)
- [ ] Old ViewPane registration removed before EditorPane added

### Post-Phase 1

- [ ] Activity Bar icon opens full-page editor (not sidebar)
- [ ] 3-zone layout: sidebar (260px) + card grid (flex) + detail panel (320px)
- [ ] Nav tabs: Catalog, Installed, Harness, Config
- [ ] Status bar shows counts
- [ ] No `AgentManagementViewPane` in sidebar
- [ ] No console errors on page load
- [ ] Resizing works correctly
- [ ] Old `agentManagementPane.ts` is either removed or deprecated

### Post-Phase 2

- [ ] "Catalog" tab shows 150+ cards grouped by category
- [ ] Search filters in real-time
- [ ] Filter by type works (Agents / Skills / Commands / Rules)
- [ ] Sort by name, category, last used
- [ ] Click card → detail panel
- [ ] No excluded items visible
- [ ] Sidebar shows "156 available"

### Post-Phase 3

- [ ] Install → `.trae/` files created
- [ ] Uninstall → `.trae/` files removed
- [ ] State persists across restart
- [ ] "Installed" tab shows actual installed items
- [ ] Error handling works

### Post-Phase 4

- [ ] Harness dashboard shows metrics
- [ ] "Update Available" badges
- [ ] Offline mode
- [ ] Dependency resolution

### Final Integration

- [ ] Activity Bar icon opens full-page editor
- [ ] All 4 tabs work
- [ ] Catalog → Install → Uninstall → cycle works
- [ ] `.trae/` files are correct
- [ ] IDE restart → state persists
- [ ] Full TSC: 0 errors
- [ ] Application launches without errors

---

## 7. Commit Strategy

| # | Commit Message | Files | Estimated LOC |
|---|---|---|---|
| 1 | `feat(harness): replace sidebar AgentManagement ViewPane with full-page EditorPane` | 5 new, 1 modified, 1 deprecated | ~600 |
| 2 | `feat(harness): add ECC catalog service and visual card grid browser` | 4 new, 3 modified | ~400 |
| 3 | `feat(harness): add ECC install service with one-click install/uninstall to .trae/` | 1 new, 2 modified | ~300 |
| 4 | `feat(harness): add catalog maintenance, offline mode, and harness engineering dashboard` | 0 new, 3 modified | ~250 |
| **Total** | | **10 new, 9 modified, 1 deprecated** | **~1,550 LOC** |

---

## 8. Open Questions

1. **EditorInput serialization**: `HarnessEditorInput` needs `serialize()` and `IEditorInputFactory`. Should it be serializable? Recommendation: Make it simple — no serialization needed. It's a singleton-style editor (only one instance at a time).

2. **`Schemas.vscodeStatuz`**: Does Statuz need its own URI scheme, or can it reuse `Schemas.vscodeResource`? Recommendation: Check if `Schemas` is extensible. If not, use a unique string like `'statuz-harness'`.

3. **Sidebar fallback**: After removing the sidebar ViewPane, should we add a minimal "quick agent list" sidebar view for users who want quick access without opening the full editor? Recommendation: Skip for MVP. Add in Phase 5 if user feedback requests it.

4. **Card grid vs. table view**: Should the catalog also support a table/list view toggle? Recommendation: Start with card grid only. Table view is Phase 5.

5. **Harness dashboard content**: The "Harness" tab is currently placeholder. What should it show? Recommendation: System health metrics, quick actions, recent activity feed. Design in Phase 4.

6. **`agentManagementPane.ts` fate**: Delete or keep as deprecated stub? Recommendation: Delete it entirely. The file is ~500 lines of dead code. Git history preserves it.

---

## 9. Visual Mockup

### Harness Editor — Default State (Catalog Tab)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  [●] Agent Management     [Catalog] [Installed] [Harness] [Config]   [🔄] [⚙]    │
├──────────┬───────────────────────────────────────────────────────┬───────────────────┤
│  Search  │  Agent Engineering                                     │  Detail Panel     │
│ ┌──────┐ │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  ──────────────   │
│ │ 🔍   │ │  │  Agent       │ │  Harness     │ │  Agent       │  │  TypeScript       │
│ └──────┘ │  │  Architecture│ │  Construction│ │  Introspect  │  │  Reviewer         │
│          │  │  Audit       │ │              │ │  Debugging   │  │                   │
│ Type:    │  └──────────────┘ └──────────────┘ └──────────────┘  │  Type: agent      │
│ □ All    │                                                       │  Version: 1.0.0   │
│ □ Agents │  Development Foundations                               │  Author: ECC Team │
│ □ Skills │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │                   │
│ □ Rules  │  │  API Design  │ │  Backend     │ │  Coding      │  │  Review TypeScript │
│ □ Cmds   │  │              │ │  Patterns    │ │  Standards   │  │  code for common  │
│          │  └──────────────┘ └──────────────┘ └──────────────┘  │  anti-patterns...  │
│ Status:  │                                                       │                   │
│ ○ All    │  Frontend & UI                                        │  📦 Install       │
│ ● Enab   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │                   │
│ ○ Disab  │  │  React       │ │  Motion UI   │ │  Web Design  │  │  Tags:            │
│          │  │  Patterns    │ │              │ │  Guidelines  │  │  #typescript      │
│ ──────── │  └──────────────┘ └──────────────┘ └──────────────┘  │  #review          │
│ 156 Avail│                                                       │  #code-quality    │
│ 12 Inst  │  Testing & Quality                                    │                   │
│ 8 Enab   │  ┌──────────────┐ ┌──────────────┐                   │                   │
│          │  │  E2E Testing │ │  AI          │                   │                   │
│          │  │              │ │  Regression  │                   │                   │
│          │  └──────────────┘ └──────────────┘                   │                   │
├──────────┴───────────────────────────────────────────────────────┴───────────────────┤
│  156 available  ·  12 installed  ·  8 enabled                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```