# Phase 1: Rust Engine Integration — Detailed Plan

> **Phase:** 1
> **Status:** Not Started
> **Estimated Effort:** 2-3 engineering weeks
> **Dependency:** Phase 0 (Brand Shell Completion) must be done first
> **Owner:** TBD

---

## 1. Phase Goal

**The Rust graph engine runs inside the Statuz IDE process. TypeScript code can call `traverse`, `impact`, and `path` directly. The `.stz` binary format is read and written from the IDE. All graph logic lives in Rust; TypeScript only renders results.**

---

## 2. Success Criteria (Definition of Done)

A Phase 1 release is considered complete when ALL of the following are true:

- [ ] `@statuz/engine-native` npm package builds successfully for Windows x64
- [ ] `@statuz/engine-native` npm package builds successfully for macOS arm64
- [ ] `IStatuzEngineService` is registered in the VS Code DI system
- [ ] An engineer can run this from DevTools console in the IDE:
  ```javascript
  const svc = window.statuz.engine;
  const cluster = await svc.createCluster('demo', 'private');
  await svc.registerNode(cluster, { id: 'svc-a', type: 'service', label: 'Service A', status: 'active' });
  await svc.registerNode(cluster, { id: 'svc-b', type: 'service', label: 'Service B', status: 'active' });
  await svc.createField(cluster, 'arch', 'Architecture');
  await svc.addEdge(cluster, 'arch', {
    id: 'e1', source: 'svc-a', target: 'svc-b',
    relation: 'depends_on', weight: 1.0, description: 'A depends on B'
  });
  const result = await svc.traverse(cluster, 'arch', 'svc-a', null, false);
  console.log(result); // → { nodes: ['svc-b'], edges: [...] }
  ```
- [ ] `.stz` file round-trip works: `saveCluster` → `loadCluster` → identical graph state
- [ ] `impact()` returns correct blast radius (verified against Rust self-test)
- [ ] `path()` returns correct shortest path (verified against Rust self-test)
- [ ] `health()` returns correct health report (verified against Rust self-test)
- [ ] `tsc --noEmit` passes with zero new errors (pre-existing errors excluded)
- [ ] No VS Code core files modified beyond `product.json`, `package.json`, and `workbench.common.main.ts` registration

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Renderer Process (TypeScript)                                │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  IStatuzEngineService (VS Code service)                │ │
│  │  - createCluster / loadCluster / saveCluster           │ │
│  │  - registerNode / createField / addEdge / addBridge    │ │
│  │  - traverse / impact / path / health / centrality     │ │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │ IPC (electron)                 │
└─────────────────────────────┼────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────┐
│  Main Process (TypeScript)   │                                │
│                              ▼                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  statuzEngineChannel.ts (IPC handler)                  │ │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │ require()                      │
│  ┌──────────────────────────▼─────────────────────────────┐ │
│  │  @statuz/engine-native (napi-rs addon, .node file)    │ │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │ FFI                            │
│  ┌──────────────────────────▼─────────────────────────────┐ │
│  │  statuz-core (Rust)                                    │ │
│  │  - GraphEngine                                         │ │
│  │  - Cluster + Field + Bridge                            │ │
│  │  - Storage (.stz binary: msgpack + blake3)             │ │
│  │  - Sharing (clone, merge)                              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Milestones & Tasks

### Milestone 1.1: napi-rs Wrapper Crate

**Goal:** Create the `statuz-core-napi` crate that wraps `statuz-core` with napi-rs bindings.

**Location:** `D:\github projects\statuz\crates\statuz-core-napi\` (in the engine repo, not the IDE repo)

| # | Task | Owner | Estimate | Dependencies |
|---|------|-------|----------|--------------|
| 1.1.1 | Create `statuz-core-napi` crate structure | Rust Eng | 0.5d | - |
| 1.1.2 | Add napi-rs dependencies to Cargo.toml | Rust Eng | 0.5d | 1.1.1 |
| 1.1.3 | Define napi-compatible input types (NodeInput, EdgeInput, CloneOptions, MergeOptions) | Rust Eng | 1d | 1.1.2 |
| 1.1.4 | Define napi-compatible output types (TraverseResult, ImpactResult, PathResult, HealthResult, ClusterInfo) | Rust Eng | 1d | 1.1.3 |
| 1.1.5 | Implement ClusterHandle (opaque reference wrapper) | Rust Eng | 1d | 1.1.3 |
| 1.1.6 | Bind cluster lifecycle: `create_cluster`, `load_stz_file`, `save_stz_file`, `verify_stz_file` | Rust Eng | 1d | 1.1.5 |
| 1.1.7 | Bind node & field management: `register_node`, `unregister_node`, `create_field` | Rust Eng | 0.5d | 1.1.6 |
| 1.1.8 | Bind edge & bridge: `add_edge`, `remove_edge`, `add_bridge`, `remove_bridge` | Rust Eng | 0.5d | 1.1.7 |
| 1.1.9 | Bind queries: `traverse`, `impact`, `path`, `centrality`, `health` | Rust Eng | 1d | 1.1.8 |
| 1.1.10 | Bind sharing: `clone_cluster`, `merge_clusters`, `export_json` | Rust Eng | 0.5d | 1.1.9 |
| 1.1.11 | Bind info: `cluster_info`, `field_info`, `node_info` | Rust Eng | 0.5d | 1.1.10 |
| 1.1.12 | Write Rust unit tests for all napi-rs bindings | Rust Eng | 2d | 1.1.11 |
| 1.1.13 | Verify against existing `standalone_test.rs` assertions | Rust Eng | 1d | 1.1.12 |

**Deliverable:** Working napi-rs crate. Running `cargo test` in `statuz-core-napi/` passes all tests.

---

### Milestone 1.2: npm Package & Cross-Platform Builds

**Goal:** Package the napi-rs addon as an npm package with prebuilt binaries.

| # | Task | Owner | Estimate | Dependencies |
|---|------|-------|----------|--------------|
| 1.2.1 | Create `packages/engine-native/` in statuz repo (package.json, index.d.ts, index.js) | Rust Eng | 1d | 1.1.13 |
| 1.2.2 | Set up `@napi-rs/cli` build pipeline | Rust Eng | 1d | 1.2.1 |
| 1.2.3 | Generate TypeScript type definitions (.d.ts) | Rust Eng | 1d | 1.2.2 |
| 1.2.4 | Configure GitHub Actions for Windows x64 prebuild | DevOps | 1d | 1.2.3 |
| 1.2.5 | Configure GitHub Actions for macOS arm64 prebuild | DevOps | 0.5d | 1.2.4 |
| 1.2.6 | Configure GitHub Actions for macOS x64 prebuild | DevOps | 0.5d | 1.2.5 |
| 1.2.7 | Configure GitHub Actions for Linux x64 prebuild | DevOps | 0.5d | 1.2.6 |
| 1.2.8 | Verify prebuilds load correctly on each platform | QA | 1d | 1.2.7 |
| 1.2.9 | Publish `@statuz/engine-native` as private npm package (for development) | DevOps | 0.5d | 1.2.8 |

**Deliverable:** `@statuz/engine-native` npm package with prebuilt binaries for Windows x64, macOS x64/arm64, Linux x64. `require('@statuz/engine-native')` works out of the box.

---

### Milestone 1.3: IStatuzEngineService (TypeScript)

**Goal:** Create the TypeScript service interface and implementation.

**Location:** `src/vs/workbench/contrib/statuz/common/engine/`

| # | Task | Owner | Estimate | Dependencies |
|---|------|-------|----------|--------------|
| 1.3.1 | Create `statuzEngineTypes.ts` with all TypeScript type definitions | TS Eng | 1d | 1.2.9 |
| 1.3.2 | Define `IStatuzEngineService` interface (with `_serviceBrand`) | TS Eng | 0.5d | 1.3.1 |
| 1.3.3 | Create `StatuzEngineService` implementation class | TS Eng | 2d | 1.3.2 |
| 1.3.4 | Implement cluster lifecycle methods (create, load, save, verify) | TS Eng | 0.5d | 1.3.3 |
| 1.3.5 | Implement node/field/edge/bridge methods | TS Eng | 0.5d | 1.3.4 |
| 1.3.6 | Implement query methods (traverse, impact, path, centrality, health) | TS Eng | 1d | 1.3.5 |
| 1.3.7 | Implement sharing methods (clone, merge, exportJson) | TS Eng | 0.5d | 1.3.6 |
| 1.3.8 | Implement error handling and input validation | TS Eng | 1d | 1.3.7 |
| 1.3.9 | Write unit tests for `IStatuzEngineService` (mocking the native module) | TS Eng | 2d | 1.3.8 |
| 1.3.10 | Register service in VS Code DI via `statuz.contribution.ts` | TS Eng | 1d | 1.3.9 |

**Deliverable:** `IStatuzEngineService` is registered and callable from any VS Code service or component.

---

### Milestone 1.4: IPC Channel (Electron Main ↔ Renderer)

**Goal:** Wire up IPC communication so the renderer process can call the main process's native module.

**Location:**
- Main: `src/vs/workbench/contrib/statuz/electron-main/engine/`
- Common: `src/vs/workbench/contrib/statuz/common/engine/`

| # | Task | Owner | Estimate | Dependencies |
|---|------|-------|----------|--------------|
| 1.4.1 | Define IPC channel constants in common types | TS Eng | 0.5d | 1.3.1 |
| 1.4.2 | Create `statuzEngineChannel.ts` (main process handler) | TS Eng | 2d | 1.4.1 |
| 1.4.3 | Load `@statuz/engine-native` in main process (with error handling) | TS Eng | 1d | 1.4.2 |
| 1.4.4 | Create `StatuzEngineService` renderer-side implementation that calls IPC | TS Eng | 1d | 1.4.3 |
| 1.4.5 | Test all service methods end-to-end (renderer → IPC → main → native → back) | TS Eng | 2d | 1.4.4 |
| 1.4.6 | Add proper error propagation across IPC boundary | TS Eng | 1d | 1.4.5 |
| 1.4.7 | Add logging/tracing for all engine calls (debug mode) | TS Eng | 0.5d | 1.4.6 |

**Deliverable:** Full end-to-end call chain works. Renderer can call engine methods and get results.

---

### Milestone 1.5: Integration & Validation

**Goal:** Verify everything works together, fix bugs, ensure quality.

| # | Task | Owner | Estimate | Dependencies |
|---|------|-------|----------|--------------|
| 1.5.1 | Manual test: create cluster, add nodes/edges, run all queries | QA | 1d | 1.4.7 |
| 1.5.2 | Manual test: .stz file save → load → verify round-trip | QA | 1d | 1.5.1 |
| 1.5.3 | Manual test: clone and merge operations | QA | 0.5d | 1.5.2 |
| 1.5.4 | Performance test: 1000-node graph traversal latency | QA | 0.5d | 1.5.3 |
| 1.5.5 | Performance test: 10000-node graph memory usage | QA | 0.5d | 1.5.4 |
| 1.5.6 | Fix all bugs found during testing | TS Eng / Rust Eng | 2d | 1.5.5 |
| 1.5.7 | Run `tsc --noEmit` and fix any new type errors | TS Eng | 1d | 1.5.6 |
| 1.5.8 | Final sign-off against success criteria | Tech Lead | 0.5d | 1.5.7 |

**Deliverable:** Phase 1 is done. All success criteria met.

---

## 5. File Structure (Target End State)

### In `statuz` engine repo:

```
crates/statuz-core-napi/
├── Cargo.toml                  # deps: statuz-core, napi
├── src/
│   ├── lib.rs                  # #[napi] function exports
│   ├── types.rs                # napi-compatible type conversions
│   ├── cluster_handle.rs       # ClusterHandle (opaque reference)
│   └── input_types.rs          # NodeInput, EdgeInput, etc.
└── tests/
    └── napi_integration_test.rs

packages/engine-native/
├── package.json                # @statuz/engine-native
├── index.js                    # JS entry point
├── index.d.ts                  # TypeScript definitions
├── npm/                        # Platform-specific .node files
│   ├── win32-x64-msvc/
│   ├── darwin-x64/
│   ├── darwin-arm64/
│   └── linux-x64-gnu/
└── build.rs                    # napi build script
```

### In `Statuz-IDE` repo:

```
src/vs/workbench/contrib/statuz/
├── common/
│   └── engine/
│       ├── statuzEngineTypes.ts     # All TypeScript types
│       ├── statuzEngineService.ts   # IStatuzEngineService interface
│       └── statuzEngineChannelId.ts # IPC channel constants
├── browser/
│   └── engine/
│       └── statuzEngineService.ts   # Renderer-side service impl (IPC client)
└── electron-main/
    └── engine/
        ├── statuzEngineChannel.ts   # Main process IPC handler
        └── nativeModuleLoader.ts    # Loads @statuz/engine-native
```

---

## 6. Type Mapping (Rust → napi → TypeScript)

### Core Types

| Rust | napi-rs | TypeScript | Notes |
|------|---------|------------|-------|
| `String` | `String` | `string` | Direct mapping |
| `f64` | `f64` | `number` | Direct mapping |
| `bool` | `bool` | `boolean` | Direct mapping |
| `Option<T>` | `Option<T>` | `T \| undefined` | Direct mapping |
| `Vec<T>` | `Vec<T>` | `T[]` | Direct mapping |
| `HashMap<String, String>` | `Object` | `Record<string, string>` | Via `napi::JsObject` |
| `Cluster` | `External<Cluster>` | `ClusterHandle` | Opaque reference via napi External |
| `Node` | `NodeObject` | `EngineNode` | Struct with all fields |
| `Edge` | `EdgeObject` | `EngineEdge` | Struct with all fields |

### Query Result Types

| Rust Struct | TypeScript Interface |
|-------------|---------------------|
| `TraverseResult` | `{ nodes: EngineNode[]; edges: EngineEdge[] }` |
| `ImpactResult` | `{ changed: EngineNode; affected: EngineNode[]; blastRadius: EngineNode[][]; criticalPath: boolean }` |
| `PathResult` | `{ from: string; to: string; path: EngineNode[]; fieldPath: string[]; length: number; exists: boolean }` |
| `HealthReport` | `{ totalNodes: number; totalEdges: number; orphans: string[]; sinks: string[]; sources: string[]; highCentrality: string[]; disconnectedComponents: number }` |
| `ClusterInfo` | `{ id: string; name: string; visibility: string; nodeCount: number; fieldCount: number; createdAt: number; updatedAt: number }` |

### Input Types

| TypeScript Interface | Rust Equivalent |
|---------------------|-----------------|
| `NodeInput { id, type, label, status, meta? }` | Converted to `Node` struct |
| `EdgeInput { id, source, target, relation, weight, description, targetField?, meta? }` | Converted to `Edge` struct |
| `CloneOptions { resetPassword?, resetTimestamps?, newName? }` | `CloneConfig` struct |
| `MergeStrategy: 'skip' \| 'overwrite' \| 'rename' \| 'merge_meta'` | `MergeStrategy` enum |

---

## 7. IPC Protocol

### Channel Name
```
statuz:engine:command
```

### Request Format
```typescript
interface StatuzEngineRequest {
    id: string;              // request ID for correlation
    method: string;          // method name, e.g. 'createCluster'
    args: unknown[];         // method arguments
}
```

### Response Format
```typescript
interface StatuzEngineResponse {
    id: string;              // matches request ID
    success: boolean;
    result?: unknown;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
}
```

### Method List
| Method | Args | Returns |
|--------|------|---------|
| `createCluster` | `name: string, visibility: string` | `ClusterHandle` |
| `loadCluster` | `path: string` | `ClusterHandle` |
| `saveCluster` | `handle: ClusterHandle, path: string` | `void` |
| `verifyStzFile` | `path: string` | `boolean` |
| `registerNode` | `handle, node: NodeInput` | `void` |
| `unregisterNode` | `handle, nodeId: string` | `boolean` |
| `createField` | `handle, id: string, name: string, description?: string` | `void` |
| `addEdge` | `handle, fieldId: string, edge: EdgeInput` | `void` |
| `removeEdge` | `handle, fieldId: string, edgeId: string` | `boolean` |
| `addBridge` | `handle, fromField, toField, source, target, desc, weight` | `void` |
| `removeBridge` | `handle, bridgeId: string` | `boolean` |
| `traverse` | `handle, fieldId, nodeId, relation?, crossField?` | `TraverseResult` |
| `impact` | `handle, nodeId: string` | `ImpactResult` |
| `path` | `handle, from, to, crossField` | `PathResult` |
| `centrality` | `handle, fieldId, limit` | `string[]` |
| `health` | `handle, fieldId` | `HealthReport` |
| `clusterInfo` | `handle` | `ClusterInfo` |
| `cloneCluster` | `handle, options: CloneOptions` | `ClusterHandle` |
| `mergeClusters` | `targetHandle, sourceHandle, strategy` | `MergeResult` |
| `exportJson` | `handle` | `string` |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| napi-rs build failures on Windows | Medium | High | Start with Windows first. Use prebuilt binaries from CI. |
| napi-rs `External` lifetime issues (GC collecting Cluster) | Medium | High | Store ClusterHandles in a Vec in the main module to prevent GC. Reference count them. |
| IPC serialization overhead for large graphs | Medium | Medium | Benchmark with 10k nodes early. If too slow, consider SharedArrayBuffer or direct WASM fallback. |
| argon2 password hashing blocking the event loop | Medium | Medium | Run heavy operations (argon2, large graph builds) on a separate thread pool via napi-rs `Env::spawn`. |
| Prebuilt binary download failures in CI | Low | Medium | Add fallback: if prebuilt missing, compile from source (requires Rust toolchain). |
| VS Code DI registration not working | Low | Medium | Follow existing patterns from `statuzModelService.ts` and `mcpService.ts`. |

---

## 9. Testing Strategy

### 9.1 Rust Unit Tests
- Location: `statuz-core-napi/tests/`
- Coverage: All napi-rs exported functions
- Verify against `standalone_test.rs` reference results

### 9.2 TypeScript Unit Tests
- Location: `src/vs/workbench/contrib/statuz/common/engine/__tests__/`
- Mock: Mock the native module with test doubles
- Coverage: Service interface, input validation, error handling

### 9.3 Integration Tests (E2E)
- Renderer → IPC → Main → Native → IPC → Renderer
- Run all 20+ methods end-to-end
- Verify data integrity (round-trip tests)

### 9.4 Performance Tests
- 1000-node graph: traverse < 1ms, impact < 5ms, path < 5ms
- 10000-node graph: traverse < 10ms, impact < 50ms, path < 50ms
- Memory: 10k nodes < 50MB

---

## 10. Dependencies & Setup

### Rust Toolchain
- Rust 1.75+ (stable)
- `cargo` with `wasm-pack` (not needed for napi-rs, but good to have)
- Platform-specific build tools (MSVC on Windows, Xcode on macOS, gcc on Linux)

### napi-rs
- `@napi-rs/cli` for scaffolding
- `napi` and `napi-derive` crates
- Prebuilt binary distribution via GitHub Actions

### IDE Side
- `@statuz/engine-native` added as dependency in `package.json`
- TypeScript 5.0+
- VS Code extension API for custom services

---

## 11. Open Questions

1. **Where does the napi-rs crate live?** In the `statuz` engine repo (recommended) or in `Statuz-IDE` repo?
   - Recommendation: engine repo. It's part of the engine, not the IDE.

2. **npm package name & scope?** `@statuz/engine-native` or `@oasis/statuz-engine`?
   - Recommendation: `@statuz/engine-native`

3. **Private or public npm package?**
   - Recommendation: Start private, make public when stable.

4. **How to handle the `ClusterHandle` in TypeScript?** Opaque number ID, or a class wrapper?
   - Recommendation: Opaque string ID (UUID) managed by the service. The native side maps string → Cluster reference.

5. **Error boundary strategy?** If the native module fails to load (missing binary, wrong platform), what happens?
   - Recommendation: Service returns a clear error, UI shows a friendly message. Features gracefully degrade.

6. **Should we include `argon2` password hashing in Phase 1?**
   - Recommendation: Yes, it's part of `statuz-core` storage and needed for `.stz` file support. But make it async to avoid blocking the event loop.

---

*End of Phase 1 Detailed Plan*
