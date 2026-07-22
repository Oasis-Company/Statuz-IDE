/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Universal Customizable Architecture Diagram Engine — Core Types
 *--------------------------------------------------------------------------------------------*/

/* ─── Diagram Node Definition ───────────────────────────── */

export interface DiagramNodeDefinition {
	id: string;
	/** Arbitrary string — no enum, extensible by design. Interpreted by registered renderer. */
	type: string;
	position: { x: number; y: number };
	size?: { width: number; height: number };
	collapsed?: boolean;
	/** Domain-specific payload passed through to the renderer. */
	metadata?: Record<string, unknown>;
}

/* ─── Diagram Edge Definition ───────────────────────────── */

export interface DiagramEdgeDefinition {
	id: string;
	source: string;
	target: string;
	/** Arbitrary string — extensible by design. */
	type: string;
	label?: string;
	metadata?: Record<string, unknown>;
}

/* ─── Diagram Port ──────────────────────────────────────── */

export interface DiagramPort {
	side: 'top' | 'right' | 'bottom' | 'left';
	x: number;
	y: number;
}

/* ─── Stored Viewport ───────────────────────────────────── */

export interface StoredViewport {
	x: number;
	y: number;
	zoom: number;
	width?: number;
	height?: number;
}

/* ─── Node Render State ─────────────────────────────────── */

export interface DiagramNodeRenderState {
	dimmed: boolean;
	selected: boolean;
	highlighted: boolean;
}

/* ─── Context Menu Action ───────────────────────────────── */

export interface ContextMenuAction {
	id: string;
	label: string;
	checked?: string;
	enabled: boolean;
	handler: () => void;
}

/* ─── Diagram Callbacks ─────────────────────────────────── */

export interface DiagramCallbacks {
	onNodeDoubleClick?: (nodeId: string, nodeType: string) => void;
	onAddEdge?: (source: string, target: string, type: string) => void;
	onRemoveEdge?: (edgeId: string) => void;
	onRemoveNode?: (nodeId: string, nodeType: string) => void;
	onLayoutChange?: (layout: string) => void;
	onFitView?: () => void;
	onSelectionChange?: (nodeIds: string[], edgeId: string | null) => void;
	onDataChange?: (nodes: DiagramNodeDefinition[], edges: DiagramEdgeDefinition[]) => void;
}

/* ─── Node Type Configuration ───────────────────────────── */

export type DiagramNodeRenderer = (
	layout: DiagramNodeDefinition,
	item: unknown,
	state: DiagramNodeRenderState,
	callbacks: DiagramNodeCallbacks,
) => SVGGElement;

export interface DiagramNodeCallbacks {
	getNodePorts: (layout: DiagramNodeDefinition) => DiagramPort[];
	startConnection: (nodeId: string, port: DiagramPort, edgeType: string) => void;
}

export interface DiagramNodeTypeConfig {
	type: string;
	displayName: string;
	defaultDimensions: { width: number; height: number };
	color: string;
	icon?: string;
	renderer: DiagramNodeRenderer;
}

/* ─── Edge Type Configuration ───────────────────────────── */

export type DiagramEdgeRenderer = (
	edge: DiagramEdgeDefinition,
	sourceLayout: DiagramNodeDefinition,
	targetLayout: DiagramNodeDefinition,
	selected: boolean,
	config: DiagramEdgeTypeConfig,
) => SVGGElement;

export interface DiagramEdgeTypeConfig {
	type: string;
	displayName: string;
	color: string;
	strokeDasharray?: string;
	arrowMarker?: boolean;
	renderer?: DiagramEdgeRenderer;
}

/* ─── Toolbar Configuration ─────────────────────────────── */

export interface DiagramToolbarConfig {
	showUndoRedo: boolean;
	showZoom: boolean;
	showFitView: boolean;
	showAutoLayout: boolean;
	showAddNode: boolean;
}

/* ─── Context Menu Configuration ────────────────────────── */

export interface DiagramContextMenuConfig {
	canvasActions: ContextMenuAction[];
	nodeActions: ContextMenuAction[];
	edgeActions: ContextMenuAction[];
}

/* ─── Diagram Definition (Top-Level Config) ─────────────── */

export interface DiagramDefinition {
	id: string;
	nodeTypes: DiagramNodeTypeConfig[];
	edgeTypes: DiagramEdgeTypeConfig[];
	storageKey: string;
	maxUndoSteps: number;
	defaultViewport: StoredViewport;
	toolbar: DiagramToolbarConfig;
	contextMenu: DiagramContextMenuConfig;
	callbacks: DiagramCallbacks;
}

/* ─── Diagram Snapshot (for undo/redo) ──────────────────── */

export interface DiagramSnapshot {
	layouts: DiagramNodeDefinition[];
	edges: DiagramEdgeDefinition[];
	viewport: StoredViewport;
}

/* ─── Diagram State (persisted to localStorage) ─────────── */

export interface DiagramState {
	projectId: string | null;
	layouts: DiagramNodeDefinition[];
	edges: DiagramEdgeDefinition[];
	viewport: StoredViewport;
}

/* ─── Layout Strategy ───────────────────────────────────── */

export interface LayoutStrategy {
	name: string;
	layout(
		nodes: DiagramNodeDefinition[],
		edges: DiagramEdgeDefinition[],
		definition: DiagramDefinition,
	): DiagramNodeDefinition[];
}

/* ─── Connect State (drag-to-connect) ───────────────────── */

export interface ConnectState {
	sourceNodeId: string;
	sourcePort: DiagramPort;
	sourceType: string;
	mousePos: { x: number; y: number };
}

/* ─── Action Observation (harness-construction contract) ── */

export interface ActionObservation {
	status: 'success' | 'warning' | 'error';
	summary: string;
	next_actions: string[];
	artifacts: {
		affectedNodeIds: string[];
		affectedEdgeIds: string[];
		viewportChanged: boolean;
	};
}

/* ─── Pipeline Definition (for Agent pipeline mode) ─────── */

export interface PipelineDefinition {
	stages: PipelineStage[];
}

export interface PipelineStage {
	name: string;
	allowedNodeTypes: string[];
	allowedEdgeTypes: string[];
}

/* ─── StorageSchema<T> — manual validation (project constraint: no Zod) ── */

export interface StorageSchema<T> {
	validate(data: unknown): data is T;
	defaultValue: T;
}