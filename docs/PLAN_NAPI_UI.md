# napi-rs Bridge + Minimal UI Implementation Plan

> **Goal:** Wire the Rust statuz-core engine into the IDE via napi-rs native bindings, then build a minimal UI (Cluster Explorer + Graph Visualizer + Query Console) so users can interact with real graph data.
>
> **Architecture:** Two parallel tracks. Track 1 writes the napi-rs native module in the `statuz` engine repo and integrates it into the IDE's Electron main process. Track 2 creates VS Code ViewContainer + TreeView + Webview UI components in the `statuz` IDE contrib layer.
>
> **Tech Stack:** Rust (napi-rs v2, serde, serde_json), TypeScript, VS Code Extension API (TreeView, Webview), SVG

---

## File Structure

### Track 1 — napi-rs Bridge (statuz engine repo)

| File | Action | Purpose |
|------|--------|---------|
| `crates/statuz-core-napi/src/lib.rs` | Rewrite | Real napi-rs exports wrapping all Cluster operations |
| `crates/statuz-core-napi/Cargo.toml` | Verify | Already has correct deps (napi 2, serde, serde_json) |
| `crates/statuz-core/Cargo.toml` | Verify | Ensure serde_json is a dependency |

### Track 1 — IDE Integration (Statuz-IDE repo)

| File | Action | Purpose |
|------|--------|---------|
| `src/vs/workbench/contrib/statuz/electron-main/engine/statuzEngineChannel.ts` | Rewrite | Load native module, dispatch calls |
| `src/vs/workbench/contrib/statuz/common/engine/statuzEngineService.ts` | Rewrite | Use IPC calls (uncomment TODO block) |
| `src/vs/code/electron-main/app.ts` | Verify | Already registered channel |
| `.gitignore` | Modify | Add `.napi-build/` |

### Track 2 — UI (Statuz-IDE repo, all new files)

| File | Purpose |
|------|---------|
| `src/vs/workbench/contrib/statuz/browser/statuz.contribution.ts` | Extension manifest: register views, commands, menus |
| `src/vs/workbench/contrib/statuz/browser/statuzViewPane.ts` | Root ViewContainer for the Statuz sidebar |
| `src/vs/workbench/contrib/statuz/browser/clusterExplorer.ts` | TreeView: clusters, fields, nodes |
| `src/vs/workbench/contrib/statuz/browser/graphWebview.ts` | Webview: SVG force-directed graph |
| `src/vs/workbench/contrib/statuz/browser/queryConsole.ts` | Webview: traverse/impact/path input + results |
| `src/vs/workbench/contrib/statuz/browser/statuz.contribution.ts` | Wire everything, register commands "statuz.xxx" |

---

## Track 1: napi-rs Bridge

### T1.1 — Write napi-rs exports

**File:** `d:\github projects\statuz\crates\statuz-core-napi\src\lib.rs`

```rust
use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::sync::Mutex;
use std::collections::HashMap;
use statuz_core::*;

// ─── Handle Store ──────────────────────────────────────────────────
// The napi module holds a static Mutex<HashMap<i32, Cluster>>.
// JS gets back an i32 handle, passes it back for subsequent calls.

static NEXT_ID: std::sync::atomic::AtomicI32 = std::sync::atomic::AtomicI32::new(1);

lazy_static::lazy_static! {
    static ref CLUSTERS: Mutex<HashMap<i32, cluster::Cluster>> = Mutex::new(HashMap::new());
}

fn alloc_handle(cluster: cluster::Cluster) -> i32 {
    let id = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let mut store = CLUSTERS.lock().unwrap();
    store.insert(id, cluster);
    id
}

fn with_cluster<F, T>(handle: i32, f: F) -> Result<T>
where
    F: FnOnce(&mut cluster::Cluster) -> Result<T, String>,
    T: napi::bindgen_prelude::ToNapiValue,
{
    let mut store = CLUSTERS.lock().map_err(|e| Error::from_reason(format!("lock error: {}", e)))?;
    let cluster = store.get_mut(&handle).ok_or_else(|| Error::from_reason(format!("invalid handle: {}", handle)))?;
    f(cluster).map_err(|e| Error::from_reason(e))
}

// ─── Cluster Lifecycle ────────────────────────────────────────────

#[napi]
pub fn create_cluster(name: String, visibility: String) -> i32 {
    let vis = match visibility.as_str() {
        "public" => cluster::Visibility::Public,
        "organization" => cluster::Visibility::Organization,
        _ => cluster::Visibility::Private,
    };
    let id = format!("cluster-{}", name.to_lowercase().replace(' ', "-"));
    let cluster = cluster::Cluster::new(id, name, vis);
    alloc_handle(cluster)
}

#[napi]
pub fn load_cluster(path: String) -> Result<i32> {
    let data = std::fs::read(&path)
        .map_err(|e| Error::from_reason(format!("read error: {}", e)))?;
    let cluster = storage::deserialize_cluster(&data)
        .map_err(|e| Error::from_reason(format!("deserialize error: {}", e)))?;
    Ok(alloc_handle(cluster))
}

#[napi]
pub fn save_cluster(handle: i32, path: String) -> Result<()> {
    let cluster = {
        let store = CLUSTERS.lock().map_err(|e| Error::from_reason(format!("lock error: {}", e)))?;
        store.get(&handle).ok_or_else(|| Error::from_reason(format!("invalid handle: {}", handle)))?.clone()
    };
    let data = storage::serialize_cluster(&cluster)
        .map_err(|e| Error::from_reason(format!("serialize error: {}", e)))?;
    std::fs::write(&path, &data)
        .map_err(|e| Error::from_reason(format!("write error: {}", e)))?;
    Ok(())
}

#[napi]
pub fn verify_stz_file(path: String) -> bool {
    std::fs::read(&path)
        .ok()
        .and_then(|data| storage::deserialize_cluster(&data).ok())
        .is_some()
}

#[napi]
pub fn drop_cluster(handle: i32) -> bool {
    let mut store = CLUSTERS.lock().unwrap();
    store.remove(&handle).is_some()
}

// ─── Node Management ──────────────────────────────────────────────

#[napi]
pub fn register_node(handle: i32, node_json: String) -> Result<()> {
    let node: graph::types::Node = serde_json::from_str(&node_json)
        .map_err(|e| Error::from_reason(format!("json parse error: {}", e)))?;
    with_cluster(handle, |c| {
        c.register_node(node);
        Ok(())
    })
}

#[napi]
pub fn unregister_node(handle: i32, node_id: String) -> Result<bool> {
    with_cluster(handle, |c| {
        let existed = c.nodes.contains_key(&node_id);
        c.unregister_node(&node_id);
        Ok(existed)
    })
}

// ─── Field Management ────────────────────────────────────────────

#[napi]
pub fn create_field(handle: i32, id: String, name: String, description: Option<String>) -> Result<()> {
    with_cluster(handle, |c| {
        c.create_field(id, name, description);
        Ok(())
    })
}

#[napi]
pub fn remove_field(handle: i32, field_id: String) -> Result<()> {
    with_cluster(handle, |c| {
        c.remove_field(&field_id);
        Ok(())
    })
}

// ─── Edge & Bridge Management ────────────────────────────────────

#[napi]
pub fn add_edge(handle: i32, field_id: String, edge_json: String) -> Result<()> {
    let edge: graph::types::Edge = serde_json::from_str(&edge_json)
        .map_err(|e| Error::from_reason(format!("json parse error: {}", e)))?;
    with_cluster(handle, |c| {
        let field = c.get_field_mut(&field_id)
            .ok_or_else(|| format!("field '{}' not found", field_id))?;
        field.graph.add_edge(edge);
        Ok(())
    })
}

#[napi]
pub fn remove_edge(handle: i32, field_id: String, edge_id: String) -> Result<bool> {
    with_cluster(handle, |c| {
        let field = c.get_field_mut(&field_id)
            .ok_or_else(|| format!("field '{}' not found", field_id))?;
        let existed = field.graph.get_edge(&edge_id).is_some();
        field.graph.remove_edge(&edge_id);
        Ok(existed)
    })
}

#[napi]
pub fn add_bridge(
    handle: i32, from_field: String, to_field: String,
    source: String, target: String, description: String, weight: f64,
) -> Result<()> {
    with_cluster(handle, |c| {
        c.add_bridge(&from_field, &to_field, &source, &target, description, weight)
            .map_err(|e| e)
    })
}

#[napi]
pub fn remove_bridge(handle: i32, bridge_id: String) -> Result<bool> {
    with_cluster(handle, |c| {
        // Remove from both fields and bridge registry
        let bridges = c.bridges.as_mut()
            .ok_or_else(|| "no bridges".to_string())?;
        let fwd_id = format!("{}-fwd", bridge_id);
        let rev_id = format!("{}-rev", bridge_id);
        let fwd = bridges.remove(&fwd_id);
        let rev = bridges.remove(&rev_id);
        // Remove from field graphs
        for field in c.fields.values_mut() {
            if let Some(e) = fwd.as_ref() { field.graph.remove_edge(&e.id); }
            if let Some(e) = rev.as_ref() { field.graph.remove_edge(&e.id); }
        }
        Ok(fwd.is_some() || rev.is_some())
    })
}

// ─── Queries ─────────────────────────────────────────────────────

#[napi]
pub fn traverse(handle: i32, field_id: String, node_id: String, relation: Option<String>, cross_field: Option<bool>) -> String {
    let cross = cross_field.unwrap_or(false);
    let result = with_cluster(handle, |c| {
        if let Some(field) = c.get_field(&field_id) {
            let (nodes, edges) = field.traverse(&node_id, relation.as_deref(), cross);
            // For cross-field: also traverse bridges
            if cross {
                let mut all_nodes = nodes;
                let mut all_edges: Vec<graph::types::Edge> = edges.into_iter().cloned().collect();
                for (_, field) in &c.fields {
                    let (n, e) = field.graph.traverse(&node_id, Some("bridges"), false);
                    for nid in n {
                        if !all_nodes.contains(&nid) { all_nodes.push(nid); }
                    }
                    for e in e {
                        all_edges.push(e.clone());
                    }
                }
                Ok(serde_json::json!({"nodes": all_nodes, "edges": all_edges}).to_string())
            } else {
                let edge_vec: Vec<&graph::types::Edge> = edges;
                let edge_owned: Vec<graph::types::Edge> = edge_vec.into_iter().cloned().collect();
                Ok(serde_json::json!({"nodes": nodes, "edges": edge_owned}).to_string())
            }
        } else {
            Err(format!("field '{}' not found", field_id))
        }
    });
    result.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
}

#[napi]
pub fn impact(handle: i32, node_id: String) -> String {
    // Aggregate impact across all fields + bridges
    let result = with_cluster(handle, |c| {
        let mut all_affected: Vec<String> = Vec::new();
        let mut critical = false;
        for field in c.fields.values() {
            let r = field.graph.impact(&node_id);
            for a in r.affected {
                if !all_affected.contains(&a) { all_affected.push(a); }
            }
            if r.critical_path { critical = true; }
        }
        all_affected.sort();
        all_affected.dedup();
        all_affected.retain(|id| id != &node_id);
        Ok(serde_json::json!({
            "changed": node_id,
            "affected": all_affected,
            "blastRadius": [],
            "criticalPath": critical,
        }).to_string())
    });
    result.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
}

#[napi]
pub fn path_query(handle: i32, from_node: String, to_node: String, cross_field: bool) -> String {
    // Try each field's graph
    let result = with_cluster(handle, |c| {
        for field in c.fields.values() {
            let r = field.graph.path(&from_node, &to_node, cross_field);
            if r.exists {
                return Ok(serde_json::json!({
                    "from": r.from,
                    "to": r.to,
                    "path": r.path,
                    "fieldPath": r.field_path,
                    "length": r.length,
                    "exists": true,
                }).to_string());
            }
        }
        Ok(serde_json::json!({
            "from": from_node,
            "to": to_node,
            "path": [],
            "fieldPath": [],
            "length": -1,
            "exists": false,
        }).to_string())
    });
    result.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
}

#[napi]
pub fn centrality(handle: i32, field_id: String, limit: i32) -> String {
    let result = with_cluster(handle, |c| {
        if let Some(field) = c.get_field(&field_id) {
            Ok(serde_json::to_string(&field.graph.centrality(limit as usize))
                .unwrap_or_else(|_| "[]".to_string()))
        } else {
            Err(format!("field '{}' not found", field_id))
        }
    });
    result.unwrap_or_else(|e| format!("[\"{}\"]", e))
}

#[napi]
pub fn health(handle: i32, field_id: String) -> String {
    let result = with_cluster(handle, |c| {
        if let Some(field) = c.get_field(&field_id) {
            let h = field.graph.health();
            Ok(serde_json::json!({
                "totalNodes": h.total_nodes,
                "totalEdges": h.total_edges,
                "orphans": h.orphans,
                "sinks": h.sinks,
                "sources": h.sources,
                "highCentrality": h.high_centrality,
                "disconnectedComponents": h.disconnected_components,
            }).to_string())
        } else {
            Err(format!("field '{}' not found", field_id))
        }
    });
    result.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
}

// ─── Info ────────────────────────────────────────────────────────

#[napi]
pub fn cluster_info(handle: i32) -> String {
    let result = with_cluster(handle, |c| {
        Ok(serde_json::json!({
            "id": c.id,
            "name": c.name,
            "visibility": match c.visibility {
                cluster::Visibility::Public => "public",
                cluster::Visibility::Private => "private",
                cluster::Visibility::Organization => "organization",
            },
            "nodeCount": c.nodes.len(),
            "fieldCount": c.fields.len(),
            "createdAt": c.created_at,
            "updatedAt": c.updated_at,
        }).to_string())
    });
    result.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
}

#[napi]
pub fn field_info(handle: i32, field_id: String) -> String {
    let result = with_cluster(handle, |c| {
        if let Some(field) = c.get_field(&field_id) {
            Ok(serde_json::json!({
                "id": field.id,
                "name": field.name,
                "description": field.description,
                "nodeCount": field.graph.node_count(),
                "edgeCount": field.graph.edge_count(),
                "createdAt": field.created_at,
                "updatedAt": field.updated_at,
            }).to_string())
        } else {
            Err(format!("field '{}' not found", field_id))
        }
    });
    result.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
}

// ─── Sharing ─────────────────────────────────────────────────────

#[napi]
pub fn clone_cluster(handle: i32, options_json: String) -> Result<i32> {
    let opts: cluster::sharing::CloneOptions = serde_json::from_str(&options_json)
        .map_err(|e| Error::from_reason(format!("json parse: {}", e)))?;
    let cluster = {
        let store = CLUSTERS.lock().map_err(|e| Error::from_reason(format!("lock: {}", e)))?;
        store.get(&handle).ok_or_else(|| Error::from_reason("invalid handle"))?.clone()
    };
    let cloned = cluster::sharing::clone_cluster(&cluster, &opts);
    Ok(alloc_handle(cloned))
}

#[napi]
pub fn merge_clusters(target_handle: i32, source_handle: i32, strategy_json: String) -> String {
    let strategy: cluster::sharing::MergeStrategy = serde_json::from_str(&strategy_json)
        .unwrap_or(cluster::sharing::MergeStrategy::Skip);
    let result = with_cluster(target_handle, |target| {
        let source = {
            let store = CLUSTERS.lock().unwrap();
            store.get(&source_handle).cloned()
        };
        match source {
            Some(src) => {
                let r = cluster::sharing::merge_clusters(target, &src, &strategy);
                Ok(serde_json::json!({
                    "nodesAdded": r.nodes_added,
                    "nodesSkipped": r.nodes_skipped,
                    "nodesOverwritten": r.nodes_overwritten,
                    "fieldsAdded": r.fields_added,
                    "fieldsSkipped": r.fields_skipped,
                    "fieldsOverwritten": r.fields_overwritten,
                    "edgesAdded": r.edges_added,
                    "edgesSkipped": r.edges_skipped,
                    "bridgesAdded": r.bridges_added,
                    "warnings": r.warnings,
                }).to_string())
            }
            None => Err("source handle invalid".to_string()),
        }
    });
    result.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
}

#[napi]
pub fn export_json(handle: i32) -> String {
    let result = with_cluster(handle, |c| {
        serde_json::to_string_pretty(c)
            .map_err(|e| format!("serialize error: {}", e))
    });
    result.unwrap_or_else(|e| format!("{{\"error\": \"{}\"}}", e))
}
```

### T1.2 — Add lazy_static to Cargo.toml

**File:** `d:\github projects\statuz\crates\statuz-core-napi\Cargo.toml`

Add `lazy_static = "1"` to dependencies.

### T1.3 — Build napi module

```bash
cd d:\github projects\statuz
cargo build -p statuz-core-napi --release
```

The output will be at `target/release/statuz_core_napi.dll` (Windows) or `.so`/`.dylib`.

### T1.4 — Copy native module to IDE

Copy the built `.dll`/`.so`/`.dylib` to `d:\github projects\Statuz-IDE\build\statuz-native\statuz-core-napi.node`.

### T1.5 — Wire IPC channel to native module

**File:** `src/vs/workbench/contrib/statuz/electron-main/engine/statuzEngineChannel.ts`

Replace the stub with real native module dispatch:

```typescript
import { IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../../base/common/event.js';
import { StatuzEngineRequest, StatuzEngineResponse } from '../../common/engine/statuzEngineChannelId.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nativeModule: any = undefined;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	nativeModule = require('../../../../../../build/statuz-native/statuz-core-napi.node');
} catch (e) {
	console.error('[StatuzEngine] Failed to load native module:', e);
}

export class StatuzEngineChannel implements IServerChannel {
	async call<T>(_ctx: string, command: string, arg?: StatuzEngineRequest): Promise<T> {
		if (command !== 'call') {
			throw new Error(`Unknown command: ${command}`);
		}
		const request = arg!;
		const { method, args } = request;

		if (!nativeModule) {
			const response: StatuzEngineResponse = {
				id: request.id,
				success: false,
				error: { message: 'Statuz Engine native module not loaded', code: 'ENGINE_NOT_READY' },
			};
			return response as unknown as T;
		}

		try {
			const fn = nativeModule[method];
			if (!fn) {
				throw new Error(`Unknown method: ${method}`);
			}
			const result = fn(...args);
			const response: StatuzEngineResponse = { id: request.id, success: true, result };
			return response as unknown as T;
		} catch (e) {
			const response: StatuzEngineResponse = {
				id: request.id,
				success: false,
				error: { message: String(e), code: 'ENGINE_ERROR' },
			};
			return response as unknown as T;
		}
	}

	listen<T>(_event: string, _arg?: unknown): Event<T> {
		return Event.None;
	}
}
```

### T1.6 — Wire service to use IPC

**File:** `src/vs/workbench/contrib/statuz/common/engine/statuzEngineService.ts`

Uncomment the IPC dispatch block and add IMainProcessService dependency:

```typescript
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { STATUZ_ENGINE_CHANNEL_NAME, StatuzEngineRequest, StatuzEngineResponse } from './statuzEngineChannelId.js';

// In constructor, add @IMainProcessService
constructor(
	@ILogService private readonly _logService: ILogService,
	@IMainProcessService private readonly _mainProcessService: IMainProcessService,
) {
	super();
	this._logService.info('[StatuzEngine] Service initialized.');
}

// Replace _callEngine with:
private async _callEngine<T>(method: string, args: unknown[]): Promise<T> {
	const channel = this._mainProcessService.getChannel(STATUZ_ENGINE_CHANNEL_NAME);
	const request: StatuzEngineRequest = { id: crypto.randomUUID(), method, args };
	const response = await channel.call<StatuzEngineResponse>('call', request);
	if (!response.success) {
		throw new Error(response.error?.message ?? 'Unknown engine error');
	}
	return response.result as T;
}
```

---

## Track 2: Minimal UI

### T2.1 — Create statuz.contribution.ts

**File:** `src/vs/workbench/contrib/statuz/browser/statuz.contribution.ts`

```typescript
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IViewContainersRegistry, ViewContainerLocation } from '../../../../workbench/common/views.js';
import { IViewDescriptor, IViewsRegistry, ViewContainer } from '../../../../workbench/common/views.js';
import { localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { StatuzViewPane } from './statuzViewPane.js';
import { ClusterExplorerView } from './clusterExplorer.js';

// Register Statuz ViewContainer
const STATUZ_VIEW_CONTAINER_ID = 'statuz';
const container = Registry.as<IViewContainersRegistry>(Extensions.ViewContainersRegistry)
	.registerViewContainer({
		id: STATUZ_VIEW_CONTAINER_ID,
		name: localize('statuz', 'Statuz'),
		icon: undefined, // TODO: add icon
		hideIfEmpty: true,
		order: 10,
	}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });

// Register Statuz views
const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: 'statuz.clusterExplorer',
	name: localize('statuz.clusterExplorer', 'Cluster Explorer'),
	containerIcon: undefined,
	ctorDescriptor: new SyncDescriptor(ClusterExplorerView),
	canToggleVisibility: true,
	canMoveView: false,
	order: 0,
}], container);
```

### T2.2 — Create statuzViewPane.ts

**File:** `src/vs/workbench/contrib/statuz/browser/statuzViewPane.ts`

```typescript
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';

export class StatuzViewPane extends ViewPane {
	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, openerService, themeService, telemetryService);
	}
}
```

### T2.3 — Create clusterExplorer.ts

**File:** `src/vs/workbench/contrib/statuz/browser/clusterExplorer.ts`

```typescript
import { ITreeView, ITreeItem, TreeItemCollapsibleState, IViewDescriptor } from '../../../common/views.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { TreeViewPane } from '../../../browser/parts/views/treeView.js';
import { IStatuzEngineService } from '../common/engine/statuzEngineService.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';

export class ClusterExplorerView extends TreeViewPane {
	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IStatuzEngineService private readonly _statuzEngine: IStatuzEngineService,
	) {
		super(options, instantiationService, viewDescriptorService, contextKeyService, keybindingService, contextMenuService, configurationService, openerService, themeService, telemetryService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		// TODO: Populate tree with clusters, fields, nodes from engine
		// For now, the tree is empty (visible after native module is loaded)
	}
}
```

### T2.4 — Graph Webview (Graph Visualizer)

**File:** `src/vs/workbench/contrib/statuz/browser/graphWebview.ts`

A webview that renders an SVG force-directed graph. The webview receives node/edge data via `postMessage` and renders it with a simple force-directed layout algorithm in pure SVG (no external dependencies).

```typescript
import { Disposable } from '../../../../base/common/lifecycle.js';

export class GraphWebview extends Disposable {
	// TODO: Implement webview-based SVG graph visualization
	// - Receives { nodes: Node[], edges: Edge[] } via postMessage
	// - Renders SVG with force-directed layout
	// - Click node to select, highlight connected edges
	// - Zoom/pan via SVG transform
}
```

### T2.5 — Query Console Webview

**File:** `src/vs/workbench/contrib/statuz/browser/queryConsole.ts`

A webview with:
- Dropdown to select query type: traverse / impact / path
- Input fields for node IDs, relation, etc.
- Submit button
- Results rendered as JSON + visual highlights

```typescript
import { Disposable } from '../../../../base/common/lifecycle.js';

export class QueryConsole extends Disposable {
	// TODO: Implement webview-based query console
	// - Query type selector (traverse/impact/path)
	// - Input fields for parameters
	// - Execute button → calls IStatuzEngineService
	// - Results displayed as formatted JSON + graph overlay
}
```

---

## Execution Order

### Track 1 (napi-rs bridge — must be done first, UI depends on it)

1. Write `crates/statuz-core-napi/src/lib.rs` with all exports
2. Add `lazy_static` to Cargo.toml
3. Build the native module
4. Copy output to IDE's `build/statuz-native/`
5. Update `statuzEngineChannel.ts` to load native module
6. Update `statuzEngineService.ts` to use IPC
7. Run TSC check

### Track 2 (UI — can be developed in parallel with type stubs)

1. Create `statuz.contribution.ts` — register ViewContainer
2. Create `statuzViewPane.ts` — base ViewPane
3. Create `clusterExplorer.ts` — TreeView (stub for now)
4. Create `graphWebview.ts` — webview SVG graph
5. Create `queryConsole.ts` — webview query console
6. Wire all views into contribution
7. Run TSC check