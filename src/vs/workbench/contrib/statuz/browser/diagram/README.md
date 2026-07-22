# Diagram Module — Architecture

> **Status:** Stable (Phase 3 Complete)
> **Purpose:** Universal data-driven SVG canvas for architecture diagrams. Replaces the legacy split between BoardCanvas (`board/`) and AgentCanvas (`harness/`).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Consumer Layer                            │
│  boardPane.ts          harnessEditor.ts         (future consumers)│
└──────────────────────────┬──────────────────────────────────────┘
                           │ DiagramDefinition
┌──────────────────────────▼──────────────────────────────────────┐
│              ArchitectureDiagramEngine (SVG Canvas)              │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │Interaction   │  │ Rendering      │  │ Context Menu       │   │
│  │pan/zoom/drag │  │nodes/edges/    │  │VS Code integration │   │
│  │connect/select│  │labels/arrows   │  │(IContextMenuSvc)   │   │
│  └──────────────┘  └────────────────┘  └────────────────────┘   │
└──────────┬──────────────────┬──────────────────┬────────────────┘
           │                  │                  │
┌──────────▼──────┐  ┌───────▼──────┐  ┌───────▼──────────────────┐
│ DiagramState    │  │DiagramUndo   │  │DiagramLayoutEngine        │
│ Manager         │  │Redo          │  │                           │
│                 │  │              │  │ Column | Grouped | Dagre   │
│ localStorage    │  │ snapshot-    │  │ (extensible via register-  │
│ + cross-tab sync│  │ based undo   │  │ Strategy)                 │
└─────────────────┘  └──────────────┘  └───────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────┐
│                   Diagram Utilities                              │
│  diagramNodeRegistry  diagramPortUtils  diagramEdgeUtils         │
│  (renderer registry)  (port calculation) (SVG edge rendering)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Types

### DiagramDefinition (diagramTypes.ts)

The central configuration object. Each diagram type (Board, Agent, etc.) declares one `DiagramDefinition` that specifies:

- `nodeTypes` — Supported node shapes, colors, dimensions, ports
- `edgeTypes` — Line styles, arrow markers, routing
- `contextMenu` — Right-click menu actions (canvas, node, edge groups)
- `callbacks` — Lifecycle hooks (onNodeDoubleClick, onLayoutChange, etc.)
- `layoutStrategy` — Default layout algorithm
- `defaultViewport` — Initial viewport dimensions
- `storageKey` — localStorage key for persistence

### DiagramNodeTypeConfig

Defines how a node type renders:
- `name` — Display label
- `shape` — `rectangle` | `rounded` | `pill` | `diamond` | `hexagon` | `circle`
- `defaultDimensions` — Width/height
- `fillColor` / `strokeColor` — SVG fill/stroke
- `ports` — Connection points per side

### DiagramEdgeTypeConfig

Defines how an edge type renders:
- `name` — Display label
- `lineStyle` — `solid` | `dashed` | `dotted`
- `strokeColor` — SVG stroke
- `strokeWidth` — Line width
- `arrowEnd` — `none` | `filled` | `open`

---

## Data Flow

```
1. Consumer creates ArchitectureDiagramEngine(container, definition, ...)
2. Engine reads initial state from DiagramStateManager (localStorage)
3. Engine renders nodes + edges via SVG (diagramNodeRegistry + diagramEdgeUtils)
4. User interactions (drag, connect, toolbar) mutate state via StateManager
5. StateManager debounces writes to localStorage (500ms) + broadcasts cross-tab
6. DiagramUndoRedo snapshots state before each mutation for undo/redo
7. DiagramLayoutEngine recalculates positions on auto-layout trigger
8. DiagramToolbar exposes zoom/pan/fit/undo/redo/layout controls
```

---

## File Inventory

| File | Lines | Role |
|------|-------|------|
| `diagramTypes.ts` | ~222 | Core type system: all interfaces and type aliases |
| `architectureDiagramEngine.ts` | ~800 | SVG canvas engine: rendering, interaction, lifecycle |
| `diagramStateManager.ts` | ~254 | localStorage persistence with debounce + cross-tab sync |
| `diagramUndoRedo.ts` | ~96 | Snapshot-based undo/redo with configurable maxSteps |
| `diagramLayoutEngine.ts` | ~164 | Layout strategies: Column, Grouped, Dagre |
| `diagramNodeRegistry.ts` | ~34 | Global node type renderer registry |
| `diagramPortUtils.ts` | ~103 | Port position calculation for edge endpoints |
| `diagramEdgeUtils.ts` | ~213 | SVG edge path rendering, labels, arrow markers |
| `diagramToolbar.ts` | ~120 | Config-driven toolbar: undo/redo/zoom/fit/layout |
| `diagramIndex.ts` | ~65 | Unified entry point: re-exports all public API |
| `boardDiagramDefinition.ts` | ~247 | Board diagram: Strategy Cards, Decisions, Events |
| `agentDiagramDefinition.ts` | ~246 | Agent diagram: Agents, Skills, Pipelines |

---

## How to Add a New Diagram Type

### Step 1: Create the Definition

```typescript
// myDiagramDefinition.ts
import type { DiagramDefinition } from './diagramTypes.js';

export const myDiagramDefinition: DiagramDefinition = {
    id: 'my-diagram',
    name: 'My Diagram',
    storageKey: 'statuz.diagram.my',
    defaultViewport: { width: 1200, height: 800 },
    nodeTypes: [
        {
            type: 'my-node',
            name: 'My Node',
            description: 'A custom node type',
            shape: 'rounded',
            defaultDimensions: { width: 200, height: 100 },
            fillColor: '#2d2d2d',
            strokeColor: '#569cd6',
            ports: { top: true, bottom: true, left: true, right: true },
        },
    ],
    edgeTypes: [
        {
            type: 'my-edge',
            name: 'My Edge',
            lineStyle: 'solid',
            strokeColor: '#6a9955',
            arrowEnd: 'filled',
        },
    ],
    contextMenu: {
        canvas: [
            { id: 'add-node', label: 'Add Node', icon: 'codicon-add', handler: () => {} },
        ],
        node: [],
        edge: [],
    },
    callbacks: {},
};
```

### Step 2: Register in diagramIndex.ts

```typescript
// diagramIndex.ts
export { myDiagramDefinition } from './myDiagramDefinition.js';
```

### Step 3: Instantiate the Engine

```typescript
import { ArchitectureDiagramEngine, DiagramStateManager, DiagramUndoRedo } from '../diagram/diagramIndex.js';
import { myDiagramDefinition } from '../diagram/diagramIndex.js';

const container = document.getElementById('my-diagram-container')!;
const stateManager = new DiagramStateManager(myDiagramDefinition);
const undoRedo = new DiagramUndoRedo(50);
const engine = new ArchitectureDiagramEngine(container, myDiagramDefinition, stateManager, undoRedo, contextMenuService);
```

---

## Testing

```bash
# Run all diagram tests (48 tests, pure in-memory, no browser needed)
npm run test:diagram

# Test files:
# - diagramStateManager.test.ts       (13 tests)
# - diagramUndoRedo.test.ts          (8 tests)
# - diagramNodeRegistry.test.ts      (5 tests)
# - diagramLayoutEngine.test.ts      (8 tests)
# - diagramEdgeUtils.test.ts         (5 tests)
# - diagramToolbar.test.ts           (3 tests)
# - architectureDiagramEngine.test.ts (6 tests)
```

All tests run in jsdom (simulated browser DOM) via `tsx`. No database, no browser, no network.