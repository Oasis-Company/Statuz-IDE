/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Native SVG canvas for Board — replaces React Flow with VS Code-native SVG
 *--------------------------------------------------------------------------------------------*/

import type { FlowEdgeData, SandboxCard, Constitution } from './boardTypes.js';
import { renderConstitutionNode, renderStrategyCardNode, renderDecisionNode } from './boardNodes.js';
import {
	renderEdgePath, renderEdgeLabel, renderConnectionHandles,
	renderTempEdge, findNodeAtPosition,
	createConnectState, EDGE_COLORS,
} from './boardEdges.js';
import type { ConnectState, PortPosition } from './boardEdges.js';
import type { BoardStateManager } from './boardStateManager.js';
import type { BoardUndoRedo, BoardSnapshot } from './boardUndoRedo.js';
import type { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { Action } from '../../../../../base/common/actions.js';
import { StandardMouseEvent } from '../../../../../base/browser/mouseEvent.js';
import type { IContextMenuDelegate } from '../../../../../base/browser/contextmenu.js';

/* ─── Types ──────────────────────────────────────────────── */

export interface BoardCanvasData {
	cards: SandboxCard[];
	constitution: Constitution | null;
	decisions: Array<{ id: string; type: string; description: string; commitment?: string; time?: string }>;
}

export interface BoardCanvasCallbacks {
	onNodeDoubleClick?: (nodeId: string, nodeType: string) => void;
	onAddEdge?: (source: string, target: string, type: FlowEdgeData['type']) => void;
	onRemoveEdge?: (edgeId: string) => void;
	onAddCard?: (type: string) => void;
	onAddDecision?: () => void;
	onRemoveNode?: (nodeId: string, nodeType: string) => void;
	onDuplicateNode?: (nodeId: string) => void;
	onEditNode?: (nodeId: string, nodeType: string) => void;
	onLayoutChange?: (layout: 'column' | 'dagre' | 'manual') => void;
	onFitView?: () => void;
}

/* ─── Constants ──────────────────────────────────────────── */

const SCROLL_ZOOM_FACTOR = 0.001;

/* ─── BoardCanvas ────────────────────────────────────────── */

export class BoardCanvas {
	private svg: SVGSVGElement;
	private container: HTMLElement;
	private boardGroup: SVGGElement;
	private edgeGroup: SVGGElement;
	private nodeGroup: SVGGElement;
	private tempEdgeGroup: SVGGElement;
	private defs: SVGDefsElement;

	private stateManager: BoardStateManager;
	private undoRedo: BoardUndoRedo;
	private data: BoardCanvasData;
	private callbacks: BoardCanvasCallbacks;
	private contextMenuService: IContextMenuService;

	// Interaction state
	private isPanning = false;
	private isDraggingNode = false;
	private dragNodeId: string | null = null;
	private dragStart = { x: 0, y: 0 };
	private dragNodeStartPos = { x: 0, y: 0 };
	private selectedNodeIds: Set<string> = new Set();
	private selectedEdgeId: string | null = null;

	// Drag-to-connect state
	private connectState: ConnectState = createConnectState();

	// Viewport
	private viewBox = { x: 0, y: 0, width: 1200, height: 800 };

	constructor(
		container: HTMLElement,
		stateManager: BoardStateManager,
		undoRedo: BoardUndoRedo,
		data: BoardCanvasData,
		contextMenuService: IContextMenuService,
		callbacks: BoardCanvasCallbacks = {},
	) {
		this.container = container;
		this.stateManager = stateManager;
		this.undoRedo = undoRedo;
		this.data = data;
		this.contextMenuService = contextMenuService;
		this.callbacks = callbacks;

		// Create SVG structure
		this.svg = this.createSVG();
		this.defs = this.createDefs();
		this.svg.appendChild(this.defs);
		this.edgeGroup = this.createGroup('board-edges');
		this.nodeGroup = this.createGroup('board-nodes');
		this.tempEdgeGroup = this.createGroup('board-temp-edges');
		this.boardGroup = this.createGroup('board-root');
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
			width: 1200,
			height: 800,
		};
		this.applyViewBox();

		// Bind events
		this.bindEvents();

		// Initial render
		this.render();
	}

	/* ─── Create SVG ───────────────────────────────────────── */

	private createSVG(): SVGSVGElement {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'board-canvas');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		svg.style.cssText = 'display:block;cursor:grab;';
		return svg;
	}

	private createDefs(): SVGDefsElement {
		const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		defs.innerHTML = this.getArrowMarkers();
		return defs;
	}

	private createGroup(cls: string): SVGGElement {
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g.setAttribute('class', cls);
		return g;
	}

	/* ─── Arrow Markers ────────────────────────────────────── */

	private getArrowMarkers(): string {
		const types = ['informs', 'constrains', 'contradicts', 'validates', 'extends'];
		return types.map(type => `
			<marker id="arrow-${type}" viewBox="0 0 8 8" refX="7" refY="4"
				markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
				<path d="M1 1 L7 4 L1 7 Z" fill="${EDGE_COLORS[type]}" />
			</marker>
		`).join('');
	}

	/* ─── ViewBox ──────────────────────────────────────────── */

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

		// Clamp
		if (newWidth < 200 || newWidth > 8000) return;

		const ratioX = (centerX - this.viewBox.x) / this.viewBox.width;
		const ratioY = (centerY - this.viewBox.y) / this.viewBox.height;

		this.viewBox.x = centerX - ratioX * newWidth;
		this.viewBox.y = centerY - ratioY * newHeight;
		this.viewBox.width = newWidth;
		this.viewBox.height = newHeight;

		this.applyViewBox();
	}

	/* ─── SVG-to-Client Coordinate Conversion ──────────────── */

	private clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
		const rect = this.svg.getBoundingClientRect();
		return {
			x: this.viewBox.x + (clientX - rect.left) * (this.viewBox.width / rect.width),
			y: this.viewBox.y + (clientY - rect.top) * (this.viewBox.height / rect.height),
		};
	}

	/* ─── Events ───────────────────────────────────────────── */

	private bindEvents(): void {
		this.svg.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mousemove', this.onMouseMove);
		window.addEventListener('mouseup', this.onMouseUp);
		this.svg.addEventListener('wheel', this.onWheel, { passive: false });
		this.svg.addEventListener('dblclick', this.onDoubleClick);
		this.svg.addEventListener('contextmenu', this.onContextMenu);
		document.addEventListener('keydown', this.onKeyDown);
	}

	unbind(): void {
		this.svg.removeEventListener('mousedown', this.onMouseDown);
		window.removeEventListener('mousemove', this.onMouseMove);
		window.removeEventListener('mouseup', this.onMouseUp);
		this.svg.removeEventListener('wheel', this.onWheel);
		this.svg.removeEventListener('dblclick', this.onDoubleClick);
		this.svg.removeEventListener('contextmenu', this.onContextMenu);
		document.removeEventListener('keydown', this.onKeyDown);
	}

	/* ─── Mouse: Down ──────────────────────────────────────── */

	private readonly onMouseDown = (e: MouseEvent): void => {
		const target = e.target as Element;

		// Check if clicking on a connection handle
		const handle = target.closest('.board-connection-handle') as SVGElement;
		if (handle) {
			this.startConnection(handle, e);
			return;
		}

		// Check if clicking on an edge
		const edgeEl = target.closest('[data-edge-id]') as SVGElement;
		if (edgeEl) {
			this.selectEdge(edgeEl.getAttribute('data-edge-id')!);
			e.preventDefault();
			return;
		}

		// Check if clicking on a node (for drag)
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
			this.selectedEdgeId = null;
			this.render();
			e.preventDefault();
		}
	};

	/* ─── Mouse: Move ──────────────────────────────────────── */

	private readonly onMouseMove = (e: MouseEvent): void => {
		// Drag-to-connect
		if (this.connectState.active) {
			const svgPos = this.clientToSvg(e.clientX, e.clientY);
			this.connectState.currentX = svgPos.x;
			this.connectState.currentY = svgPos.y;
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
		if (this.isDraggingNode && this.dragNodeId) {
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);
			const newX = this.dragNodeStartPos.x + dx;
			const newY = this.dragNodeStartPos.y + dy;

			for (const nodeId of this.selectedNodeIds) {
				const nodeEl = this.nodeGroup.querySelector(`[data-node-id="${nodeId}"]`);
				if (nodeEl) {
					const layout = this.stateManager.getState().nodeLayouts.find(n => n.id === nodeId);
					if (layout) {
						const offsetX = layout.position.x - this.dragNodeStartPos.x;
						const offsetY = layout.position.y - this.dragNodeStartPos.y;
						nodeEl.setAttribute('transform', `translate(${newX + offsetX}, ${newY + offsetY})`);
					}
				}
			}
			return;
		}

		// Cursor feedback
		const handle = (e.target as Element).closest('.board-connection-handle');
		if (handle) {
			this.svg.style.cursor = 'crosshair';
		} else if (!this.isPanning && !this.isDraggingNode) {
			this.svg.style.cursor = 'grab';
		}
	};

	/* ─── Mouse: Up ────────────────────────────────────────── */

	private readonly onMouseUp = (e: MouseEvent): void => {
		// Finish drag-to-connect
		if (this.connectState.active) {
			this.finishConnection(e);
			return;
		}

		// Finish node drag
		if (this.isDraggingNode && this.dragNodeId) {
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);
			const newX = this.dragNodeStartPos.x + dx;
			const newY = this.dragNodeStartPos.y + dy;

			const snapshot = this.createSnapshot();
			this.undoRedo.pushSnapshot(snapshot);

			for (const nodeId of this.selectedNodeIds) {
				const layout = this.stateManager.getState().nodeLayouts.find(n => n.id === nodeId);
				if (layout) {
					const offsetX = layout.position.x - this.dragNodeStartPos.x;
					const offsetY = layout.position.y - this.dragNodeStartPos.y;
					this.stateManager.updateNodePosition(nodeId, {
						x: newX + offsetX,
						y: newY + offsetY,
					});
				}
			}

			this.isDraggingNode = false;
			this.dragNodeId = null;
			this.render();
			return;
		}

		// Finish pan
		if (this.isPanning) {
			this.isPanning = false;
			this.svg.style.cursor = 'grab';
			this.stateManager.setViewport({
				x: this.viewBox.x,
				y: this.viewBox.y,
				zoom: 1200 / this.viewBox.width,
			});
		}
	};

	/* ─── Drag-to-Connect ──────────────────────────────────── */

	private startConnection(handle: SVGElement, e: MouseEvent): void {
		const nodeId = handle.getAttribute('data-node-id');
		const direction = handle.getAttribute('data-direction') as PortPosition;
		if (!nodeId || !direction) return;

		this.connectState.active = true;
		this.connectState.sourceNodeId = nodeId;
		this.connectState.sourcePort = direction;

		const svgPos = this.clientToSvg(e.clientX, e.clientY);
		this.connectState.currentX = svgPos.x;
		this.connectState.currentY = svgPos.y;

		this.svg.style.cursor = 'crosshair';
		e.preventDefault();
		e.stopPropagation();
	}

	private renderTempEdge(): void {
		this.tempEdgeGroup.innerHTML = '';
		if (!this.connectState.sourceNodeId) return;

		const sourceLayout = this.stateManager.getState().nodeLayouts.find(
			n => n.id === this.connectState.sourceNodeId,
		);
		if (!sourceLayout) return;

		const path = renderTempEdge(this.connectState, sourceLayout);
		if (path) {
			this.tempEdgeGroup.appendChild(path);
		}

		// Highlight potential target
		const layouts = this.stateManager.getState().nodeLayouts;
		const target = findNodeAtPosition(
			this.connectState.currentX, this.connectState.currentY,
			layouts, this.connectState.sourceNodeId,
		);

		// Update node opacity to show target
		for (const nodeEl of this.nodeGroup.querySelectorAll('[data-node-id]')) {
			const el = nodeEl as SVGElement;
			const nid = el.getAttribute('data-node-id');
			if (target && nid === target.id) {
				el.setAttribute('opacity', '1');
				el.setAttribute('filter', 'drop-shadow(0 0 4px var(--vscode-textLink-foreground))');
			} else if (nid !== this.connectState.sourceNodeId) {
				el.setAttribute('opacity', '0.4');
				el.removeAttribute('filter');
			}
		}
	}

	private finishConnection(e: MouseEvent): void {
		const svgPos = this.clientToSvg(e.clientX, e.clientY);
		const layouts = this.stateManager.getState().nodeLayouts;
		const target = findNodeAtPosition(svgPos.x, svgPos.y, layouts, this.connectState.sourceNodeId ?? undefined);

		if (target && this.connectState.sourceNodeId && this.callbacks.onAddEdge) {
			const existingEdge = this.stateManager.getState().edges.find(
				ed => ed.source === this.connectState.sourceNodeId && ed.target === target.id,
			);
			if (!existingEdge) {
				const snapshot = this.createSnapshot();
				this.undoRedo.pushSnapshot(snapshot);
				this.callbacks.onAddEdge(this.connectState.sourceNodeId, target.id, 'informs');
			}
		}

		// Reset
		this.connectState = createConnectState();
		this.tempEdgeGroup.innerHTML = '';
		this.svg.style.cursor = 'grab';
		this.render();
	}

	/* ─── Edge Selection ───────────────────────────────────── */

	private selectEdge(edgeId: string): void {
		this.selectedEdgeId = this.selectedEdgeId === edgeId ? null : edgeId;
		this.selectedNodeIds.clear();
		this.render();
	}

	/* ─── Mouse: Node Drag ─────────────────────────────────── */

	private startNodeDrag(nodeEl: SVGElement, e: MouseEvent): void {
		const nodeId = nodeEl.getAttribute('data-node-id');
		if (!nodeId) return;

		// Selection
		if (!e.ctrlKey && !e.metaKey) {
			if (!this.selectedNodeIds.has(nodeId)) {
				this.selectedNodeIds.clear();
				this.selectedNodeIds.add(nodeId);
			}
		} else {
			if (this.selectedNodeIds.has(nodeId)) {
				this.selectedNodeIds.delete(nodeId);
			} else {
				this.selectedNodeIds.add(nodeId);
			}
		}

		this.selectedEdgeId = null;
		this.isDraggingNode = true;
		this.dragNodeId = nodeId;
		this.dragStart = { x: e.clientX, y: e.clientY };

		const layout = this.stateManager.getState().nodeLayouts.find(n => n.id === nodeId);
		this.dragNodeStartPos = layout ? { x: layout.position.x, y: layout.position.y } : { x: 0, y: 0 };

		e.preventDefault();
		e.stopPropagation();
	}

	/* ─── Mouse: Zoom ──────────────────────────────────────── */

	private readonly onWheel = (e: WheelEvent): void => {
		e.preventDefault();
		const rect = this.svg.getBoundingClientRect();
		const svgX = this.viewBox.x + (e.clientX - rect.left) * (this.viewBox.width / rect.width);
		const svgY = this.viewBox.y + (e.clientY - rect.top) * (this.viewBox.height / rect.height);
		this.zoomAt(svgX, svgY, e.deltaY * SCROLL_ZOOM_FACTOR);

		this.stateManager.setViewport({
			x: this.viewBox.x,
			y: this.viewBox.y,
			zoom: 1200 / this.viewBox.width,
		});
	};

	/* ─── Mouse: Double Click ──────────────────────────────── */

	private readonly onDoubleClick = (e: MouseEvent): void => {
		const nodeEl = (e.target as Element).closest('[data-node-id]') as SVGElement;
		if (nodeEl && this.callbacks.onNodeDoubleClick) {
			const nodeId = nodeEl.getAttribute('data-node-id')!;
			const nodeType = nodeEl.getAttribute('data-node-type')!;
			this.callbacks.onNodeDoubleClick(nodeId, nodeType);
		}
	};

	/* ─── Mouse: Context Menu ──────────────────────────────── */

	private readonly onContextMenu = (e: MouseEvent): void => {
		e.preventDefault();

		const nodeEl = (e.target as Element).closest('[data-node-id]') as SVGElement;
		const edgeEl = (e.target as Element).closest('[data-edge-id]') as SVGElement;

		if (nodeEl) {
			this.showNodeContextMenu(nodeEl, e);
		} else if (edgeEl) {
			this.showEdgeContextMenu(edgeEl, e);
		} else {
			this.showCanvasContextMenu(e);
		}
	};

	/* ─── Context Menu: Node ───────────────────────────────── */

	private showNodeContextMenu(nodeEl: SVGElement, e: MouseEvent): void {
		const nodeId = nodeEl.getAttribute('data-node-id')!;
		const nodeType = nodeEl.getAttribute('data-node-type')!;

		// Select the node
		if (!this.selectedNodeIds.has(nodeId)) {
			this.selectedNodeIds.clear();
			this.selectedNodeIds.add(nodeId);
		}
		this.selectedEdgeId = null;
		this.render();

		const delegate: IContextMenuDelegate = {
			getAnchor: () => new StandardMouseEvent(window, e),
			getActions: () => [
				new Action('board.editNode', 'Edit', undefined, true, () => {
					this.callbacks.onEditNode?.(nodeId, nodeType);
				}),
				new Action('board.duplicateNode', 'Duplicate', undefined, true, () => {
					this.callbacks.onDuplicateNode?.(nodeId);
				}),
				new Action('board.separator1', ''),
				new Action('board.deleteNode', 'Delete', undefined, true, () => {
					const snapshot = this.createSnapshot();
					this.undoRedo.pushSnapshot(snapshot);
					this.callbacks.onRemoveNode?.(nodeId, nodeType);
				}),
			],
		};

		this.contextMenuService.showContextMenu(delegate);
	}

	/* ─── Context Menu: Edge ───────────────────────────────── */

	private showEdgeContextMenu(edgeEl: SVGElement, e: MouseEvent): void {
		const edgeId = edgeEl.getAttribute('data-edge-id')!;
		this.selectedEdgeId = edgeId;
		this.selectedNodeIds.clear();
		this.render();

		const edge = this.stateManager.getState().edges.find(ed => ed.id === edgeId);
		const currentType = edge?.type || 'informs';

		const delegate: IContextMenuDelegate = {
			getAnchor: () => new StandardMouseEvent(window, e),
			getActions: () => [
				new Action('board.edgeTypeInforms', 'Type: informs', currentType === 'informs' ? 'checked' : '', true, () => {
					if (edge) this.changeEdgeType(edgeId, 'informs');
				}),
				new Action('board.edgeTypeConstrains', 'Type: constrains', currentType === 'constrains' ? 'checked' : '', true, () => {
					if (edge) this.changeEdgeType(edgeId, 'constrains');
				}),
				new Action('board.edgeTypeContradicts', 'Type: contradicts', currentType === 'contradicts' ? 'checked' : '', true, () => {
					if (edge) this.changeEdgeType(edgeId, 'contradicts');
				}),
				new Action('board.edgeTypeValidates', 'Type: validates', currentType === 'validates' ? 'checked' : '', true, () => {
					if (edge) this.changeEdgeType(edgeId, 'validates');
				}),
				new Action('board.edgeTypeExtends', 'Type: extends', currentType === 'extends' ? 'checked' : '', true, () => {
					if (edge) this.changeEdgeType(edgeId, 'extends');
				}),
				new Action('board.separator1', ''),
				new Action('board.deleteEdge', 'Delete Edge', undefined, true, () => {
					const snapshot = this.createSnapshot();
					this.undoRedo.pushSnapshot(snapshot);
					this.callbacks.onRemoveEdge?.(edgeId);
				}),
			],
		};

		this.contextMenuService.showContextMenu(delegate);
	}

	private changeEdgeType(edgeId: string, newType: FlowEdgeData['type']): void {
		const state = this.stateManager.getState();
		const edge = state.edges.find(ed => ed.id === edgeId);
		if (!edge) return;

		// Remove old edge and add with new type
		this.stateManager.removeEdge(edgeId);
		this.stateManager.addEdge(edge.source, edge.target, newType);
		this.render();
	}

	/* ─── Context Menu: Canvas ──────────────────────────────── */

	private showCanvasContextMenu(e: MouseEvent): void {
		this.selectedNodeIds.clear();
		this.selectedEdgeId = null;
		this.render();

		const delegate: IContextMenuDelegate = {
			getAnchor: () => new StandardMouseEvent(window, e),
			getActions: () => [
				new Action('board.addCard', 'Add Strategy Card', undefined, true, () => {
					this.callbacks.onAddCard?.('vision');
				}),
				new Action('board.addDecision', 'Add Decision', undefined, true, () => {
					this.callbacks.onAddDecision?.();
				}),
				new Action('board.separator1', ''),
				new Action('board.resetLayout', 'Reset Layout', undefined, true, () => {
					this.callbacks.onLayoutChange?.('column');
				}),
				new Action('board.fitView', 'Fit View', undefined, true, () => {
					this.callbacks.onFitView?.();
				}),
			],
		};

		this.contextMenuService.showContextMenu(delegate);
	}

	/* ─── Keyboard ─────────────────────────────────────────── */

	private readonly onKeyDown = (e: KeyboardEvent): void => {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		const selectedIds = Array.from(this.selectedNodeIds);

		// Delete/Backspace — remove selected nodes or edge
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			const snapshot = this.createSnapshot();
			this.undoRedo.pushSnapshot(snapshot);

			if (this.selectedEdgeId) {
				this.callbacks.onRemoveEdge?.(this.selectedEdgeId);
				this.selectedEdgeId = null;
			} else if (selectedIds.length > 0) {
				for (const id of selectedIds) {
					const layout = this.stateManager.getState().nodeLayouts.find(n => n.id === id);
					this.callbacks.onRemoveNode?.(id, layout?.type || 'card');
				}
			}
			this.selectedNodeIds.clear();
			this.render();
			return;
		}

		// Ctrl+D duplicate
		if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedIds.length > 0) {
			e.preventDefault();
			const state = this.stateManager.getState();
			for (const id of selectedIds) {
				const layout = state.nodeLayouts.find(n => n.id === id);
				if (layout) {
					const newId = `${id}-copy-${Date.now().toString(36)}`;
					this.stateManager.addNodeLayout(newId, layout.type, {
						x: layout.position.x + 30,
						y: layout.position.y + 30,
					});
				}
			}
			this.render();
			return;
		}

		// Ctrl+A select all
		if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
			e.preventDefault();
			const state = this.stateManager.getState();
			this.selectedNodeIds = new Set(state.nodeLayouts.map(n => n.id));
			this.selectedEdgeId = null;
			this.render();
			return;
		}

		// Escape deselect
		if (e.key === 'Escape') {
			this.selectedNodeIds.clear();
			this.selectedEdgeId = null;
			this.render();
			return;
		}

		// Arrow keys nudge
		const nudge = e.shiftKey ? 10 : 1;
		let dx = 0, dy = 0;
		if (e.key === 'ArrowUp') dy = -nudge;
		else if (e.key === 'ArrowDown') dy = nudge;
		else if (e.key === 'ArrowLeft') dx = -nudge;
		else if (e.key === 'ArrowRight') dx = nudge;

		if ((dx !== 0 || dy !== 0) && selectedIds.length > 0) {
			e.preventDefault();
			for (const id of selectedIds) {
				const layout = this.stateManager.getState().nodeLayouts.find(n => n.id === id);
				if (layout) {
					this.stateManager.updateNodePosition(id, {
						x: layout.position.x + dx,
						y: layout.position.y + dy,
					});
				}
			}
			this.render();
		}
	};

	/* ─── Snapshot ─────────────────────────────────────────── */

	private createSnapshot(): BoardSnapshot {
		const state = this.stateManager.getState();
		return {
			nodeLayouts: state.nodeLayouts,
			edges: state.edges,
			viewport: { x: this.viewBox.x, y: this.viewBox.y, zoom: 1200 / this.viewBox.width },
		};
	}

	/* ─── Render ───────────────────────────────────────────── */

	render(): void {
		const state = this.stateManager.getState();
		const { cards, constitution, decisions } = this.data;

		// Clear
		this.nodeGroup.innerHTML = '';
		this.edgeGroup.innerHTML = '';

		// Render edges (behind nodes)
		for (const edge of state.edges) {
			const isSelected = edge.id === this.selectedEdgeId;
			const path = renderEdgePath(edge, state.nodeLayouts, isSelected);
			if (path) {
				this.edgeGroup.appendChild(path);

				const sourceLayout = state.nodeLayouts.find(n => n.id === edge.source);
				const targetLayout = state.nodeLayouts.find(n => n.id === edge.target);
				if (sourceLayout && targetLayout) {
					const label = renderEdgeLabel(edge, sourceLayout, targetLayout);
					this.edgeGroup.appendChild(label);
				}
			}
		}

		// Render nodes
		for (const layout of state.nodeLayouts) {
			const isSelected = this.selectedNodeIds.has(layout.id);
			let nodeEl: SVGGElement | null = null;

			if (layout.type === 'constitution' && constitution) {
				nodeEl = renderConstitutionNode(
					layout, constitution,
					() => this.callbacks.onNodeDoubleClick?.(layout.id, 'constitution'),
				);
			} else if (layout.type === 'card') {
				const card = cards.find(c => c.id === layout.id);
				if (card) {
					nodeEl = renderStrategyCardNode(
						layout, card,
						isSelected, false, false,
						() => this.callbacks.onNodeDoubleClick?.(layout.id, 'card'),
					);
				}
			} else if (layout.type === 'decision') {
				const decision = decisions.find(d => d.id === layout.id);
				if (decision) {
					nodeEl = renderDecisionNode(
						layout, decision,
						isSelected, false,
						() => this.callbacks.onNodeDoubleClick?.(layout.id, 'decision'),
					);
				}
			}

			if (nodeEl) {
				if (isSelected) {
					const dims = layout.type === 'constitution' ? { w: 240, h: 100 } :
						layout.type === 'decision' ? { w: 180, h: 100 } : { w: 220, h: 90 };
					this.addSelectionBorder(nodeEl, dims.w, dims.h);
				}

				// Add connection handles
				const handles = renderConnectionHandles(layout);
				nodeEl.appendChild(handles);

				this.nodeGroup.appendChild(nodeEl);
			}
		}
	}

	private addSelectionBorder(el: SVGGElement, w: number, h: number): void {
		const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		rect.setAttribute('x', '-3');
		rect.setAttribute('y', '-3');
		rect.setAttribute('width', String(w + 6));
		rect.setAttribute('height', String(h + 6));
		rect.setAttribute('rx', '11');
		rect.setAttribute('ry', '11');
		rect.setAttribute('fill', 'none');
		rect.setAttribute('stroke', 'var(--vscode-focusBorder, #007acc)');
		rect.setAttribute('stroke-width', '2');
		rect.setAttribute('class', 'board-selection');
		el.insertBefore(rect, el.firstChild);
	}

	/* ─── Public API ───────────────────────────────────────── */

	updateData(data: BoardCanvasData): void {
		this.data = data;
		this.render();
	}

	focus(): void {
		this.svg.focus();
	}

	destroy(): void {
		this.unbind();
		if (this.container.contains(this.svg)) {
			this.container.removeChild(this.svg);
		}
	}
}