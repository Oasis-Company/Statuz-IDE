/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: ArchitectureDiagramEngine — universal data-driven SVG canvas
 *--------------------------------------------------------------------------------------------*/

import type {
	DiagramDefinition,
	DiagramNodeDefinition,
	DiagramEdgeDefinition,
	DiagramSnapshot,
	DiagramNodeRenderState,
	ConnectState,
	PipelineDefinition,
} from './diagramTypes.js';
import type { DiagramStateManager } from './diagramStateManager.js';
import type { DiagramUndoRedo } from './diagramUndoRedo.js';
import type { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { Action } from '../../../../../base/common/actions.js';
import type { IContextMenuDelegate } from '../../../../../base/browser/contextmenu.js';
import { getNodeTypeConfig } from './diagramNodeRegistry.js';
import {
	renderEdgePath, renderEdgeLabel, renderConnectionHandles,
	renderTempEdge, renderArrowMarkerDefs, applyNodeRenderState,
	createSVGElement,
} from './diagramEdgeUtils.js';
import { getNodePorts } from './diagramPortUtils.js';
import { DiagramLayoutEngine } from './diagramLayoutEngine.js';

/* ─── Constants ──────────────────────────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCROLL_ZOOM_FACTOR = 0.001;

/* ─── ArchitectureDiagramEngine ───────────────────────────── */

export class ArchitectureDiagramEngine {
	private svg: SVGSVGElement;
	private container: HTMLElement;
	private boardGroup: SVGGElement;
	private edgeGroup: SVGGElement;
	private nodeGroup: SVGGElement;
	private tempEdgeGroup: SVGGElement;
	private defs: SVGDefsElement;

	private definition: DiagramDefinition;
	private stateManager: DiagramStateManager;
	private undoRedo: DiagramUndoRedo;
	private contextMenuService: IContextMenuService;
	private layoutEngine: DiagramLayoutEngine;
	private data: unknown[] = [];

	// Interaction state
	private isPanning = false;
	private isDraggingNode = false;
	private dragNodeIds: Set<string> = new Set();
	private dragStart = { x: 0, y: 0 };
	private dragNodePositions: Map<string, { x: number; y: number }> = new Map();
	private selectedNodeIds: Set<string> = new Set();
	private selectedEdgeId: string | null = null;

	// Drag-to-connect
	private connectState: ConnectState | null = null;

	// Pipeline mode
	private pipelineLayoutSnapshot: DiagramSnapshot | null = null;
	private pipelineMode = false;

	// Viewport
	private viewBox = { x: 0, y: 0, width: 1200, height: 800 };

	// Bound handlers for cleanup
	private boundMouseDown: (e: MouseEvent) => void;
	private boundMouseMove: (e: MouseEvent) => void;
	private boundMouseUp: (e: MouseEvent) => void;
	private boundWheel: (e: WheelEvent) => void;
	private boundDoubleClick: (e: MouseEvent) => void;
	private boundContextMenu: (e: MouseEvent) => void;
	private boundKeyDown: (e: KeyboardEvent) => void;

	constructor(
		container: HTMLElement,
		definition: DiagramDefinition,
		stateManager: DiagramStateManager,
		undoRedo: DiagramUndoRedo,
		contextMenuService: IContextMenuService,
	) {
		this.container = container;
		this.definition = definition;
		this.stateManager = stateManager;
		this.undoRedo = undoRedo;
		this.contextMenuService = contextMenuService;
		this.layoutEngine = new DiagramLayoutEngine();

		// Bind all handlers
		this.boundMouseDown = this.onMouseDown.bind(this);
		this.boundMouseMove = this.onMouseMove.bind(this);
		this.boundMouseUp = this.onMouseUp.bind(this);
		this.boundWheel = this.onWheel.bind(this);
		this.boundDoubleClick = this.onDoubleClick.bind(this);
		this.boundContextMenu = this.onContextMenu.bind(this);
		this.boundKeyDown = this.onKeyDown.bind(this);

		// Build SVG
		this.svg = this.createSVG();
		this.defs = createSVGElement('defs');
		this.svg.appendChild(this.defs);
		this.edgeGroup = createSVGElement('g', { class: 'diagram-edges' });
		this.nodeGroup = createSVGElement('g', { class: 'diagram-nodes' });
		this.tempEdgeGroup = createSVGElement('g', { class: 'diagram-temp-edges' });
		this.boardGroup = createSVGElement('g', { class: 'diagram-root' });
		this.boardGroup.appendChild(this.edgeGroup);
		this.boardGroup.appendChild(this.nodeGroup);
		this.boardGroup.appendChild(this.tempEdgeGroup);
		this.svg.appendChild(this.boardGroup);
		container.appendChild(this.svg);

		// Load viewport
		const state = stateManager.getState();
		this.viewBox = {
			x: state.viewport.x,
			y: state.viewport.y,
			width: definition.defaultViewport.width || 1200,
			height: definition.defaultViewport.height || 800,
		};
		this.applyViewBox();

		this.bindEvents();
		this.render();
		this.installContextMenuHandlers();
	}

	/* ─── Public API ──────────────────────────────────────── */

	updateData(data: unknown[]): void {
		this.data = data;
		this.render();
	}

	render(): void {
		this.updateArrowDefs();
		this.renderEdges();
		this.renderNodes();
	}

	focus(): void {
		this.svg.focus();
	}

	fitView(): void {
		const state = this.stateManager.getState();
		if (state.layouts.length === 0) { return; }

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		for (const layout of state.layouts) {
			const config = getNodeTypeConfig(layout.type);
			const w = layout.size?.width ?? config?.defaultDimensions.width ?? 200;
			const h = layout.size?.height ?? config?.defaultDimensions.height ?? 100;
			minX = Math.min(minX, layout.position.x);
			minY = Math.min(minY, layout.position.y);
			maxX = Math.max(maxX, layout.position.x + w);
			maxY = Math.max(maxY, layout.position.y + h);
		}

		const padding = 80;
		this.viewBox = {
			x: minX - padding,
			y: minY - padding,
			width: maxX - minX + padding * 2,
			height: maxY - minY + padding * 2,
		};
		this.applyViewBox();
		this.stateManager.setViewport({ x: this.viewBox.x, y: this.viewBox.y, zoom: this.getZoom() });
	}

	autoLayout(): void {
		const state = this.stateManager.getState();
		const strategy = state.layouts.length > 0
			? this.definition.layoutStrategy || 'column'
			: 'column';
		const updated = this.layoutEngine.layout(
			strategy,
			state.layouts,
			state.edges,
			this.definition,
		);
		this.stateManager.setLayouts(updated);
		this.render();
	}

	getNodeLayouts(): DiagramNodeDefinition[] {
		return this.stateManager.getState().layouts;
	}

	getEdges(): DiagramEdgeDefinition[] {
		return this.stateManager.getState().edges;
	}

	getZoom(): number {
		const rect = this.svg.getBoundingClientRect();
		// Fallback to container dimensions when getBoundingClientRect returns 0 (jsdom/test env)
		if (rect.width > 0) {
			return rect.width / this.viewBox.width;
		}
		const containerWidth = this.container.clientWidth;
		if (containerWidth > 0) {
			return containerWidth / this.viewBox.width;
		}
		// Default: assume 1:1 mapping
		return 1.0;
	}

	enablePipelineMode(pipeline: PipelineDefinition): void {
		if (this.pipelineMode) { return; }

		// Save current layout as snapshot for rollback
		this.pipelineLayoutSnapshot = this.takeSnapshot();
		this.pipelineMode = true;

		// Apply pipeline layout
		this.layoutEngine.setPipeline(pipeline);
		const state = this.stateManager.getState();
		const updated = this.layoutEngine.layout(
			'pipeline',
			state.layouts,
			state.edges,
			this.definition,
		);
		this.pushUndoSnapshot();
		this.stateManager.setLayouts(updated);
		this.render();
	}

	disablePipelineMode(): void {
		if (!this.pipelineMode) { return; }

		this.pipelineMode = false;
		this.layoutEngine.setPipeline({ stages: [] });

		// Restore previous layout, or fallback to autoLayout
		if (this.pipelineLayoutSnapshot) {
			this.restoreSnapshot(this.pipelineLayoutSnapshot);
			this.pipelineLayoutSnapshot = null;
		} else {
			this.autoLayout();
		}
		this.render();
	}

	destroy(): void {
		this.unbindEvents();
		this.stateManager.destroy();
		if (this.container.contains(this.svg)) {
			this.container.removeChild(this.svg);
		}
	}

	/* ─── SVG Creation ────────────────────────────────────── */

	private createSVG(): SVGSVGElement {
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('class', 'diagram-canvas');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		svg.style.cssText = 'display:block;cursor:grab;';
		svg.setAttribute('tabindex', '0');
		return svg;
	}

	/* ─── Arrow Defs ──────────────────────────────────────── */

	private updateArrowDefs(): void {
		while (this.defs.firstChild) {
			this.defs.removeChild(this.defs.firstChild);
		}
		const arrowDefs = renderArrowMarkerDefs(this.definition.edgeTypes);
		while (arrowDefs.firstChild) {
			this.defs.appendChild(arrowDefs.firstChild);
		}
	}

	/* ─── ViewBox ─────────────────────────────────────────── */

	private applyViewBox(): void {
		this.svg.setAttribute(
			'viewBox',
			`${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`,
		);
	}

	private zoomAt(centerX: number, centerY: number, delta: number): void {
		const factor = 1 - delta;
		const newWidth = this.viewBox.width * factor;
		const newHeight = this.viewBox.height * factor;

		if (newWidth < 200 || newWidth > 8000) { return; }

		const ratioX = (centerX - this.viewBox.x) / this.viewBox.width;
		const ratioY = (centerY - this.viewBox.y) / this.viewBox.height;

		this.viewBox.x = centerX - ratioX * newWidth;
		this.viewBox.y = centerY - ratioY * newHeight;
		this.viewBox.width = newWidth;
		this.viewBox.height = newHeight;

		this.applyViewBox();
	}

	private clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
		const rect = this.svg.getBoundingClientRect();
		return {
			x: this.viewBox.x + (clientX - rect.left) * (this.viewBox.width / rect.width),
			y: this.viewBox.y + (clientY - rect.top) * (this.viewBox.height / rect.height),
		};
	}

	/* ─── Event Binding ───────────────────────────────────── */

	private bindEvents(): void {
		this.svg.addEventListener('mousedown', this.boundMouseDown);
		window.addEventListener('mousemove', this.boundMouseMove);
		window.addEventListener('mouseup', this.boundMouseUp);
		this.svg.addEventListener('wheel', this.boundWheel, { passive: false });
		this.svg.addEventListener('dblclick', this.boundDoubleClick);
		this.svg.addEventListener('contextmenu', this.boundContextMenu);
		document.addEventListener('keydown', this.boundKeyDown);
	}

	private unbindEvents(): void {
		this.svg.removeEventListener('mousedown', this.boundMouseDown);
		window.removeEventListener('mousemove', this.boundMouseMove);
		window.removeEventListener('mouseup', this.boundMouseUp);
		this.svg.removeEventListener('wheel', this.boundWheel);
		this.svg.removeEventListener('dblclick', this.boundDoubleClick);
		this.svg.removeEventListener('contextmenu', this.boundContextMenu);
		document.removeEventListener('keydown', this.boundKeyDown);
	}

	/* ─── Mouse: Down ─────────────────────────────────────── */

	private onMouseDown(e: MouseEvent): void {
		const target = e.target as Element;

		// Connection handle
		const handle = target.closest('.diagram-connection-handle') as SVGElement;
		if (handle) {
			this.startConnection(handle, e);
			return;
		}

		// Edge click
		const edgeEl = target.closest('[data-edge-id]') as SVGElement;
		if (edgeEl) {
			this.selectEdge(edgeEl.getAttribute('data-edge-id')!);
			e.preventDefault();
			return;
		}

		// Node drag
		const nodeEl = target.closest('[data-node-id]') as SVGElement;
		if (nodeEl && !e.shiftKey) {
			this.startNodeDrag(nodeEl, e);
			return;
		}

		// Background pan
		if (e.button === 0 || e.button === 1) {
			this.isPanning = true;
			this.dragStart = { x: e.clientX, y: e.clientY };
			this.svg.style.cursor = 'grabbing';
			this.deselectAll();
			e.preventDefault();
		}
	}

	/* ─── Mouse: Move ─────────────────────────────────────── */

	private onMouseMove(e: MouseEvent): void {
		// Drag-to-connect
		if (this.connectState) {
			const svgPos = this.clientToSvg(e.clientX, e.clientY);
			this.connectState.mousePos = { x: svgPos.x, y: svgPos.y };
			this.renderTempEdge();
			return;
		}

		// Pan
		if (this.isPanning) {
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);
			this.viewBox.x -= dx;
			this.viewBox.y -= dy;
			this.applyViewBox();
			this.dragStart = { x: e.clientX, y: e.clientY };
			return;
		}

		// Node drag
		if (this.isDraggingNode && this.dragNodeIds.size > 0) {
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);

			for (const nodeId of this.dragNodeIds) {
				const startPos = this.dragNodePositions.get(nodeId);
				if (!startPos) { continue; }
				const newX = startPos.x + dx;
				const newY = startPos.y + dy;

				const nodeEl = this.nodeGroup.querySelector(`[data-node-id="${nodeId}"]`);
				if (nodeEl) {
					nodeEl.setAttribute('transform', `translate(${newX}, ${newY})`);
				}
			}
			return;
		}
	}

	/* ─── Mouse: Up ───────────────────────────────────────── */

	private onMouseUp(e: MouseEvent): void {
		// End drag-to-connect
		if (this.connectState) {
			const target = e.target as Element;
			const nodeEl = target.closest('[data-node-id]') as SVGElement;
			if (nodeEl) {
				this.finishConnection(nodeEl.getAttribute('data-node-id')!);
			}
			this.connectState = null;
			this.clearTempEdge();
			this.render();
			return;
		}

		// End pan
		if (this.isPanning) {
			this.isPanning = false;
			this.svg.style.cursor = 'grab';
			this.stateManager.setViewport({ x: this.viewBox.x, y: this.viewBox.y, zoom: this.getZoom() });
			return;
		}

		// End node drag
		if (this.isDraggingNode) {
			this.isDraggingNode = false;
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);

			for (const nodeId of this.dragNodeIds) {
				const startPos = this.dragNodePositions.get(nodeId);
				if (!startPos) { continue; }
				this.stateManager.updateNodePosition(nodeId, {
					x: startPos.x + dx,
					y: startPos.y + dy,
				});
			}
			this.dragNodeIds.clear();
			this.dragNodePositions.clear();
			return;
		}
	}

	/* ─── Wheel: Zoom ─────────────────────────────────────── */

	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		const svgPos = this.clientToSvg(e.clientX, e.clientY);
		this.zoomAt(svgPos.x, svgPos.y, e.deltaY * SCROLL_ZOOM_FACTOR);
		this.stateManager.setViewport({ x: this.viewBox.x, y: this.viewBox.y, zoom: this.getZoom() });
	}

	/* ─── Double Click ────────────────────────────────────── */

	private onDoubleClick(e: MouseEvent): void {
		const target = e.target as Element;
		const nodeEl = target.closest('[data-node-id]') as SVGElement;
		if (nodeEl) {
			const nodeId = nodeEl.getAttribute('data-node-id')!;
			const nodeType = nodeEl.getAttribute('data-node-type')!;
			this.definition.callbacks.onNodeDoubleClick?.(nodeId, nodeType);
		}
	}

	/* ─── Context Menu ────────────────────────────────────── */

	private onContextMenu(e: MouseEvent): void {
		e.preventDefault();
		const target = e.target as Element;

		const edgeEl = target.closest('[data-edge-id]') as SVGElement;
		if (edgeEl) {
			const edgeId = edgeEl.getAttribute('data-edge-id')!;
			this.selectEdge(edgeId);
			this.showEdgeContextMenu(edgeId, e);
			return;
		}

		const nodeEl = target.closest('[data-node-id]') as SVGElement;
		if (nodeEl) {
			const nodeId = nodeEl.getAttribute('data-node-id')!;
			this.selectedNodeIds = new Set([nodeId]);
			this.render();
			this.showNodeContextMenu(nodeId, e);
			return;
		}

		this.showCanvasContextMenu(e);
	}

	/* ─── Keyboard ────────────────────────────────────────── */

	private onKeyDown(e: KeyboardEvent): void {
		if (document.activeElement !== this.svg) { return; }

		// Delete
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			this.deleteSelected();
			return;
		}

		// Select all
		if (e.key === 'a' && e.ctrlKey) {
			e.preventDefault();
			this.selectAll();
			return;
		}

		// Escape
		if (e.key === 'Escape') {
			e.preventDefault();
			this.deselectAll();
			return;
		}

		// Undo
		if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
			e.preventDefault();
			this.undo();
			return;
		}

		// Redo
		if ((e.key === 'z' && e.ctrlKey && e.shiftKey) || (e.key === 'y' && e.ctrlKey)) {
			e.preventDefault();
			this.redo();
			return;
		}

		// Duplicate
		if (e.key === 'd' && e.ctrlKey) {
			e.preventDefault();
			this.duplicateSelected();
			return;
		}

		// Arrow nudge
		const step = e.shiftKey ? 10 : 1;
		let dx = 0, dy = 0;
		if (e.key === 'ArrowUp') { dy = -step; }
		if (e.key === 'ArrowDown') { dy = step; }
		if (e.key === 'ArrowLeft') { dx = -step; }
		if (e.key === 'ArrowRight') { dx = step; }

		if (dx !== 0 || dy !== 0) {
			e.preventDefault();
			this.nudgeSelected(dx, dy);
		}
	}

	/* ─── Node Drag ───────────────────────────────────────── */

	private startNodeDrag(nodeEl: SVGElement, e: MouseEvent): void {
		const nodeId = nodeEl.getAttribute('data-node-id')!;

		if (!this.selectedNodeIds.has(nodeId)) {
			this.selectedNodeIds = new Set([nodeId]);
		}

		this.isDraggingNode = true;
		this.dragNodeIds = new Set(this.selectedNodeIds);
		this.dragStart = { x: e.clientX, y: e.clientY };
		this.dragNodePositions.clear();

		const state = this.stateManager.getState();
		for (const id of this.dragNodeIds) {
			const layout = state.layouts.find(n => n.id === id);
			if (layout) {
				this.dragNodePositions.set(id, { x: layout.position.x, y: layout.position.y });
			}
		}

		e.preventDefault();
		e.stopPropagation();
	}

	/* ─── Drag-to-Connect ─────────────────────────────────── */

	private startConnection(handle: SVGElement, e: MouseEvent): void {
		const nodeId = handle.getAttribute('data-node-id')!;
		const portSide = handle.getAttribute('data-port-side')! as 'top' | 'right' | 'bottom' | 'left';

		const state = this.stateManager.getState();
		const layout = state.layouts.find(n => n.id === nodeId);
		if (!layout) { return; }

		const config = getNodeTypeConfig(layout.type);
		const dims = config?.defaultDimensions ?? { width: 200, height: 100 };
		const ports = getNodePorts(layout, dims);
		const port = ports.find(p => p.side === portSide) || ports[0];

		// Pick first edge type as default
		const defaultEdgeType = this.definition.edgeTypes[0]?.type ?? 'depends-on';

		this.connectState = {
			sourceNodeId: nodeId,
			sourcePort: port,
			sourceType: defaultEdgeType,
			mousePos: this.clientToSvg(e.clientX, e.clientY),
		};

		e.preventDefault();
		e.stopPropagation();
	}

	private finishConnection(targetNodeId: string): void {
		if (!this.connectState) { return; }
		if (targetNodeId === this.connectState.sourceNodeId) { return; }

		// Push snapshot before change
		this.pushUndoSnapshot();

		this.stateManager.addEdge(
			this.connectState.sourceNodeId,
			targetNodeId,
			this.connectState.sourceType,
		);

		this.definition.callbacks.onAddEdge?.(
			this.connectState.sourceNodeId,
			targetNodeId,
			this.connectState.sourceType,
		);
	}

	/* ─── Selection ───────────────────────────────────────── */

	private selectEdge(edgeId: string): void {
		this.selectedEdgeId = edgeId;
		this.selectedNodeIds.clear();
		this.render();
	}

	private selectAll(): void {
		const state = this.stateManager.getState();
		this.selectedNodeIds = new Set(state.layouts.map(n => n.id));
		this.selectedEdgeId = null;
		this.render();
	}

	private deselectAll(): void {
		this.selectedNodeIds.clear();
		this.selectedEdgeId = null;
		this.render();
	}

	/* ─── Delete ──────────────────────────────────────────── */

	private deleteSelected(): void {
		if (this.selectedNodeIds.size === 0 && !this.selectedEdgeId) { return; }

		this.pushUndoSnapshot();

		if (this.selectedEdgeId) {
			this.stateManager.removeEdge(this.selectedEdgeId);
			this.definition.callbacks.onRemoveEdge?.(this.selectedEdgeId);
			this.selectedEdgeId = null;
		}

		for (const nodeId of this.selectedNodeIds) {
			const layout = this.stateManager.getState().layouts.find(n => n.id === nodeId);
			this.stateManager.removeNodeLayout(nodeId);
			this.definition.callbacks.onRemoveNode?.(nodeId, layout?.type ?? '');
		}
		this.selectedNodeIds.clear();
		this.render();
	}

	/* ─── Duplicate ───────────────────────────────────────── */

	private duplicateSelected(): void {
		const state = this.stateManager.getState();
		this.pushUndoSnapshot();

		for (const nodeId of this.selectedNodeIds) {
			const layout = state.layouts.find(n => n.id === nodeId);
			if (!layout) { continue; }

			const newId = `${nodeId}-copy-${Date.now().toString(36)}`;
			this.stateManager.addNodeLayout(newId, layout.type, {
				x: layout.position.x + 20,
				y: layout.position.y + 20,
			});
		}
		this.render();
	}

	/* ─── Nudge ───────────────────────────────────────────── */

	private nudgeSelected(dx: number, dy: number): void {
		this.pushUndoSnapshot();
		for (const nodeId of this.selectedNodeIds) {
			const layout = this.stateManager.getState().layouts.find(n => n.id === nodeId);
			if (layout) {
				this.stateManager.updateNodePosition(nodeId, {
					x: layout.position.x + dx,
					y: layout.position.y + dy,
				});
			}
		}
		this.render();
	}

	/* ─── Undo / Redo ─────────────────────────────────────── */

	public undo(): void {
		const current = this.takeSnapshot();
		const snapshot = this.undoRedo.undo(current);
		if (snapshot) { this.restoreSnapshot(snapshot); }
	}

	public redo(): void {
		const current = this.takeSnapshot();
		const snapshot = this.undoRedo.redo(current);
		if (snapshot) { this.restoreSnapshot(snapshot); }
	}

	public canUndo(): boolean {
		return this.undoRedo.canUndo();
	}

	public canRedo(): boolean {
		return this.undoRedo.canRedo();
	}

	/* ─── Zoom ─────────────────────────────────────────────── */

	public zoomIn(): void {
		const centerX = this.viewBox.x + this.viewBox.width / 2;
		const centerY = this.viewBox.y + this.viewBox.height / 2;
		this.zoomAt(centerX, centerY, -0.1);
	}

	public zoomOut(): void {
		const centerX = this.viewBox.x + this.viewBox.width / 2;
		const centerY = this.viewBox.y + this.viewBox.height / 2;
		this.zoomAt(centerX, centerY, 0.1);
	}

	private pushUndoSnapshot(): void {
		this.undoRedo.pushSnapshot(this.takeSnapshot());
	}

	private takeSnapshot(): DiagramSnapshot {
		const state = this.stateManager.getState();
		return {
			layouts: state.layouts,
			edges: state.edges,
			viewport: { x: this.viewBox.x, y: this.viewBox.y, zoom: this.getZoom() },
		};
	}

	private restoreSnapshot(snapshot: DiagramSnapshot): void {
		this.stateManager.setLayouts(snapshot.layouts);
		this.stateManager.setEdges(snapshot.edges);
		this.viewBox.x = snapshot.viewport.x;
		this.viewBox.y = snapshot.viewport.y;
		this.applyViewBox();
		this.render();
	}

	/* ─── Context Menus ───────────────────────────────────── */

	private showCanvasContextMenu(e: MouseEvent): void {
		const actions = this.definition.contextMenu.canvasActions
			.filter(a => a.enabled)
			.map(a => new Action(a.id, a.label, a.checked, true, a.handler));

		this.showContextMenu(e, actions);
	}

	private showNodeContextMenu(nodeId: string, e: MouseEvent): void {
		const actions = this.definition.contextMenu.nodeActions
			.filter(a => a.enabled)
			.map(a => new Action(a.id, a.label, a.checked, true, () => a.handler()));

		this.showContextMenu(e, actions);
	}

	private showEdgeContextMenu(edgeId: string, e: MouseEvent): void {
		const actions = this.definition.contextMenu.edgeActions
			.filter(a => a.enabled)
			.map(a => new Action(a.id, a.label, a.checked, true, () => a.handler()));

		this.showContextMenu(e, actions);
	}

	private showContextMenu(e: MouseEvent, actions: Action[]): void {
		if (actions.length === 0) { return; }

		const delegate: IContextMenuDelegate = {
			getAnchor: () => ({ x: e.clientX, y: e.clientY }),
			getActions: () => actions,
			getActionsContext: undefined,
		};

		this.contextMenuService.showContextMenu(delegate);
	}

	/* ─── Context Menu Handler Installation ───────────────── */

	private installContextMenuHandlers(): void {
		const def = this.definition;

		// Canvas actions
		for (const action of def.contextMenu.canvasActions) {
			action.handler = this.createCanvasHandler(action.id);
		}

		// Node actions
		for (const action of def.contextMenu.nodeActions) {
			action.handler = this.createNodeHandler(action.id);
		}

		// Edge actions
		for (const action of def.contextMenu.edgeActions) {
			action.handler = this.createEdgeHandler(action.id);
		}
	}

	private createCanvasHandler(actionId: string): () => void {
		switch (actionId) {
			case 'add-card': return () => this.addNode('card');
			case 'add-decision': return () => this.addNode('decision');
			case 'fit-view': return () => this.fitView();
			default: return () => {};
		}
	}

	private createNodeHandler(actionId: string): () => void {
		switch (actionId) {
			case 'edit-node': return () => this.editSelectedNode();
			case 'duplicate-node': return () => this.duplicateSelectedNode();
			case 'remove-node': return () => this.removeSelectedNode();
			case 'install': return () => this.installAgent();
			case 'uninstall': return () => this.uninstallAgent();
			case 'view-details': return () => this.viewAgentDetails();
			default: return () => {};
		}
	}

	private createEdgeHandler(actionId: string): () => void {
		switch (actionId) {
			case 'remove-edge': return () => this.removeSelectedEdge();
			default: return () => {};
		}
	}

	/* ─── Context Menu Actions (Engine Methods) ────────────── */

	private addNode(nodeType: string): void {
		const config = this.definition.nodeTypes.find(t => t.type === nodeType);
		if (!config) { return; }

		this.pushUndoSnapshot();

		// Place node at center of current viewport
		const centerX = this.viewBox.x + this.viewBox.width / 2;
		const centerY = this.viewBox.y + this.viewBox.height / 2;
		const dims = config.defaultDimensions;
		const nodeId = `${nodeType}-${Date.now().toString(36)}`;

		this.stateManager.addNodeLayout(nodeId, nodeType, {
			x: centerX - dims.width / 2,
			y: centerY - dims.height / 2,
		});

		this.selectedNodeIds = new Set([nodeId]);
		this.render();
	}

	private editSelectedNode(): void {
		if (this.selectedNodeIds.size === 0) { return; }
		const nodeId = [...this.selectedNodeIds][0];
		const state = this.stateManager.getState();
		const layout = state.layouts.find(n => n.id === nodeId);
		if (layout) {
			this.definition.callbacks.onNodeDoubleClick?.(nodeId, layout.type);
		}
	}

	private duplicateSelectedNode(): void {
		// Reuse existing duplicate logic
		this.duplicateSelected();
	}

	private removeSelectedNode(): void {
		// Reuse existing delete logic
		this.deleteSelected();
	}

	private removeSelectedEdge(): void {
		if (!this.selectedEdgeId) { return; }

		this.pushUndoSnapshot();
		this.stateManager.removeEdge(this.selectedEdgeId);
		this.definition.callbacks.onRemoveEdge?.(this.selectedEdgeId);
		this.selectedEdgeId = null;
		this.render();
	}

	private installAgent(): void {
		if (this.selectedNodeIds.size === 0) { return; }
		const nodeId = [...this.selectedNodeIds][0];
		const state = this.stateManager.getState();
		const layout = state.layouts.find(n => n.id === nodeId);
		if (layout) {
			this.definition.callbacks.onNodeDoubleClick?.(nodeId, layout.type);
		}
	}

	private uninstallAgent(): void {
		this.removeSelectedNode();
	}

	private viewAgentDetails(): void {
		this.editSelectedNode();
	}

	/* ─── Rendering ───────────────────────────────────────── */

	private renderEdges(): void {
		while (this.edgeGroup.firstChild) {
			this.edgeGroup.removeChild(this.edgeGroup.firstChild);
		}

		const state = this.stateManager.getState();
		const layoutMap = new Map(state.layouts.map(l => [l.id, l]));

		for (const edge of state.edges) {
			const config = this.definition.edgeTypes.find(t => t.type === edge.type);
			if (!config) { continue; }

			const defaultDims = this.definition.nodeTypes[0]?.defaultDimensions ?? { width: 200, height: 100 };

			// Use registered renderer or default
			if (config.renderer) {
				const sourceLayout = layoutMap.get(edge.source);
				const targetLayout = layoutMap.get(edge.target);
				if (sourceLayout && targetLayout) {
					const edgeEl = config.renderer(edge, sourceLayout, targetLayout, this.selectedEdgeId === edge.id, config);
					this.edgeGroup.appendChild(edgeEl);
				}
			} else {
				const path = renderEdgePath(edge, layoutMap, this.selectedEdgeId === edge.id, config, defaultDims);
				this.edgeGroup.appendChild(path);

				// Label
				const sourceLayout = layoutMap.get(edge.source);
				const targetLayout = layoutMap.get(edge.target);
				if (sourceLayout && targetLayout) {
					const label = renderEdgeLabel(edge, sourceLayout, targetLayout, config);
					if (label) { this.edgeGroup.appendChild(label); }
				}
			}
		}
	}

	private renderNodes(): void {
		while (this.nodeGroup.firstChild) {
			this.nodeGroup.removeChild(this.nodeGroup.firstChild);
		}

		const state = this.stateManager.getState();

		for (const layout of state.layouts) {
			const config = getNodeTypeConfig(layout.type) ??
				this.definition.nodeTypes.find(t => t.type === layout.type);

			if (!config) {
				console.warn(`[ArchitectureDiagramEngine] No config for node type "${layout.type}"`);
				continue;
			}

			const item = this.data.find((d: any) =>
				d.id === layout.id || d.name === layout.id,
			) ?? null;

			const renderState: DiagramNodeRenderState = {
				dimmed: this.connectState !== null && this.connectState.sourceNodeId !== layout.id,
				selected: this.selectedNodeIds.has(layout.id),
				highlighted: false,
			};

			const callbacks = {
				getNodePorts: (l: DiagramNodeDefinition) => getNodePorts(l, config.defaultDimensions),
				startConnection: (_nodeId: string, _port: any, _edgeType: string) => {
					// Handled via connection handles
				},
			};

			const nodeGroup = config.renderer(layout, item, renderState, callbacks);
			nodeGroup.setAttribute('data-node-id', layout.id);
			nodeGroup.setAttribute('data-node-type', layout.type);
			nodeGroup.setAttribute('transform', `translate(${layout.position.x}, ${layout.position.y})`);

			applyNodeRenderState(nodeGroup, renderState);

			// Connection handles
			if (renderState.selected) {
				const handles = renderConnectionHandles(layout, config.defaultDimensions);
				nodeGroup.appendChild(handles);
			}

			this.nodeGroup.appendChild(nodeGroup);
		}
	}

	/* ─── Temp Edge ───────────────────────────────────────── */

	private renderTempEdge(): void {
		this.clearTempEdge();

		if (!this.connectState) { return; }

		const state = this.stateManager.getState();
		const sourceLayout = state.layouts.find(n => n.id === this.connectState!.sourceNodeId);
		if (!sourceLayout) { return; }

		const config = getNodeTypeConfig(sourceLayout.type);
		const dims = config?.defaultDimensions ?? { width: 200, height: 100 };

		const tempEdge = renderTempEdge(this.connectState, sourceLayout, dims);
		this.tempEdgeGroup.appendChild(tempEdge);
	}

	private clearTempEdge(): void {
		while (this.tempEdgeGroup.firstChild) {
			this.tempEdgeGroup.removeChild(this.tempEdgeGroup.firstChild);
		}
	}
}