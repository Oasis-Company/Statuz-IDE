/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *
 *  Phase 3: Unified Diagram Module Entry Point
 *
 *  Replaces the legacy split between BoardCanvas (board/) and AgentCanvas (harness/).
 *  All diagram functionality is now data-driven through ArchitectureDiagramEngine +
 *  DiagramDefinition configurations.
 *
 *  Architecture documentation: see README.md in this directory.
 *--------------------------------------------------------------------------------------------*/

/* ─── Core Engine ──────────────────────────────────────────── */

export { ArchitectureDiagramEngine } from './architectureDiagramEngine.js';

/* ─── State & Persistence ──────────────────────────────────── */

export { DiagramStateManager } from './diagramStateManager.js';
export { DiagramUndoRedo } from './diagramUndoRedo.js';

/* ─── UI Components ────────────────────────────────────────── */

export { DiagramToolbar } from './diagramToolbar.js';

/* ─── Rendering Utilities ──────────────────────────────────── */

export {
	registerNodeType,
	getNodeTypeConfig,
	hasNodeType,
	getAllNodeTypes,
	clearNodeTypeRegistry,
} from './diagramNodeRegistry.js';
export { DiagramLayoutEngine } from './diagramLayoutEngine.js';
export * as DiagramPortUtils from './diagramPortUtils.js';
export * as DiagramEdgeUtils from './diagramEdgeUtils.js';

/* ─── Type System ──────────────────────────────────────────── */

export type {
	DiagramDefinition,
	DiagramNodeDefinition,
	DiagramEdgeDefinition,
	DiagramNodeTypeConfig,
	DiagramEdgeTypeConfig,
	DiagramSnapshot,
	StoredViewport,
	DiagramNodeRenderState,
	DiagramNodeCallbacks,
	ContextMenuAction,
	ConnectState,
	DiagramPort,
	DiagramState,
	PipelineDefinition,
	PipelineStage,
	DiagramToolbarConfig,
	DiagramCallbacks,
	LayoutStrategy,
	StorageSchema,
} from './diagramTypes.js';

/* ─── Diagram Definitions ──────────────────────────────────── */

export { boardDiagramDefinition } from './boardDiagramDefinition.js';
export { agentDiagramDefinition } from './agentDiagramDefinition.js';