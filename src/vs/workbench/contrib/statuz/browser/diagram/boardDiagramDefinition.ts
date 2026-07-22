/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Board Diagram Definition — replaces BoardCanvas hardcoded config
 *--------------------------------------------------------------------------------------------*/

import type { DiagramDefinition, DiagramNodeDefinition, DiagramNodeRenderState, DiagramNodeCallbacks } from './diagramTypes.js';

/* ─── SVG Helpers ─────────────────────────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string> = {}): SVGElement {
	const el = document.createElementNS(SVG_NS, tag);
	for (const [k, v] of Object.entries(attrs)) {
		el.setAttribute(k, v);
	}
	return el;
}

/* ─── Shared Node Renderer ────────────────────────────────── */

function renderBoardNode(
	layout: DiagramNodeDefinition,
	_item: unknown,
	state: DiagramNodeRenderState,
	_callbacks: DiagramNodeCallbacks,
	config: { width: number; height: number; color: string; label: string; icon?: string; dashed?: boolean },
): SVGGElement {
	const g = svgEl('g', {
		'data-node-id': layout.id,
		'data-node-type': layout.type,
		transform: `translate(${layout.position.x}, ${layout.position.y})`,
	}) as SVGGElement;

	const w = config.width;
	const h = config.height;

	// Background
	const rect = svgEl('rect', {
		x: '0', y: '0',
		width: String(w), height: String(h),
		rx: '8', ry: '8',
		fill: 'var(--vscode-editor-background)',
		stroke: config.color,
		'stroke-width': state.selected ? '2' : '1',
		'stroke-dasharray': config.dashed ? '4,4' : 'none',
		opacity: state.dimmed ? '0.3' : '1',
	});
	g.appendChild(rect);

	// Header bar
	const header = svgEl('rect', {
		x: '0', y: '0',
		width: String(w), height: '28',
		rx: '8', ry: '8',
		fill: config.color,
		opacity: '0.15',
	});
	g.appendChild(header);

	// Header bottom line
	const headerLine = svgEl('line', {
		x1: '8', y1: '28',
		x2: String(w - 8), y2: '28',
		stroke: config.color,
		'stroke-width': '0.5',
		opacity: '0.3',
	});
	g.appendChild(headerLine);

	// Icon (if provided)
	if (config.icon) {
		const iconText = svgEl('text', {
			x: '12', y: '19',
			'font-size': '13',
			'font-family': 'sans-serif',
			fill: config.color,
		});
		iconText.textContent = config.icon;
		g.appendChild(iconText);
	}

	// Label
	const label = svgEl('text', {
		x: config.icon ? '32' : '12',
		y: '19',
		'font-size': '12',
		'font-weight': '600',
		'font-family': 'sans-serif',
		fill: 'var(--vscode-foreground)',
	});
	label.textContent = config.label;
	g.appendChild(label);

	// Type label below header
	const typeLabel = svgEl('text', {
		x: '12', y: String(h - 12),
		'font-size': '10',
		'font-family': 'sans-serif',
		fill: 'var(--vscode-descriptionForeground)',
	});
	typeLabel.textContent = layout.id;
	g.appendChild(typeLabel);

	// Selected state indicator
	if (state.selected) {
		const indicator = svgEl('rect', {
			x: '0', y: '0',
			width: String(w), height: String(h),
			rx: '8', ry: '8',
			fill: 'none',
			stroke: config.color,
			'stroke-width': '2',
			opacity: '0.6',
		});
		g.appendChild(indicator);
	}

	// Highlighted state indicator
	if (state.highlighted) {
		const glow = svgEl('rect', {
			x: '-2', y: '-2',
			width: String(w + 4), height: String(h + 4),
			rx: '10', ry: '10',
			fill: 'none',
			stroke: config.color,
			'stroke-width': '1.5',
			opacity: '0.4',
		});
		g.appendChild(glow);
	}

	return g;
}

/* ─── Board Diagram Definition ────────────────────────────── */

export const boardDiagramDefinition: DiagramDefinition = {
	id: 'board',
	nodeTypes: [
		{
			type: 'constitution',
			displayName: 'Constitution',
			defaultDimensions: { width: 240, height: 100 },
			color: '#a8a29e',
			renderer: (layout, item, state, callbacks) =>
				renderBoardNode(layout, item, state, callbacks, {
					width: 240, height: 100, color: '#a8a29e',
					label: 'Constitution', icon: '🏛',
				}),
		},
		{
			type: 'card',
			displayName: 'Strategy Card',
			defaultDimensions: { width: 220, height: 90 },
			color: '#60a5fa',
			renderer: (layout, item, state, callbacks) =>
				renderBoardNode(layout, item, state, callbacks, {
					width: 220, height: 90, color: '#60a5fa',
					label: 'Strategy Card', icon: '◆',
				}),
		},
		{
			type: 'decision',
			displayName: 'Decision',
			defaultDimensions: { width: 200, height: 80 },
			color: '#f59e0b',
			renderer: (layout, item, state, callbacks) =>
				renderBoardNode(layout, item, state, callbacks, {
					width: 200, height: 80, color: '#f59e0b',
					label: 'Decision', icon: '⚡',
				}),
		},
		{
			type: 'skill-group',
			displayName: 'Skill Group',
			defaultDimensions: { width: 260, height: 120 },
			color: '#10b981',
			renderer: (layout, item, state, callbacks) =>
				renderBoardNode(layout, item, state, callbacks, {
					width: 260, height: 120, color: '#10b981',
					label: 'Skill Group', icon: '⊞', dashed: true,
				}),
		},
	],
	edgeTypes: [
		{
			type: 'informs',
			displayName: 'informs',
			color: '#a8a29e',
			arrowMarker: true,
		},
		{
			type: 'constrains',
			displayName: 'constrains',
			color: '#ef4444',
			strokeDasharray: '5,3',
			arrowMarker: true,
		},
		{
			type: 'contradicts',
			displayName: 'contradicts',
			color: '#f59e0b',
			strokeDasharray: '8,4',
			arrowMarker: true,
		},
		{
			type: 'validates',
			displayName: 'validates',
			color: '#10b981',
			arrowMarker: true,
		},
		{
			type: 'extends',
			displayName: 'extends',
			color: '#3b82f6',
			arrowMarker: true,
		},
	],
	storageKey: 'sb-board',
	maxUndoSteps: 50,
	defaultViewport: { x: 0, y: 0, zoom: 1, width: 1200, height: 800 },
	toolbar: {
		showUndoRedo: true,
		showZoom: true,
		showFitView: true,
		showAutoLayout: true,
		showAddNode: false,
	},
	contextMenu: {
		canvasActions: [
			{ id: 'add-card', label: 'Add Strategy Card', enabled: true, handler: () => {} /* injected by installContextMenuHandlers */ },
			{ id: 'add-decision', label: 'Add Decision', enabled: true, handler: () => {} /* injected by installContextMenuHandlers */ },
			{ id: 'fit-view', label: 'Fit View', enabled: true, handler: () => {} /* injected by installContextMenuHandlers */ },
		],
		nodeActions: [
			{ id: 'edit-node', label: 'Edit', enabled: true, handler: () => {} /* injected by installContextMenuHandlers */ },
			{ id: 'duplicate-node', label: 'Duplicate', enabled: true, handler: () => {} /* injected by installContextMenuHandlers */ },
			{ id: 'remove-node', label: 'Remove', enabled: true, handler: () => {} /* injected by installContextMenuHandlers */ },
		],
		edgeActions: [
			{ id: 'remove-edge', label: 'Remove Edge', enabled: true, handler: () => {} /* injected by installContextMenuHandlers */ },
		],
	},
	callbacks: {},
};