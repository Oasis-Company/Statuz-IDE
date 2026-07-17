# Phase 1: Statuz Engine Native Embedding — Preparation Analysis

> **Audit Date:** 2026-07-17
> **Scope:** statuz-core (Rust) + Statuz-IDE (VS Code fork)
> **Standard:** Most rigorous — multi-round review, every claim verified against source

---

## 1. Architecture Audit Summary

### 1.1 Repository Landscape

| Repository | Path | Purpose | Active Code |
|---|---|---|---|
| **statuz** | `D:\github projects\statuz` | Rust graph engine core | ~2500 LOC, 10 Phase self-tests |
| **Statuz-IDE** | `D:\github projects\Statuz-IDE` | VS Code fork with IDE integration | Stub service + IPC channel framework |

### 1.2 Rust Engine (statuz-core) — Completed

```
statuz-core (crates/statuz-core/src/)
├── lib.rs          — Public API exports (3 modules)
├── main.rs         — CLI entry + 11 Phase self-tests (940 lines)
├── graph/
│   ├── engine.rs   — GraphEngine: HashMap-based adjacency list (420 lines)
│   ├── types.rs    — Node, Edge, Relation, query results (295 lines)
│   └── query.rs    — traverse/impact/path + centrality/health/subgraph (801 lines)
├── cluster/
│   ├── cluster.rs  — Cluster container: fields, bridges, diff, validate (1114 lines)
│   ├── field.rs    — Field subgraph wrapper (61 lines)
│   └── sharing.rs  — Clone + Merge + password management (555 lines)
└── storage/
    └── mod.rs      — .stz format: msgpack + blake3 + optional zstd/ChaCha20 (605 lines)
```

**Core algorithms (3 queries):**
- `traverse(from, relation, cross_field)` — Single-hop traversal with relation filter
- `impact(changed)` — Reverse BFS impact analysis with critical path detection
- `path(from, to, cross_field)` — BFS shortest path

**Additional capabilities:**
- `centrality()`, `health()`, `subgraph()`, `validate()`, `diff()`
- `.stz` binary format: `[magic: 4B][version: 2B][flags: 2B][salt: 16B][content: msgpack][hash: blake3 32B]`
- Storage options: zstd compression (level 3), ChaCha20 encryption, Argon2id password

### 1.3 napi-rs Crate (statuz-core-napi) — Frozen

```
crates/statuz-core-napi/
├── Cargo.toml    — deps: napi 2, napi-derive 2, statuz-core
├── build.rs      — napi_build::setup() (ready)
└── src/lib.rs    — ONLY placeholder(): "statuz-core-napi: placeholder — frozen"
```

**Status:** Infrastructure ready (build.rs, napi deps), but all bindings are stubs. The `PLAN_NAPI_UI.md` document contains the complete planned napi-rs source code (~440 lines) but it has never been written to `lib.rs`.

### 1.4 IDE Integration (Statuz-IDE) — All Stubs

| Component | File | Status |
|---|---|---|
| Type definitions | `common/engine/statuzEngineTypes.ts` | Complete (195 lines, mirrors Rust structs) |
| Service interface | `common/engine/statuzEngineService.ts` | Complete (IStatuzEngineService, 22 methods) |
| Service implementation | Same file | **Stub** — `_callEngine()` throws ENGINE_NOT_READY |
| IPC channel ID | `common/engine/statuzEngineChannelId.ts` | Complete (channel name, request/response types) |
| Main process channel | `electron-main/engine/statuzEngineChannel.ts` | **Stub** — returns ENGINE_NOT_READY for all calls |
| Browser service layer | `browser/engine/` | **Missing** — directory does not exist |
| Service registration | `statuz.contribution.ts` | Done (import triggers `registerSingleton`) |
| Channel registration | `app.ts` (line 1258-1260) | Done (`mainProcessElectronServer.registerChannel`) |

---

## 2. Gap Analysis — 7 Critical Gaps

### G1: napi-rs Bindings [CRITICAL]

**Severity:** Blocks all integration
**File:** `crates/statuz-core-napi/src/lib.rs`
**Issue:** Only a placeholder function exists. The full 22-method napi-rs export layer needs to be written.
**Solution:** Write complete napi-rs bindings for all Cluster operations, using a Mutex-protected handle store pattern (i32 handle → Cluster mapping). The `PLAN_NAPI_UI.md` contains the complete planned code (~440 lines).
**Risks:**
- `lazy_static` dependency not yet in Cargo.toml
- `serde_json` needed for JSON-based parameter passing (already in statuz-core deps)
- Handle store must be thread-safe (Mutex, already planned)
- `napi` crate features: `napi4` + `async` (already in Cargo.toml)

### G2: Native Module Loading [CRITICAL]

**Severity:** Blocks main process integration
**File:** `electron-main/engine/statuzEngineChannel.ts`
**Issue:** The `require('@statuz/engine-native')` call is commented out. The channel returns `{ success: false, code: 'ENGINE_NOT_READY' }` for all calls.
**Solution:** Enable the require() call, add error handling, and dispatch calls to the native module's exported functions.
**Risks:**
- `.node` file path resolution in Electron main process
- Module must be built before `require()` succeeds
- Need to handle missing module gracefully (fallback error)

### G3: IPC Dispatch in Service [CRITICAL]

**Severity:** Blocks renderer → main process communication
**File:** `common/engine/statuzEngineService.ts`
**Issue:** The `_callEngine()` method has the IPC channel code commented out (lines 147-157). The `@IMainProcessService` dependency is not injected.
**Solution:** Uncomment the IPC dispatch block, add `@IMainProcessService` to constructor, wire up `StatuzEngineRequest`/`StatuzEngineResponse`.
**Risks:**
- `IMainProcessService` already available in VS Code's DI container
- `crypto.randomUUID()` for request IDs (available in Electron)
- Must handle `channel.call<T>()` properly (it returns the raw response, not a wrapped promise)

### G4: Build Pipeline [HIGH]

**Severity:** Blocks reproducible integration
**Issue:** No build script compiles the napi-rs crate and copies the `.node` file to the IDE.
**Solution:** Create a build script (PowerShell or npm script) that:
1. `cd` to statuz repo, run `cargo build -p statuz-core-napi --release`
2. Copy `target/release/statuz_core_napi.dll` → `Statuz-IDE/build/statuz-native/statuz-core-napi.node`
3. Integrate with `npm run compile` or create a separate `npm run build:engine` script
**Risks:**
- Rust toolchain must be installed (rustc, cargo)
- napi-rs requires `@napi-rs/cli` for `.node` file generation? Check: napi-rs 2 uses `build.rs` + `cargo build`, the output is a standard `.dll`/`.so`/`.dylib` that can be renamed to `.node`
- Windows: `statuz_core_napi.dll` → `statuz-core-napi.node`
- macOS: `libstatuz_core_napi.dylib` → `statuz-core-napi.node`
- Linux: `libstatuz_core_napi.so` → `statuz-core-napi.node`

### G5: Browser Engine Service Layer [HIGH]

**Severity:** Architecture cleanliness
**File:** `browser/engine/` (does not exist)
**Issue:** The engine service is registered from `common/engine/statuzEngineService.ts` but there's no dedicated browser-side layer. The service is imported via `statuz.contribution.ts`.
**Solution:** Create `browser/engine/statuzEngineService.ts` as a thin proxy that re-exports the common service with browser-specific initialization. This follows the VS Code pattern of `common/` + `browser/` separation.
**Risks:**
- Low risk — the current registration via `statuz.contribution.ts` works, but lacks proper layering
- Follow the existing pattern from `sendLLMMessageService.ts` and `mcpService.ts`

### G6: lazy_static Dependency [MEDIUM]

**Severity:** Blocks compilation of napi-rs crate
**File:** `crates/statuz-core-napi/Cargo.toml`
**Issue:** The planned napi-rs code uses `lazy_static::lazy_static!` for the Mutex-protected handle store, but `lazy_static` is not in Cargo.toml dependencies.
**Solution:** Add `lazy_static = "1"` to dependencies.
**Risks:**
- Minimal risk — well-established crate
- Alternative: Use `std::sync::OnceLock` (stable since Rust 1.70) instead of `lazy_static` to eliminate the dependency

### G7: Verification & Testing [MEDIUM]

**Severity:** Quality assurance
**Issue:** No end-to-end test for the engine integration. The `verify_agent_mgmt.cjs` script exists for Agent Management but not for the engine.
**Solution:** Create a CDP-based verification script that:
1. Creates a cluster with 3 nodes and 2 edges
2. Runs traverse/impact/path queries
3. Saves .stz file, reloads it
4. Verifies health report
5. Tests error handling

---

## 3. Implementation Plan — 4 Phases, 9 Commits

### Phase 1: napi-rs Native Module (statuz repo)

**Files to modify:**
- `crates/statuz-core-napi/src/lib.rs` — Full napi-rs bindings
- `crates/statuz-core-napi/Cargo.toml` — Add lazy_static

**Build output:**
- `target/release/statuz_core_napi.dll` → `build/statuz-native/statuz-core-napi.node`

**Commit 1:** `feat(engine): implement napi-rs bindings for statuz-core graph engine`
- Write complete napi-rs exports (22 methods)
- Handle store: `Mutex<HashMap<i32, Cluster>>`
- All methods: createCluster, loadCluster, saveCluster, registerNode, unregisterNode, createField, removeField, addEdge, removeEdge, addBridge, removeBridge, traverse, impact, path, centrality, health, clusterInfo, fieldInfo, cloneCluster, mergeClusters, exportJson, dropCluster
- Add lazy_static dependency

**Commit 2:** `chore(engine): build napi module and add build pipeline`
- Build the crate: `cargo build -p statuz-core-napi --release`
- Create build script in Statuz-IDE: `scripts/build-engine.ps1`
- Verify the .node file loads correctly in Node.js

### Phase 2: IDE Integration (Statuz-IDE repo)

**Commit 3:** `feat(engine): wire StatuzEngineChannel to native module dispatch`
- Rewrite `electron-main/engine/statuzEngineChannel.ts`
- Load native module via `require()`
- Dispatch calls to native module methods
- Handle errors gracefully

**Commit 4:** `feat(engine): enable IPC calls in IStatuzEngineService`
- Update `common/engine/statuzEngineService.ts`
- Uncomment IPC dispatch in `_callEngine()`
- Add `@IMainProcessService` dependency
- Update `isEngineReady` to attempt native module detection

**Commit 5:** `refactor(engine): create browser-side engine service layer`
- Create `browser/engine/statuzEngineService.ts`
- Proper layering following VS Code conventions
- Update `statuz.contribution.ts` import path

### Phase 3: Verification (Statuz-IDE repo)

**Commit 6:** `test(engine): add e2e verification script for engine integration`
- Create `verify_engine_integration.cjs`
- CDP-based verification of all 22 methods
- Test: create cluster → add nodes → add edges → run queries → save/load .stz → health report

**Commit 7:** `fix(engine): resolve compilation and integration issues`
- Full `npm run compile` check
- Fix any TypeScript errors
- Verify in Electron app via CDP

### Phase 4: UI Primitives (Statuz-IDE repo, post-core)

**Commit 8:** `feat(engine): add Cluster Explorer TreeView UI component`
- Basic TreeView showing clusters, fields, nodes
- Uses VS Code TreeViewPane pattern

**Commit 9:** `docs(engine): update architecture docs and progress tracking`
- Update `ARCHITECTURE.md`
- Update `PROGRESS.md`
- Update `PHASE_1_DETAILED_PLAN.md`

---

## 4. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Rust toolchain not installed | Medium | Blocks Phase 1 | Check `rustc --version` before starting |
| napi-rs .node file doesn't load in Electron | Low | Blocks Phase 2 | Test with pure Node.js first, then in Electron's main process |
| IPC channel serialization mismatch | Low | Medium | Use strongly-typed request/response, verify with JSON stringify |
| Service DI registration conflicts | Low | Medium | Verify `registerSingleton` is called exactly once |
| Cross-platform build differences | Low | Low | Target Windows only for now (user's dev environment) |
| Handle memory leak (napi) | Low | High | Add `dropCluster` method, implement auto-cleanup on GC |

---

## 5. Verification Strategy

After each phase, run:
1. **TypeScript compilation:** `npx tsc --noEmit` (0 errors)
2. **Rust compilation:** `cargo build -p statuz-core-napi` (0 warnings)
3. **Node.js module test:** `node -e "require('./build/statuz-native/statuz-core-napi.node')"` (no crash)
4. **CDP integration test:** `node verify_engine_integration.cjs` (all 22 methods pass)
5. **Visual inspection:** Open Statuz IDE, verify no console errors, engine service initializes

**Acceptance criteria for native embedding:**
- [ ] `IStatuzEngineService.isEngineReady` returns `true`
- [ ] Creating a cluster returns a valid handle
- [ ] Adding nodes and edges works
- [ ] Traverse/impact/path queries return correct results
- [ ] .stz file save/load round-trip preserves data
- [ ] Health report returns accurate statistics
- [ ] Error handling returns meaningful messages (not throws)
- [ ] Zero compilation errors
- [ ] Zero console errors in Electron app