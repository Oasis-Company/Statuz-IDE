/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Diagram Edge Utilities — edge path rendering, labels, connection handles
 *--------------------------------------------------------------------------------------------*/

import type {
	DiagramEdgeDefinition,
	DiagramNodeDefinition,
	DiagramEdgeTypeConfig,
	ConnectState,
} from './diagramTypes.js';
import { findBestPorts, computeEdgePath, getNodePorts } from './diagramPortUtils.js';

/* ─── SVG Namespace ──────────────────────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSVGElement<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs?: Record<string, string>,
): SVGElementTagNameMap[K] {
	const el = document.createElementNS(SVG_NS, tag);
	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			el.setAttribute(key, value);
		}
	}
	return el;
}

/* ─── Edge Path Rendering ────────────────────────────────── */

export function renderEdgePath(
	edge: DiagramEdgeDefinition,
	layouts: Map<string, DiagramNodeDefinition>,
	selected: boolean,
	edgeTypeConfig: DiagramEdgeTypeConfig,
	defaultDimensions: { width: number; height: number },
): SVGPathElement {
	const sourceLayout = layouts.get(edge.source);
	const targetLayout = layouts.get(edge.target);

	if (!sourceLayout || !targetLayout) {
		// Return invisible path for missing layouts
		return createSVGElement('path', { d: '', fill: 'none', visibility: 'hidden' });
	}

	const ports = findBestPorts(sourceLayout, targetLayout, defaultDimensions);
	if (!ports) {
		return createSVGElement('path', { d: '', fill: 'none', visibility: 'hidden' });
	}

	const pathData = computeEdgePath(ports.sourcePort, ports.targetPort);

	const path = createSVGElement('path', {
		d: pathData,
		fill: 'none',
		stroke: edgeTypeConfig.color,
		'stroke-width': selected ? '3' : '2',
		'stroke-dasharray': edgeTypeConfig.strokeDasharray || 'none',
		'data-edge-id': edge.id,
		'data-edge-type': edge.type,
		class: selected ? 'diagram-edge diagram-edge-selected' : 'diagram-edge',
		style: 'cursor: pointer;',
	});

	if (edgeTypeConfig.arrowMarker) {
		path.setAttribute('marker-end', `url(#arrow-${edge.type})`);
	}

	return path;
}

/* ─── Edge Label Rendering ───────────────────────────────── */

export function renderEdgeLabel(
	edge: DiagramEdgeDefinition,
	sourceLayout: DiagramNodeDefinition,
	targetLayout: DiagramNodeDefinition,
	edgeTypeConfig: DiagramEdgeTypeConfig,
): SVGTextElement | null {
	if (!edge.label) { return null; }

	const midX = (sourceLayout.position.x + targetLayout.position.x) / 2;
	const midY = (sourceLayout.position.y + targetLayout.position.y) / 2;

	const text = createSVGElement('text', {
		x: String(midX),
		y: String(midY - 8),
		'text-anchor': 'middle',
		fill: edgeTypeConfig.color,
		'font-size': '11px',
		'font-family': 'var(--vscode-font-family, sans-serif)',
		'data-edge-label-id': edge.id,
	});
	text.textContent = edge.label;

	return text;
}

/* ─── Connection Handles ─────────────────────────────────── */

export function renderConnectionHandles(
	layout: DiagramNodeDefinition,
	dimensions: { width: number; height: number },
): SVGGElement {
	const g = createSVGElement('g', {
		class: 'diagram-connection-handles',
		'data-node-id': layout.id,
	});

	const ports = getNodePorts(layout, dimensions);
	const handleRadius = 5;

	for (const port of ports) {
		const circle = createSVGElement('circle', {
			cx: String(port.x),
			cy: String(port.y),
			r: String(handleRadius),
			fill: 'var(--vscode-button-background, #007acc)',
			stroke: 'var(--vscode-button-foreground, white)',
			'stroke-width': '1.5',
			'data-port-side': port.side,
			'data-node-id': layout.id,
			class: 'diagram-connection-handle',
			style: 'cursor: crosshair; opacity: 0; transition: opacity 0.15s;',
		});
		g.appendChild(circle);
	}

	return g;
}

/* ─── Temporary Edge (during drag-to-connect) ────────────── */

export function renderTempEdge(
	connectState: ConnectState,
	sourceLayout: DiagramNodeDefinition,
	dimensions: { width: number; height: number },
): SVGPathElement {
	const sourcePorts = getNodePorts(sourceLayout, dimensions);
	const sourcePort = sourcePorts.find(p => p.side === connectState.sourcePort.side) || sourcePorts[0];

	const pathData = computeEdgePath(sourcePort, {
		side: 'right',
		x: connectState.mousePos.x,
		y: connectState.mousePos.y,
	});

	return createSVGElement('path', {
		d: pathData,
		fill: 'none',
		stroke: 'var(--vscode-textLink-foreground, #3794ff)',
		'stroke-width': '2',
		'stroke-dasharray': '5,5',
		class: 'diagram-temp-edge',
		style: 'pointer-events: none;',
	});
}

/* ─── Arrow Marker Definitions ───────────────────────────── */

export function renderArrowMarkerDefs(
	edgeTypes: DiagramEdgeTypeConfig[],
): SVGDefsElement {
	const defs = createSVGElement('defs');

	for (const config of edgeTypes) {
		if (!config.arrowMarker) { continue; }

		const marker = createSVGElement('marker', {
			id: `arrow-${config.type}`,
			viewBox: '0 0 10 10',
			refX: '10',
			refY: '5',
			markerWidth: '6',
			markerHeight: '6',
			orient: 'auto-start-reverse',
		});

		const path = createSVGElement('path', {
			d: 'M 0 0 L 10 5 L 0 10 z',
			fill: config.color,
		});
		marker.appendChild(path);
		defs.appendChild(marker);
	}

	return defs;
}

/* ─── Node Highlight/Dim ─────────────────────────────────── */

export function applyNodeRenderState(
	nodeGroup: SVGGElement,
	state: { dimmed: boolean; selected: boolean; highlighted: boolean },
): void {
	const opacity = state.dimmed ? '0.3' : '1';
	nodeGroup.setAttribute('opacity', opacity);

	if (state.selected) {
		nodeGroup.classList.add('diagram-node-selected');
	} else {
		nodeGroup.classList.remove('diagram-node-selected');
	}

	if (state.highlighted) {
		nodeGroup.classList.add('diagram-node-highlighted');
	} else {
		nodeGroup.classList.remove('diagram-node-highlighted');
	}
}