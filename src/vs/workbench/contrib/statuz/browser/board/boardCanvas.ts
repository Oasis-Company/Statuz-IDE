/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Native SVG canvas for Board — replaces React Flow with VS Code-native SVG
 *--------------------------------------------------------------------------------------------*/

import type { FlowNodeLayout, FlowEdgeData, SandboxCard, Constitution } from './boardTypes.js';
import { renderConstitutionNode, renderStrategyCardNode, renderDecisionNode } from './boardNodes.js';
import type { BoardStateManager } from './boardStateManager.js';
import type { BoardUndoRedo, BoardSnapshot } from './boardUndoRedo.js';

/* ─── Types ──────────────────────────────────────────────── */

export interface BoardCanvasData {
	cards: SandboxCard[];
	constitution: Constitution | null;
	decisions: Array<{ id: string; type: string; description: string; commitment?: string; time?: string }>;
}

export interface BoardCanvasCallbacks {
	onNodeDoubleClick?: (nodeId: string, nodeType: string) => void;
	onAddEdge?: (source: string, target: string, type: FlowEdgeData['type']) => void;
	onRemoveEdge?: (id: string) => void;
	onAddCard?: (type: string) => void;
	onLayoutChange?: (layout: 'column' | 'dagre' | 'manual') => void;
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
	private defs: SVGDefsElement;

	private stateManager: BoardStateManager;
	private undoRedo: BoardUndoRedo;
	private data: BoardCanvasData;
	private callbacks: BoardCanvasCallbacks;

	// Interaction state
	private isPanning = false;
	private isDraggingNode = false;
	private dragNodeId: string | null = null;
	private dragStart = { x: 0, y: 0 };
	private dragNodeStartPos = { x: 0, y: 0 };
	private selectedNodeIds: Set<string> = new Set();

	// Viewport
	private viewBox = { x: 0, y: 0, width: 1200, height: 800 };

	constructor(
		container: HTMLElement,
		stateManager: BoardStateManager,
		undoRedo: BoardUndoRedo,
		data: BoardCanvasData,
		callbacks: BoardCanvasCallbacks = {},
	) {
		this.container = container;
		this.stateManager = stateManager;
		this.undoRedo = undoRedo;
		this.data = data;
		this.callbacks = callbacks;

		// Create SVG structure
		this.svg = this.createSVG();
		this.defs = this.createDefs();
		this.svg.appendChild(this.defs);
		this.edgeGroup = this.createGroup('board-edges');
		this.nodeGroup = this.createGroup('board-nodes');
		this.boardGroup = this.createGroup('board-root');
		this.boardGroup.appendChild(this.edgeGroup);
		this.boardGroup.appendChild(this.nodeGroup);
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
		const colors: Record<string, string> = {
			informs: '#a8a29e',
			constrains: '#f59e0b',
			contradicts: '#ef4444',
			validates: '#10b981',
			extends: '#3b82f6',
		};

		return types.map(type => `
			<marker id="arrow-${type}" viewBox="0 0 8 8" refX="7" refY="4"
				markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
				<path d="M1 1 L7 4 L1 7 Z" fill="${colors[type]}" />
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

	/* ─── Events ───────────────────────────────────────────── */

	private bindEvents(): void {
		this.svg.addEventListener('mousedown', this.onMouseDown);
		this.svg.addEventListener('mousemove', this.onMouseMove);
		this.svg.addEventListener('mouseup', this.onMouseUp);
		this.svg.addEventListener('mouseleave', this.onMouseUp);
		this.svg.addEventListener('wheel', this.onWheel, { passive: false });
		this.svg.addEventListener('dblclick', this.onDoubleClick);
		this.svg.addEventListener('contextmenu', this.onContextMenu);
		document.addEventListener('keydown', this.onKeyDown);
	}

	unbind(): void {
		this.svg.removeEventListener('mousedown', this.onMouseDown);
		this.svg.removeEventListener('mousemove', this.onMouseMove);
		this.svg.removeEventListener('mouseup', this.onMouseUp);
		this.svg.removeEventListener('mouseleave', this.onMouseUp);
		this.svg.removeEventListener('wheel', this.onWheel);
		this.svg.removeEventListener('dblclick', this.onDoubleClick);
		this.svg.removeEventListener('contextmenu', this.onContextMenu);
		document.removeEventListener('keydown', this.onKeyDown);
	}

	/* ─── Mouse: Pan ───────────────────────────────────────── */

	private readonly onMouseDown = (e: MouseEvent): void => {
		const target = e.target as Element;

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
			e.preventDefault();
		}
	};

	private readonly onMouseMove = (e: MouseEvent): void => {
		if (this.isPanning) {
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);
			this.viewBox.x -= dx;
			this.viewBox.y -= dy;
			this.applyViewBox();
			this.dragStart = { x: e.clientX, y: e.clientY };
			return;
		}

		if (this.isDraggingNode && this.dragNodeId) {
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);
			const newX = this.dragNodeStartPos.x + dx;
			const newY = this.dragNodeStartPos.y + dy;

			// Update all selected nodes
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

		// Connection handle hover
		const handle = (e.target as Element).closest('.board-connection-handle');
		if (handle) {
			this.svg.style.cursor = 'crosshair';
		} else if (!this.isPanning && !this.isDraggingNode) {
			this.svg.style.cursor = 'grab';
		}
	};

	private readonly onMouseUp = (e: MouseEvent): void => {
		if (this.isDraggingNode && this.dragNodeId) {
			const dx = (e.clientX - this.dragStart.x) * (this.viewBox.width / this.svg.clientWidth);
			const dy = (e.clientY - this.dragStart.y) * (this.viewBox.height / this.svg.clientHeight);
			const newX = this.dragNodeStartPos.x + dx;
			const newY = this.dragNodeStartPos.y + dy;

			// Save snapshot before position change
			const snapshot = this.createSnapshot();
			this.undoRedo.pushSnapshot(snapshot);

			// Update all selected nodes
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
		// Context menu will be handled by VS Code's IContextMenuService in Phase 3 Commit 6
	};

	/* ─── Keyboard ─────────────────────────────────────────── */

	private readonly onKeyDown = (e: KeyboardEvent): void => {
		// Don't fire when typing in inputs
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		const selectedIds = Array.from(this.selectedNodeIds);

		// Delete/Backspace
		if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
			e.preventDefault();
			const snapshot = this.createSnapshot();
			this.undoRedo.pushSnapshot(snapshot);
			for (const id of selectedIds) {
				this.stateManager.removeNodeLayout(id);
			}
			this.selectedNodeIds.clear();
			this.render();
			return;
		}

		// Ctrl+D duplicate
		if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedIds.length > 0) {
			e.preventDefault();
			// Duplicate logic — shift positions
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
			this.render();
			return;
		}

		// Escape deselect
		if (e.key === 'Escape') {
			this.selectedNodeIds.clear();
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

		// Render edges
		for (const edge of state.edges) {
			this.renderEdge(edge, state.nodeLayouts);
		}

		// Render nodes
		for (const layout of state.nodeLayouts) {
			if (layout.type === 'constitution' && constitution) {
				const el = renderConstitutionNode(
					layout, constitution,
					() => this.callbacks.onNodeDoubleClick?.(layout.id, 'constitution'),
				);
				if (this.selectedNodeIds.has(layout.id)) this.addSelectionBorder(el, 240, 100);
				this.nodeGroup.appendChild(el);
			} else if (layout.type === 'card') {
				const card = cards.find(c => c.id === layout.id);
				if (card) {
					const el = renderStrategyCardNode(
						layout, card,
						this.selectedNodeIds.has(layout.id), false, false,
						() => this.callbacks.onNodeDoubleClick?.(layout.id, 'card'),
					);
					if (this.selectedNodeIds.has(layout.id)) this.addSelectionBorder(el, 220, 90);
					this.nodeGroup.appendChild(el);
				}
			} else if (layout.type === 'decision') {
				const decision = decisions.find(d => d.id === layout.id);
				if (decision) {
					const el = renderDecisionNode(
						layout, decision,
						this.selectedNodeIds.has(layout.id), false,
						() => this.callbacks.onNodeDoubleClick?.(layout.id, 'decision'),
					);
					this.nodeGroup.appendChild(el);
				}
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

	/* ─── Edge Rendering ───────────────────────────────────── */

	private renderEdge(edge: FlowEdgeData, layouts: FlowNodeLayout[]): void {
		const sourceLayout = layouts.find(n => n.id === edge.source);
		const targetLayout = layouts.find(n => n.id === edge.target);
		if (!sourceLayout || !targetLayout) return;

		const sx = sourceLayout.position.x + 110; // center of node
		const sy = sourceLayout.position.y + 90;  // bottom of node
		const tx = targetLayout.position.x + 110;
		const ty = targetLayout.position.y;

		// Cubic bezier
		const cy = (sy + ty) / 2;
		const d = `M ${sx} ${sy} C ${sx} ${cy}, ${tx} ${cy}, ${tx} ${ty}`;

		const edgeColor =
			edge.type === 'constrains' ? '#f59e0b' :
			edge.type === 'contradicts' ? '#ef4444' :
			edge.type === 'validates' ? '#10b981' :
			edge.type === 'extends' ? '#3b82f6' :
			'#a8a29e';

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', d);
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', edgeColor);
		path.setAttribute('stroke-width', '1.5');
		path.setAttribute('stroke-dasharray', edge.type === 'contradicts' ? '5,3' : 'none');
		path.setAttribute('marker-end', `url(#arrow-${edge.type})`);
		path.setAttribute('class', 'board-edge');
		path.setAttribute('data-edge-id', edge.id);

		this.edgeGroup.appendChild(path);

		// Edge label
		const labelX = (sx + tx) / 2;
		const labelY = (sy + ty) / 2 - 10;
		const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		label.setAttribute('x', String(labelX));
		label.setAttribute('y', String(labelY));
		label.setAttribute('text-anchor', 'middle');
		label.setAttribute('class', 'board-edge-label');
		label.setAttribute('font-size', '9');
		label.setAttribute('fill', 'var(--vscode-descriptionForeground)');
		label.textContent = edge.type;
		this.edgeGroup.appendChild(label);
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