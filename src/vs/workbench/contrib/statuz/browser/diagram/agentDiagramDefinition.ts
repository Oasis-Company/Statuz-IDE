/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Agent Diagram Definition — replaces AgentCanvas hardcoded config
 *--------------------------------------------------------------------------------------------*/

import type { DiagramDefinition, DiagramNodeDefinition, DiagramNodeRenderState, DiagramNodeCallbacks } from './diagramTypes.js';

/* ─── SVG Helper ──────────────────────────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string> = {}): SVGElement {
	const el = document.createElementNS(SVG_NS, tag);
	for (const [k, v] of Object.entries(attrs)) {
		el.setAttribute(k, v);
	}
	return el;
}

/* ─── Shared Node Renderer ────────────────────────────────── */

function renderAgentNode(
	layout: DiagramNodeDefinition,
	_item: unknown,
	state: DiagramNodeRenderState,
	_callbacks: DiagramNodeCallbacks,
	config: { width: number; height: number; color: string; label: string; icon?: string; outlined?: boolean },
): SVGGElement {
	const g = svgEl('g', {
		'data-node-id': layout.id,
		'data-node-type': layout.type,
		transform: `translate(${layout.position.x}, ${layout.position.y})`,
	}) as SVGGElement;

	const w = config.width;
	const h = config.height;

	// Outer border rect (for outlined types like rule)
	const outerRect = svgEl('rect', {
		x: '0', y: '0',
		width: String(w), height: String(h),
		rx: '8', ry: '8',
		fill: config.outlined ? 'transparent' : 'var(--vscode-editor-background)',
		stroke: config.color,
		'stroke-width': state.selected ? '2' : config.outlined ? '1.5' : '1',
		'stroke-dasharray': config.outlined ? '4,3' : 'none',
		opacity: state.dimmed ? '0.3' : '1',
	});
	g.appendChild(outerRect);

	// Background fill (solid for non-outlined types)
	if (!config.outlined) {
		const bg = svgEl('rect', {
			x: '0', y: '0',
			width: String(w), height: String(h),
			rx: '8', ry: '8',
			fill: 'var(--vscode-editor-background)',
			opacity: '1',
		});
		g.appendChild(bg);

		// Color accent bar at top
		const accentBar = svgEl('rect', {
			x: '0', y: '0',
			width: String(w), height: '4',
			rx: '8', ry: '8',
			fill: config.color,
			opacity: '0.6',
		});
		g.appendChild(accentBar);
	}

	// Header bar (tinted)
	const header = svgEl('rect', {
		x: '0', y: '0',
		width: String(w), height: '32',
		rx: '8', ry: '8',
		fill: config.color,
		opacity: '0.10',
	});
	g.appendChild(header);

	// Header bottom separator
	const headerLine = svgEl('line', {
		x1: '10', y1: '32',
		x2: String(w - 10), y2: '32',
		stroke: config.color,
		'stroke-width': '0.5',
		opacity: '0.25',
	});
	g.appendChild(headerLine);

	// Icon (if provided)
	if (config.icon) {
		const iconText = svgEl('text', {
			x: '12', y: '22',
			'font-size': '14',
			'font-family': 'sans-serif',
			fill: config.color,
		});
		iconText.textContent = config.icon;
		g.appendChild(iconText);
	}

	// Label
	const label = svgEl('text', {
		x: config.icon ? '32' : '12',
		y: '22',
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
			x: '-1', y: '-1',
			width: String(w + 2), height: String(h + 2),
			rx: '9', ry: '9',
			fill: 'none',
			stroke: config.color,
			'stroke-width': '2',
			opacity: '0.7',
		});
		g.appendChild(indicator);
	}

	// Highlighted state glow
	if (state.highlighted) {
		const glow = svgEl('rect', {
			x: '-3', y: '-3',
			width: String(w + 6), height: String(h + 6),
			rx: '11', ry: '11',
			fill: 'none',
			stroke: config.color,
			'stroke-width': '1.5',
			opacity: '0.35',
		});
		g.appendChild(glow);
	}

	return g;
}

/* ─── Agent Diagram Definition ────────────────────────────── */

export const agentDiagramDefinition: DiagramDefinition = {
	id: 'agent',
	storageKey: 'statuz-agent-canvas',
	maxUndoSteps: 50,
	defaultViewport: { x: -200, y: -200, zoom: 1, width: 1600, height: 1200 },
	nodeTypes: [
		{
			type: 'agent',
			displayName: 'Agent',
			defaultDimensions: { width: 220, height: 110 },
			color: '#4fc3f7',
			renderer: (layout, item, state, callbacks) =>
				renderAgentNode(layout, item, state, callbacks, {
					width: 220, height: 110, color: '#4fc3f7',
					label: 'Agent', icon: '◆',
				}),
		},
		{
			type: 'skill',
			displayName: 'Skill',
			defaultDimensions: { width: 200, height: 100 },
			color: '#81c784',
			renderer: (layout, item, state, callbacks) =>
				renderAgentNode(layout, item, state, callbacks, {
					width: 200, height: 100, color: '#81c784',
					label: 'Skill', icon: '◈',
				}),
		},
		{
			type: 'command',
			displayName: 'Command',
			defaultDimensions: { width: 180, height: 90 },
			color: '#ffb74d',
			renderer: (layout, item, state, callbacks) =>
				renderAgentNode(layout, item, state, callbacks, {
					width: 180, height: 90, color: '#ffb74d',
					label: 'Command', icon: '▶',
				}),
		},
		{
			type: 'rule',
			displayName: 'Rule',
			defaultDimensions: { width: 180, height: 80 },
			color: '#ce93d8',
			renderer: (layout, item, state, callbacks) =>
				renderAgentNode(layout, item, state, callbacks, {
					width: 180, height: 80, color: '#ce93d8',
					label: 'Rule', icon: '◎', outlined: true,
				}),
		},
	],
	edgeTypes: [
		{
			type: 'depends-on',
			displayName: 'depends on',
			color: '#4fc3f7',
			arrowMarker: true,
		},
		{
			type: 'extends',
			displayName: 'extends',
			color: '#81c784',
			strokeDasharray: '5,3',
			arrowMarker: true,
		},
	],
	toolbar: {
		showUndoRedo: true,
		showZoom: true,
		showFitView: true,
		showAutoLayout: true,
		showAddNode: false,
	},
	contextMenu: {
		canvasActions: [],
		nodeActions: [
			{ id: 'install', label: 'Install', enabled: true, handler: () => {} },
			{ id: 'uninstall', label: 'Uninstall', enabled: true, handler: () => {} },
			{ id: 'view-details', label: 'View Details', enabled: true, handler: () => {} },
		],
		edgeActions: [
			{ id: 'remove-edge', label: 'Remove Edge', enabled: true, handler: () => {} },
		],
	},
	callbacks: {},
};