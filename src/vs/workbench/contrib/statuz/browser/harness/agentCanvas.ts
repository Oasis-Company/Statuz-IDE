/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IAgentSkillItem } from '../agentManagement.types.js';
import { AgentNodeLayout, getNodeDimensions, renderAgentNode } from './agentCanvasNodes.js';
import { AgentEdgeData, AgentEdgeType, renderEdgePath, ConnectState, createConnectState, renderTempEdge, findNodeAtPosition, getNodePorts } from './agentCanvasEdges.js';
import { AgentCanvasToolbar, ToolbarState } from './agentCanvasToolbar.js';
import { PipelineDefinition, PipelineNode, PipelineEdge } from './agentPipelineTypes.js';

// ─── Snapshot for Undo/Redo ──────────────────────────────────

interface AgentCanvasSnapshot {
	layouts: AgentNodeLayout[];
	edges: AgentEdgeData[];
}

// ─── Canvas Callbacks ────────────────────────────────────────

export interface AgentCanvasCallbacks {
	onNodeDoubleClick?: (nodeId: string) => void;
	onInstall?: (nodeId: string) => void;
	onUninstall?: (nodeId: string) => void;
	onAddEdge?: (source: string, target: string, type: AgentEdgeType) => void;
	onRemoveEdge?: (edgeId: string) => void;
}

// ─── Constants ───────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY_LAYOUTS = 'statuz-agent-canvas-layouts';
const STORAGE_KEY_EDGES = 'statuz-agent-canvas-edges';
const MAX_UNDO = 50;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;
const MIN_ZOOM_STEP = 0.1;

// ─── AgentCanvas Class ───────────────────────────────────────

export class AgentCanvas {
	// SVG elements
	private readonly svg: SVGSVGElement;
	private readonly defs: SVGDefsElement;
	private readonly edgeGroup: SVGGElement;
	private readonly nodeGroup: SVGGElement;
	private readonly tempEdgeGroup: SVGGElement;
	private readonly selectionRect: SVGRectElement;

	// Data
	private nodeLayouts: AgentNodeLayout[] = [];
	private edges: AgentEdgeData[] = [];
	private items: IAgentSkillItem[] = [];
	private filteredItems: IAgentSkillItem[] = [];

	// Viewport
	private viewBox = { x: -200, y: -200, width: 1600, height: 1200 };
	private zoom = 1;

	// Interaction state
	private isPanning = false;
	private panStart = { x: 0, y: 0 };
	private panViewBoxStart = { x: 0, y: 0 };

	private isDraggingNode = false;
	private dragNodeIds: string[] = [];
	private dragStart = { x: 0, y: 0 };
	private dragNodePositions: Map<string, { x: number; y: number }> = new Map();

	private isSelecting = false;
	private selectStart = { x: 0, y: 0 };

	private selectedNodeIds: Set<string> = new Set();
	private selectedEdgeId: string | null = null;

	// Persisted layout data (loaded from localStorage, applied in syncLayouts)
	private persistedLayouts: Record<string, { x: number; y: number }> = {};

	private connectState: ConnectState = createConnectState();

	// Undo/Redo
	private undoStack: AgentCanvasSnapshot[] = [];
	private redoStack: AgentCanvasSnapshot[] = [];

	// Toolbar
	private toolbar: AgentCanvasToolbar | null = null;

	// Callbacks
	private readonly callbacks: AgentCanvasCallbacks;

	// Bound event handlers (for cleanup)
	private readonly boundOnMouseDown: (e: MouseEvent) => void;
	private readonly boundOnMouseMove: (e: MouseEvent) => void;
	private readonly boundOnMouseUp: (e: MouseEvent) => void;
	private readonly boundOnWheel: (e: WheelEvent) => void;
	private readonly boundOnDoubleClick: (e: MouseEvent) => void;
	private readonly boundOnContextMenu: (e: MouseEvent) => void;
	private readonly boundOnKeyDown: (e: KeyboardEvent) => void;

	constructor(
		private readonly container: HTMLElement,
		callbacks: AgentCanvasCallbacks = {},
	) {
		this.callbacks = callbacks;

		// Create SVG
		this.svg = document.createElementNS(SVG_NS, 'svg');
		this.svg.setAttribute('class', 'agent-canvas');
		this.svg.setAttribute('tabindex', '0');
		this.svg.style.width = '100%';
		this.svg.style.height = '100%';
		this.svg.style.display = 'block';
		this.svg.style.outline = 'none';

		this.defs = document.createElementNS(SVG_NS, 'defs');
		this.svg.appendChild(this.defs);

		// Edge group (rendered first, below nodes)
		this.edgeGroup = document.createElementNS(SVG_NS, 'g');
		this.edgeGroup.setAttribute('class', 'agent-edge-group');
		this.svg.appendChild(this.edgeGroup);

		// Node group
		this.nodeGroup = document.createElementNS(SVG_NS, 'g');
		this.nodeGroup.setAttribute('class', 'agent-node-group');
		this.svg.appendChild(this.nodeGroup);

		// Temp edge group (during drag)
		this.tempEdgeGroup = document.createElementNS(SVG_NS, 'g');
		this.tempEdgeGroup.setAttribute('class', 'agent-temp-edge-group');
		this.svg.appendChild(this.tempEdgeGroup);

		// Selection rectangle
		this.selectionRect = document.createElementNS(SVG_NS, 'rect');
		this.selectionRect.setAttribute('class', 'agent-selection');
		this.selectionRect.setAttribute('fill', 'rgba(0, 102, 204, 0.08)');
		this.selectionRect.setAttribute('stroke', '#007acc');
		this.selectionRect.setAttribute('stroke-width', '1');
		this.selectionRect.setAttribute('stroke-dasharray', '4,2');
		this.selectionRect.style.display = 'none';
		this.svg.appendChild(this.selectionRect);

		container.appendChild(this.svg);

		// Bind events
		this.boundOnMouseDown = this.onMouseDown.bind(this);
		this.boundOnMouseMove = this.onMouseMove.bind(this);
		this.boundOnMouseUp = this.onMouseUp.bind(this);
		this.boundOnWheel = this.onWheel.bind(this);
		this.boundOnDoubleClick = this.onDoubleClick.bind(this);
		this.boundOnContextMenu = this.onContextMenu.bind(this);
		this.boundOnKeyDown = this.onKeyDown.bind(this);

		this.svg.addEventListener('mousedown', this.boundOnMouseDown);
		window.addEventListener('mousemove', this.boundOnMouseMove);
		window.addEventListener('mouseup', this.boundOnMouseUp);
		this.svg.addEventListener('wheel', this.boundOnWheel, { passive: false });
		this.svg.addEventListener('dblclick', this.boundOnDoubleClick);
		this.svg.addEventListener('contextmenu', this.boundOnContextMenu);
		window.addEventListener('keydown', this.boundOnKeyDown);

		// Load persisted state
		this.loadFromStorage();
	}

	// ─── Toolbar Integration ───────────────────────────────────

	createToolbar(parent: HTMLElement): AgentCanvasToolbar {
		this.toolbar = new AgentCanvasToolbar(parent, {
			onUndo: () => this.undo(),
			onRedo: () => this.redo(),
			onFitView: () => this.fitView(),
			onAutoLayout: () => this.autoLayout(),
			onZoomIn: () => this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, 0.2),
			onZoomOut: () => this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, -0.2),
			onAddNode: () => { /* no-op for now */ },
		}, () => this.getToolbarState());
		return this.toolbar;
	}

	private getToolbarState(): ToolbarState {
		return {
			canUndo: this.undoStack.length > 0,
			canRedo: this.redoStack.length > 0,
			zoom: this.zoom,
		};
	}

	// ─── Data Management ───────────────────────────────────────

	setItems(items: IAgentSkillItem[], filteredItems: IAgentSkillItem[]): void {
		this.items = items;
		this.filteredItems = filteredItems;
		this.syncLayouts();
		this.syncEdges();
	}

	private syncLayouts(): void {
		// Remove layouts for items that no longer exist
		const validIds = new Set(this.filteredItems.map(i => i.id));
		this.nodeLayouts = this.nodeLayouts.filter(l => validIds.has(l.id));

		// Add layouts for new items (not yet in layout map)
		const existingIds = new Set(this.nodeLayouts.map(l => l.id));
		let lastX = 100, lastY = 100;
		if (this.nodeLayouts.length > 0) {
			const last = this.nodeLayouts[this.nodeLayouts.length - 1];
			lastX = last.position.x + 250;
			lastY = last.position.y;
		}

		for (const item of this.filteredItems) {
			if (!existingIds.has(item.id)) {
				// Check persisted positions first, fall back to sequential layout
				const persisted = this.persistedLayouts[item.id];
				const x = persisted ? persisted.x : lastX;
				const y = persisted ? persisted.y : lastY;
				this.nodeLayouts.push({
					id: item.id,
					type: item.type,
					position: { x, y },
				});
				lastX += 250;
			}
		}
	}

	private syncEdges(): void {
		// Remove edges referencing non-existent items
		const validIds = new Set(this.filteredItems.map(i => i.id));
		this.edges = this.edges.filter(e => validIds.has(e.source) && validIds.has(e.target));
	}

	// ─── Rendering ─────────────────────────────────────────────

	render(): void {
		this.applyViewBox();
		this.renderEdges();
		this.renderNodes();
		this.toolbar?.update();
	}

	private applyViewBox(): void {
		this.svg.setAttribute(
			'viewBox',
			`${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`,
		);
	}

	private renderNodes(): void {
		// Clear node group
		while (this.nodeGroup.firstChild) {
			this.nodeGroup.removeChild(this.nodeGroup.firstChild);
		}

		const layoutMap = new Map(this.nodeLayouts.map(l => [l.id, l]));
		const selectedSet = this.selectedNodeIds;

		for (const item of this.filteredItems) {
			const layout = layoutMap.get(item.id);
			if (!layout) {
				continue;
			}

			const isSelected = selectedSet.has(item.id);
			const isDimmed = this.connectState.active && this.connectState.sourceNodeId !== item.id;

			const nodeSvg = renderAgentNode(layout, item, isDimmed, isSelected, false, {
				onInstall: (id) => this.callbacks.onInstall?.(id),
				onUninstall: (id) => this.callbacks.onUninstall?.(id),
			});

			this.nodeGroup.appendChild(nodeSvg);
		}
	}

	private renderEdges(): void {
		// Clear edge group
		while (this.edgeGroup.firstChild) {
			this.edgeGroup.removeChild(this.edgeGroup.firstChild);
		}

		// Clear temp edge group
		while (this.tempEdgeGroup.firstChild) {
			this.tempEdgeGroup.removeChild(this.tempEdgeGroup.firstChild);
		}

		const layoutMap = new Map(this.nodeLayouts.map(l => [l.id, l]));

		// Render persistent edges
		for (const edge of this.edges) {
			const result = renderEdgePath(edge, layoutMap, edge.id === this.selectedEdgeId);
			if (result) {
				this.edgeGroup.appendChild(result.path);
				this.edgeGroup.appendChild(result.label);
			}
		}

		// Render temp edge during connection drag
		if (this.connectState.active) {
			const sourceLayout = layoutMap.get(this.connectState.sourceNodeId);
			if (sourceLayout) {
				const tempPath = renderTempEdge(this.connectState, sourceLayout);
				if (tempPath) {
					this.tempEdgeGroup.appendChild(tempPath);
				}
			}
		}
	}

	// ─── Viewport ──────────────────────────────────────────────

	fitView(): void {
		if (this.nodeLayouts.length === 0) {
			return;
		}

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const layout of this.nodeLayouts) {
			const dims = getNodeDimensions(layout.type);
			minX = Math.min(minX, layout.position.x - 40);
			minY = Math.min(minY, layout.position.y - 40);
			maxX = Math.max(maxX, layout.position.x + dims.width + 40);
			maxY = Math.max(maxY, layout.position.y + dims.height + 40);
		}

		const contentW = maxX - minX;
		const contentH = maxY - minY;
		const containerW = this.container.clientWidth;
		const containerH = this.container.clientHeight;

		const scale = Math.min(containerW / contentW, containerH / contentH, 1.5);
		const viewW = containerW / scale;
		const viewH = containerH / scale;
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;

		this.viewBox = {
			x: centerX - viewW / 2,
			y: centerY - viewH / 2,
			width: viewW,
			height: viewH,
		};
		this.zoom = scale;
		this.applyViewBox();
		this.toolbar?.update();
	}

	zoomAt(centerX: number, centerY: number, delta: number): void {
		const svgPt = this.clientToSvg(centerX, centerY);
		const oldZoom = this.zoom;
		const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZoom + delta));
		if (newZoom === oldZoom) {
			return;
		}

		this.viewBox.x = svgPt.x - (centerX - this.viewBox.x * oldZoom) / newZoom;
		this.viewBox.y = svgPt.y - (centerY - this.viewBox.y * oldZoom) / newZoom;
		this.viewBox.width = this.container.clientWidth / newZoom;
		this.viewBox.height = this.container.clientHeight / newZoom;
		this.zoom = newZoom;

		this.applyViewBox();
		this.toolbar?.update();
	}

	private clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
		const rect = this.svg.getBoundingClientRect();
		const svgX = this.viewBox.x + (clientX - rect.left) / rect.width * this.viewBox.width;
		const svgY = this.viewBox.y + (clientY - rect.top) / rect.height * this.viewBox.height;
		return { x: svgX, y: svgY };
	}

	// ─── Auto Layout ───────────────────────────────────────────

	autoLayout(): void {
		this.pushSnapshot();

		// Group items by type
		const groups: Record<string, IAgentSkillItem[]> = {
			agent: [], skill: [], command: [], rule: [],
		};
		for (const item of this.filteredItems) {
			if (groups[item.type]) {
				groups[item.type].push(item);
			} else {
				groups.rule.push(item);
			}
		}

		const typeOrder = ['agent', 'skill', 'command', 'rule'];
		const colWidth = 300;
		const startX = 50;
		const startY = 50;
		const rowHeight = 140;
		let colIndex = 0;

		for (const type of typeOrder) {
			const items = groups[type] || [];
			if (items.length === 0) {
				continue;
			}

			const x = startX + colIndex * colWidth;
			items.forEach((item, i) => {
				const y = startY + i * rowHeight;
				const existing = this.nodeLayouts.find(l => l.id === item.id);
				if (existing) {
					existing.position = { x, y };
				} else {
					this.nodeLayouts.push({
						id: item.id,
						type: item.type,
						position: { x, y },
					});
				}
			});

			colIndex++;
		}

		this.saveToStorage();
		this.render();
	}

	// ─── Undo / Redo ───────────────────────────────────────────

	private pushSnapshot(): void {
		const snapshot: AgentCanvasSnapshot = {
			layouts: this.nodeLayouts.map(l => ({
				id: l.id,
				type: l.type,
				position: { ...l.position },
			})),
			edges: this.edges.map(e => ({ ...e })),
		};
		this.undoStack.push(snapshot);
		if (this.undoStack.length > MAX_UNDO) {
			this.undoStack.shift();
		}
		this.redoStack = [];
	}

	undo(): void {
		if (this.undoStack.length === 0) {
			return;
		}
		const current: AgentCanvasSnapshot = {
			layouts: this.nodeLayouts.map(l => ({
				id: l.id,
				type: l.type,
				position: { ...l.position },
			})),
			edges: this.edges.map(e => ({ ...e })),
		};
		this.redoStack.push(current);

		const prev = this.undoStack.pop()!;
		this.nodeLayouts = prev.layouts;
		this.edges = prev.edges;
		this.saveToStorage();
		this.render();
		this.toolbar?.update();
	}

	redo(): void {
		if (this.redoStack.length === 0) {
			return;
		}
		const current: AgentCanvasSnapshot = {
			layouts: this.nodeLayouts.map(l => ({
				id: l.id,
				type: l.type,
				position: { ...l.position },
			})),
			edges: this.edges.map(e => ({ ...e })),
		};
		this.undoStack.push(current);

		const next = this.redoStack.pop()!;
		this.nodeLayouts = next.layouts;
		this.edges = next.edges;
		this.saveToStorage();
		this.render();
		this.toolbar?.update();
	}

	// ─── Persistence ───────────────────────────────────────────

	private saveToStorage(): void {
		try {
			const layoutsData: Record<string, { x: number; y: number }> = {};
			for (const l of this.nodeLayouts) {
				layoutsData[l.id] = { x: l.position.x, y: l.position.y };
			}
			localStorage.setItem(STORAGE_KEY_LAYOUTS, JSON.stringify(layoutsData));
			localStorage.setItem(STORAGE_KEY_EDGES, JSON.stringify(this.edges));
		} catch { /* localStorage may be unavailable */ }
	}

	private loadFromStorage(): void {
		try {
			const layoutsRaw = localStorage.getItem(STORAGE_KEY_LAYOUTS);
			if (layoutsRaw) {
				this.persistedLayouts = JSON.parse(layoutsRaw) as Record<string, { x: number; y: number }>;
			}

			const edgesRaw = localStorage.getItem(STORAGE_KEY_EDGES);
			if (edgesRaw) {
				const loadedEdges = JSON.parse(edgesRaw) as AgentEdgeData[];
				this.edges = loadedEdges.filter(e => e.source && e.target && e.type);
			}
		} catch { /* localStorage may be unavailable */ }
	}

	// ─── Edge Management ───────────────────────────────────────

	addEdge(source: string, target: string, type: AgentEdgeType = 'depends-on'): void {
		// Check for duplicate
		const exists = this.edges.some(e => e.source === source && e.target === target);
		if (exists) {
			return;
		}

		this.pushSnapshot();
		const edgeId = `edge-${source}-${target}-${Date.now()}`;
		this.edges.push({ id: edgeId, source, target, type });
		this.saveToStorage();
		this.render();
	}

	removeEdge(edgeId: string): void {
		this.pushSnapshot();
		this.edges = this.edges.filter(e => e.id !== edgeId);
		this.selectedEdgeId = null;
		this.saveToStorage();
		this.render();
	}

	// ─── Mouse Events ──────────────────────────────────────────

	private onMouseDown(e: MouseEvent): void {
		const target = e.target as Element;
		const svgPt = this.clientToSvg(e.clientX, e.clientY);

		// Check if clicking on a connection handle
		if (target.classList.contains('agent-connection-handle')) {
			this.startConnection(target, e);
			return;
		}

		// Check if clicking on a node
		const nodeEl = target.closest('[data-node-id]') as SVGElement | null;
		if (nodeEl && nodeEl !== this.svg) {
			const nodeId = nodeEl.getAttribute('data-node-id')!;
			this.clearSelection();
			this.selectedNodeIds.add(nodeId);

			// Start node drag
			this.isDraggingNode = true;
			this.dragNodeIds = [nodeId];
			this.dragStart = { x: e.clientX, y: e.clientY };
			this.dragNodePositions.clear();

			const layout = this.nodeLayouts.find(l => l.id === nodeId);
			if (layout) {
				this.dragNodePositions.set(nodeId, { ...layout.position });
			}

			this.render();
			return;
		}

		// Check if clicking on an edge
		const edgeEl = target.closest('[data-edge-id]') as SVGElement | null;
		if (edgeEl) {
			const edgeId = edgeEl.getAttribute('data-edge-id')!;
			this.clearSelection();
			this.selectedEdgeId = edgeId;
			this.render();
			return;
		}

		// Start pan or selection
		this.clearSelection();
		this.render();

		if (e.button === 0) {
			// Left button — start selection rectangle
			this.isSelecting = true;
			this.selectStart = { x: svgPt.x, y: svgPt.y };
			this.selectionRect.setAttribute('x', String(svgPt.x));
			this.selectionRect.setAttribute('y', String(svgPt.y));
			this.selectionRect.setAttribute('width', '0');
			this.selectionRect.setAttribute('height', '0');
			this.selectionRect.style.display = '';
		} else if (e.button === 1 || e.button === 2) {
			// Middle or right button — start pan
			this.isPanning = true;
			this.panStart = { x: e.clientX, y: e.clientY };
			this.panViewBoxStart = { ...this.viewBox };
			this.svg.style.cursor = 'grabbing';
		}
	}

	private onMouseMove(e: MouseEvent): void {
		if (this.isPanning) {
			const dx = (e.clientX - this.panStart.x) / this.container.clientWidth * this.viewBox.width;
			const dy = (e.clientY - this.panStart.y) / this.container.clientHeight * this.viewBox.height;
			this.viewBox.x = this.panViewBoxStart.x - dx;
			this.viewBox.y = this.panViewBoxStart.y - dy;
			this.applyViewBox();
			return;
		}

		if (this.isDraggingNode && this.dragNodeIds.length > 0) {
			const dx = (e.clientX - this.dragStart.x) / this.container.clientWidth * this.viewBox.width;
			const dy = (e.clientY - this.dragStart.y) / this.container.clientHeight * this.viewBox.height;

			for (const nodeId of this.dragNodeIds) {
				const layout = this.nodeLayouts.find(l => l.id === nodeId);
				const startPos = this.dragNodePositions.get(nodeId);
				if (layout && startPos) {
					layout.position = {
						x: startPos.x + dx,
						y: startPos.y + dy,
					};
				}
			}

			this.renderNodes();
			return;
		}

		if (this.isSelecting) {
			const svgPt = this.clientToSvg(e.clientX, e.clientY);
			const x = Math.min(this.selectStart.x, svgPt.x);
			const y = Math.min(this.selectStart.y, svgPt.y);
			const w = Math.abs(svgPt.x - this.selectStart.x);
			const h = Math.abs(svgPt.y - this.selectStart.y);

			this.selectionRect.setAttribute('x', String(x));
			this.selectionRect.setAttribute('y', String(y));
			this.selectionRect.setAttribute('width', String(w));
			this.selectionRect.setAttribute('height', String(h));
			return;
		}

		if (this.connectState.active) {
			const svgPt = this.clientToSvg(e.clientX, e.clientY);
			this.connectState.currentMouse = svgPt;
			this.renderEdges();
			return;
		}
	}

	private onMouseUp(e: MouseEvent): void {
		// Finish connection drag
		if (this.connectState.active) {
			const targetLayout = findNodeAtPosition(
				e.clientX, e.clientY,
				this.nodeLayouts,
				this.svg,
				this.connectState.sourceNodeId,
			);
			if (targetLayout) {
				this.callbacks.onAddEdge?.(this.connectState.sourceNodeId, targetLayout.id, 'depends-on');
			}
			this.connectState = createConnectState();
			this.render();
			return;
		}

		// Finish node drag
		if (this.isDraggingNode) {
			this.isDraggingNode = false;
			this.pushSnapshot();
			this.saveToStorage();
			this.render();
			return;
		}

		// Finish pan
		if (this.isPanning) {
			this.isPanning = false;
			this.svg.style.cursor = '';
			return;
		}

		// Finish selection
		if (this.isSelecting) {
			this.isSelecting = false;
			this.selectionRect.style.display = 'none';

			// Compute selection rect in SVG coordinates
			const svgPt = this.clientToSvg(e.clientX, e.clientY);
			const selX = Math.min(this.selectStart.x, svgPt.x);
			const selY = Math.min(this.selectStart.y, svgPt.y);
			const selW = Math.abs(svgPt.x - this.selectStart.x);
			const selH = Math.abs(svgPt.y - this.selectStart.y);

			// Only select if the rect is big enough (prevent accidental clicks)
			if (selW > 5 || selH > 5) {
				for (const layout of this.nodeLayouts) {
					const dims = getNodeDimensions(layout.type);
					const lx = layout.position.x;
					const ly = layout.position.y;
					const lw = dims.width;
					const lh = dims.height;

					// Check if node rect overlaps with selection rect
					if (lx < selX + selW && lx + lw > selX &&
						ly < selY + selH && ly + lh > selY) {
						this.selectedNodeIds.add(layout.id);
					}
				}
				this.render();
			}
			return;
		}
	}

	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		const delta = e.deltaY < 0 ? MIN_ZOOM_STEP : -MIN_ZOOM_STEP;
		this.zoomAt(e.clientX, e.clientY, delta);
	}

	private onDoubleClick(e: MouseEvent): void {
		const target = e.target as Element;
		const nodeEl = target.closest('[data-node-id]') as SVGElement | null;
		if (nodeEl) {
			const nodeId = nodeEl.getAttribute('data-node-id')!;
			this.callbacks.onNodeDoubleClick?.(nodeId);
		}
	}

	private onContextMenu(e: MouseEvent): void {
		e.preventDefault();
		const target = e.target as Element;

		// Node context menu
		const nodeEl = target.closest('[data-node-id]') as SVGElement | null;
		if (nodeEl) {
			const nodeId = nodeEl.getAttribute('data-node-id')!;
			this.showNodeMenu(nodeId, e);
			return;
		}

		// Edge context menu
		const edgeEl = target.closest('[data-edge-id]') as SVGElement | null;
		if (edgeEl) {
			const edgeId = edgeEl.getAttribute('data-edge-id')!;
			this.showEdgeMenu(edgeId, e);
			return;
		}

		// Canvas context menu
		this.showCanvasMenu(e);
	}

	private onKeyDown(e: KeyboardEvent): void {
		// Ctrl+Z — Undo
		if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
			e.preventDefault();
			this.undo();
			return;
		}
		// Ctrl+Shift+Z — Redo
		if (e.ctrlKey && e.shiftKey && e.key === 'z') {
			e.preventDefault();
			this.redo();
			return;
		}
		// Delete / Backspace — Delete selected
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			this.deleteSelected();
			return;
		}
		// Ctrl+A — Select all
		if (e.ctrlKey && e.key === 'a') {
			e.preventDefault();
			for (const layout of this.nodeLayouts) {
				this.selectedNodeIds.add(layout.id);
			}
			this.render();
			return;
		}
		// Escape — Clear selection
		if (e.key === 'Escape') {
			this.clearSelection();
			this.render();
			return;
		}
		// Arrow keys — Nudge selected nodes
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
			e.preventDefault();
			this.pushSnapshot();
			const step = e.shiftKey ? 10 : 1;
			for (const nodeId of this.selectedNodeIds) {
				const layout = this.nodeLayouts.find(l => l.id === nodeId);
				if (layout) {
					switch (e.key) {
						case 'ArrowUp': layout.position.y -= step; break;
						case 'ArrowDown': layout.position.y += step; break;
						case 'ArrowLeft': layout.position.x -= step; break;
						case 'ArrowRight': layout.position.x += step; break;
					}
				}
			}
			this.saveToStorage();
			this.renderNodes();
		}
	}

	// ─── Selection ─────────────────────────────────────────────

	private clearSelection(): void {
		this.selectedNodeIds.clear();
		this.selectedEdgeId = null;
	}

	private deleteSelected(): void {
		if (this.selectedEdgeId) {
			this.removeEdge(this.selectedEdgeId);
			return;
		}

		if (this.selectedNodeIds.size > 0) {
			this.pushSnapshot();
			this.edges = this.edges.filter(e =>
				!this.selectedNodeIds.has(e.source) && !this.selectedNodeIds.has(e.target),
			);
			this.nodeLayouts = this.nodeLayouts.filter(l => !this.selectedNodeIds.has(l.id));
			this.selectedNodeIds.clear();
			this.saveToStorage();
			this.render();
		}
	}

	// ─── Context Menus (Native) ────────────────────────────────

	private showNodeMenu(nodeId: string, e: MouseEvent): void {
		// Use native context menu for now
		// In a production build, we'd use VS Code's IContextMenuService
		const item = this.items.find(i => i.id === nodeId);
		if (!item) {
			return;
		}

		const menu = document.createElement('div');
		menu.className = 'agent-canvas-context-menu';
		menu.style.position = 'fixed';
		menu.style.left = `${e.clientX}px`;
		menu.style.top = `${e.clientY}px`;

		const items = [
			{ label: 'Open Detail', action: () => this.callbacks.onNodeDoubleClick?.(nodeId) },
			{ label: '---', action: null },
			{ label: item.state === 'enabled' ? 'Disable' : 'Enable', action: () => {
				// Toggle handled by caller
				this.render();
			}},
			{ label: '---', action: null },
			{ label: 'Delete', action: () => {
				this.selectedNodeIds.add(nodeId);
				this.deleteSelected();
			}},
		];

		for (const menuItem of items) {
			if (menuItem.label === '---') {
				const sep = document.createElement('div');
				sep.className = 'agent-canvas-context-menu-separator';
				menu.appendChild(sep);
				continue;
			}
			const el = document.createElement('button');
			el.textContent = menuItem.label;
			el.addEventListener('click', () => {
				menuItem.action?.();
				menu.remove();
			});
			menu.appendChild(el);
		}

		document.body.appendChild(menu);
		const closeMenu = (ev: MouseEvent) => {
			if (!menu.contains(ev.target as Node)) {
				menu.remove();
				document.removeEventListener('mousedown', closeMenu);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
	}

	private showEdgeMenu(edgeId: string, e: MouseEvent): void {
		const menu = document.createElement('div');
		menu.className = 'agent-canvas-context-menu';
		menu.style.position = 'fixed';
		menu.style.left = `${e.clientX}px`;
		menu.style.top = `${e.clientY}px`;

		const items = [
			{ label: 'Delete Edge', action: () => this.removeEdge(edgeId) },
			{ label: '---', action: null },
			{ label: 'Change Type → depends-on', action: () => {
				const edge = this.edges.find(ed => ed.id === edgeId);
				if (edge) { edge.type = 'depends-on'; this.pushSnapshot(); this.saveToStorage(); this.render(); }
			}},
			{ label: 'Change Type → extends', action: () => {
				const edge = this.edges.find(ed => ed.id === edgeId);
				if (edge) { edge.type = 'extends'; this.pushSnapshot(); this.saveToStorage(); this.render(); }
			}},
		];

		for (const item of items) {
			if (item.label === '---') {
				const sep = document.createElement('div');
				sep.className = 'agent-canvas-context-menu-separator';
				menu.appendChild(sep);
				continue;
			}
			const el = document.createElement('button');
			el.textContent = item.label;
			el.addEventListener('click', () => {
				item.action?.();
				menu.remove();
			});
			menu.appendChild(el);
		}

		document.body.appendChild(menu);
		const closeMenu = (ev: MouseEvent) => {
			if (!menu.contains(ev.target as Node)) {
				menu.remove();
				document.removeEventListener('mousedown', closeMenu);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
	}

	private showCanvasMenu(e: MouseEvent): void {
		const menu = document.createElement('div');
		menu.className = 'agent-canvas-context-menu';
		menu.style.position = 'fixed';
		menu.style.left = `${e.clientX}px`;
		menu.style.top = `${e.clientY}px`;

		const items = [
			{ label: 'Auto Layout', action: () => this.autoLayout() },
			{ label: 'Fit View', action: () => this.fitView() },
			{ label: '---', action: null },
			{ label: 'Undo', action: () => this.undo() },
			{ label: 'Redo', action: () => this.redo() },
		];

		for (const item of items) {
			if (item.label === '---') {
				const sep = document.createElement('div');
				sep.className = 'agent-canvas-context-menu-separator';
				menu.appendChild(sep);
				continue;
			}
			const el = document.createElement('button');
			el.textContent = item.label;
			el.addEventListener('click', () => {
				item.action?.();
				menu.remove();
			});
			menu.appendChild(el);
		}

		document.body.appendChild(menu);
		const closeMenu = (ev: MouseEvent) => {
			if (!menu.contains(ev.target as Node)) {
				menu.remove();
				document.removeEventListener('mousedown', closeMenu);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
	}

	// ─── Connection (Drag from handle) ─────────────────────────

	private startConnection(handle: Element, e: MouseEvent): void {
		const nodeId = handle.getAttribute('data-node-id')!;
		const portSide = handle.getAttribute('data-port')!;
		const layout = this.nodeLayouts.find(l => l.id === nodeId);
		if (!layout) {
			return;
		}

		const ports = getNodePorts(layout);
		const port = ports.find(p => p.side === portSide) || null;

		this.connectState = {
			active: true,
			sourceNodeId: nodeId,
			sourcePort: port,
			currentMouse: this.clientToSvg(e.clientX, e.clientY),
		};

		this.render();
	}

	// ─── Public API ────────────────────────────────────────────

	updateData(items: IAgentSkillItem[], filteredItems: IAgentSkillItem[]): void {
		this.setItems(items, filteredItems);
		this.render();
	}

	focus(): void {
		this.svg.focus();
	}

	enablePipelineMode(pipeline: PipelineDefinition): void {
		// Convert pipeline data to canvas format
		this.nodeLayouts = pipeline.nodes.map((n: PipelineNode) => ({
			id: n.id,
			type: n.nodeType,
			position: { ...n.position },
		}));
		this.edges = pipeline.edges.map((e: PipelineEdge) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			type: e.edgeType as AgentEdgeType,
		}));
		this.render();
	}

	disablePipelineMode(): void {
		this.nodeLayouts = [];
		this.edges = [];
		this.render();
	}

	destroy(): void {
		// Remove event listeners
		this.svg.removeEventListener('mousedown', this.boundOnMouseDown);
		window.removeEventListener('mousemove', this.boundOnMouseMove);
		window.removeEventListener('mouseup', this.boundOnMouseUp);
		this.svg.removeEventListener('wheel', this.boundOnWheel);
		this.svg.removeEventListener('dblclick', this.boundOnDoubleClick);
		this.svg.removeEventListener('contextmenu', this.boundOnContextMenu);
		window.removeEventListener('keydown', this.boundOnKeyDown);

		// Remove toolbar
		this.toolbar?.dispose();
		this.toolbar = null;

		// Remove SVG
		this.svg.remove();
	}

	// ─── Expose internal state for toolbar ─────────────────────

	getNodeLayouts(): AgentNodeLayout[] {
		return this.nodeLayouts;
	}

	getEdges(): AgentEdgeData[] {
		return this.edges;
	}

	getZoom(): number {
		return this.zoom;
	}
}