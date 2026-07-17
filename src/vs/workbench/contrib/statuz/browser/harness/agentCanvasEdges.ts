/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentNodeLayout, getNodeDimensions, createSVGElement } from './agentCanvasNodes.js';

// ─── Edge Types ──────────────────────────────────────────────

export type AgentEdgeType = 'depends-on' | 'extends';

export const AGENT_EDGE_COLORS: Record<string, string> = {
	'depends-on': '#4fc3f7',
	'extends': '#81c784',
};

export const AGENT_EDGE_LABELS: Record<string, string> = {
	'depends-on': 'depends on',
	'extends': 'extends',
};

// ─── Edge Data ───────────────────────────────────────────────

export interface AgentEdgeData {
	id: string;
	source: string;
	target: string;
	type: AgentEdgeType;
}

// ─── Port Types ──────────────────────────────────────────────

export type PortSide = 'top' | 'bottom' | 'left' | 'right';

export interface Port {
	x: number;
	y: number;
	side: PortSide;
}

// ─── Node Ports ──────────────────────────────────────────────

export function getNodePorts(layout: AgentNodeLayout): Port[] {
	const dims = getNodeDimensions(layout.type);
	const w = dims.width;
	const h = dims.height;
	return [
		{ x: layout.position.x + w / 2, y: layout.position.y, side: 'top' },
		{ x: layout.position.x + w / 2, y: layout.position.y + h, side: 'bottom' },
		{ x: layout.position.x, y: layout.position.y + h / 2, side: 'left' },
		{ x: layout.position.x + w, y: layout.position.y + h / 2, side: 'right' },
	];
}

// ─── Best Port Selection ─────────────────────────────────────

export function findBestPorts(
	sourceLayout: AgentNodeLayout,
	targetLayout: AgentNodeLayout,
): { sourcePort: Port; targetPort: Port } {
	const sourcePorts = getNodePorts(sourceLayout);
	const targetPorts = getNodePorts(targetLayout);

	const sx = sourceLayout.position.x;
	const sy = sourceLayout.position.y;
	const tx = targetLayout.position.x;
	const ty = targetLayout.position.y;

	const dx = tx - sx;
	const dy = ty - sy;

	// Score each source-target port pair, preferring ports that face each other
	let bestScore = Infinity;
	let bestSrc = sourcePorts[1]; // default bottom
	let bestTgt = targetPorts[0]; // default top

	for (const sp of sourcePorts) {
		for (const tp of targetPorts) {
			let score = 0;

			// Distance between ports
			const dist = Math.sqrt((sp.x - tp.x) ** 2 + (sp.y - tp.y) ** 2);
			score += dist;

			// Penalize same-side connections
			if (sp.side === tp.side) {
				score += 200;
			}

			// Prefer source using bottom/right, target using top/left
			if (dy > 0) {
				// Target is below source
				if (sp.side === 'bottom') score -= 50;
				if (tp.side === 'top') score -= 50;
			}
			if (dx > 0) {
				// Target is to the right
				if (sp.side === 'right') score -= 30;
				if (tp.side === 'left') score -= 30;
			}

			// Penalize left<->right connections when nodes are vertically aligned
			if (Math.abs(dx) < 50 && (sp.side === 'left' || sp.side === 'right')) {
				score += 100;
			}

			if (score < bestScore) {
				bestScore = score;
				bestSrc = sp;
				bestTgt = tp;
			}
		}
	}

	return { sourcePort: bestSrc, targetPort: bestTgt };
}

// ─── Bezier Path Computation ─────────────────────────────────

export function computeEdgePath(
	sourcePort: Port,
	targetPort: Port,
): string {
	const dx = targetPort.x - sourcePort.x;
	const dy = targetPort.y - sourcePort.y;

	// Control point offset based on port side
	let cp1OffsetX: number;
	let cp1OffsetY: number;
	let cp2OffsetX: number;
	let cp2OffsetY: number;

	const offset = Math.max(50, Math.min(Math.abs(dx), Math.abs(dy)) * 0.5);

	switch (sourcePort.side) {
		case 'top': cp1OffsetX = 0; cp1OffsetY = -offset; break;
		case 'bottom': cp1OffsetX = 0; cp1OffsetY = offset; break;
		case 'left': cp1OffsetX = -offset; cp1OffsetY = 0; break;
		case 'right': cp1OffsetX = offset; cp1OffsetY = 0; break;
	}

	switch (targetPort.side) {
		case 'top': cp2OffsetX = 0; cp2OffsetY = -offset; break;
		case 'bottom': cp2OffsetX = 0; cp2OffsetY = offset; break;
		case 'left': cp2OffsetX = -offset; cp2OffsetY = 0; break;
		case 'right': cp2OffsetX = offset; cp2OffsetY = 0; break;
	}

	const cp1x = sourcePort.x + cp1OffsetX;
	const cp1y = sourcePort.y + cp1OffsetY;
	const cp2x = targetPort.x + cp2OffsetX;
	const cp2y = targetPort.y + cp2OffsetY;

	return `M ${sourcePort.x} ${sourcePort.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetPort.x} ${targetPort.y}`;
}

// ─── Edge Path Rendering ─────────────────────────────────────

export function renderEdgePath(
	edge: AgentEdgeData,
	layouts: Map<string, AgentNodeLayout>,
	selected: boolean,
): { path: SVGPathElement; label: SVGTextElement } | null {
	const sourceLayout = layouts.get(edge.source);
	const targetLayout = layouts.get(edge.target);
	if (!sourceLayout || !targetLayout) {
		return null;
	}

	const { sourcePort, targetPort } = findBestPorts(sourceLayout, targetLayout);
	const d = computeEdgePath(sourcePort, targetPort);
	const color = AGENT_EDGE_COLORS[edge.type] || '#9e9e9e';

	// Path
	const path = createSVGElement<SVGPathElement>('path', {
		d,
		fill: 'none',
		stroke: color,
		'stroke-width': selected ? 2.5 : 1.5,
		'stroke-dasharray': edge.type === 'extends' ? '5,3' : 'none',
		class: 'agent-edge',
		'data-edge-id': edge.id,
		'data-edge-selected': selected ? 'true' : 'false',
		'stroke-opacity': selected ? 1 : 0.7,
	});
	path.style.cursor = 'pointer';
	path.style.transition = 'stroke-width 0.15s ease, stroke-opacity 0.15s ease';

	// Arrow marker
	const markerId = `arrow-${edge.type}-${edge.id.replace(/[^a-zA-Z0-9]/g, '')}`;
	const defs = path.ownerDocument?.querySelector('defs');
	if (defs) {
		const existing = defs.querySelector(`#${markerId}`);
		if (!existing) {
			const marker = createSVGElement<SVGMarkerElement>('marker', {
				id: markerId,
				viewBox: '0 0 10 10',
				refX: 9,
				refY: 5,
				markerWidth: 8,
				markerHeight: 8,
				orient: 'auto',
			});
			const arrowPath = createSVGElement<SVGPathElement>('path', {
				d: 'M 0 0 L 10 5 L 0 10 Z',
				fill: color,
			});
			marker.appendChild(arrowPath);
			defs.appendChild(marker);
		}
		path.setAttribute('marker-end', `url(#${markerId})`);
	}

	// Label
	const label = createSVGElement<SVGTextElement>('text', {
		class: 'agent-edge-label',
		'data-edge-id': edge.id,
		'text-anchor': 'middle',
	});
	const midX = (sourcePort.x + targetPort.x) / 2;
	const midY = (sourcePort.y + targetPort.y) / 2 - 8;
	label.setAttribute('x', String(midX));
	label.setAttribute('y', String(midY));
	label.textContent = AGENT_EDGE_LABELS[edge.type] || edge.type;

	return { path, label };
}

// ─── Connection Handle Rendering ─────────────────────────────

export function renderConnectionHandles(layout: AgentNodeLayout): SVGGElement[] {
	const ports = getNodePorts(layout);
	const handles: SVGGElement[] = [];

	for (const port of ports) {
		const handle = createSVGElement<SVGCircleElement>('circle', {
			cx: port.x,
			cy: port.y,
			r: 0,
			class: 'agent-connection-handle',
			'data-node-id': layout.id,
			'data-port': port.side,
			fill: AGENT_EDGE_COLORS['depends-on'],
			stroke: 'var(--vscode-editor-background)',
			'stroke-width': 2,
		});
		// Create a g wrapper to handle the group
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g.appendChild(handle);
		handles.push(g);
	}

	return handles;
}

// ─── Temp Edge (during drag) ─────────────────────────────────

export interface ConnectState {
	active: boolean;
	sourceNodeId: string;
	sourcePort: Port | null;
	currentMouse: { x: number; y: number } | null;
}

export function createConnectState(): ConnectState {
	return { active: false, sourceNodeId: '', sourcePort: null, currentMouse: null };
}

export function renderTempEdge(state: ConnectState, sourceLayout: AgentNodeLayout): SVGPathElement | null {
	if (!state.sourcePort || !state.currentMouse) {
		return null;
	}

	const d = `M ${state.sourcePort.x} ${state.sourcePort.y} L ${state.currentMouse.x} ${state.currentMouse.y}`;
	const path = createSVGElement<SVGPathElement>('path', {
		d,
		fill: 'none',
		stroke: '#4fc3f7',
		'stroke-width': 2,
		'stroke-dasharray': '6,3',
		class: 'agent-temp-edge',
		'stroke-opacity': 0.6,
	});
	path.style.pointerEvents = 'none';
	return path;
}

// ─── Collision Detection ─────────────────────────────────────

export function findNodeAtPosition(
	clientX: number,
	clientY: number,
	layouts: AgentNodeLayout[],
	svg: SVGSVGElement,
	excludeId?: string,
): AgentNodeLayout | null {
	// Convert client coords to SVG coords
	const pt = svg.createSVGPoint();
	pt.x = clientX;
	pt.y = clientY;
	const ctm = svg.getScreenCTM();
	if (!ctm) {
		return null;
	}
	const svgPt = pt.matrixTransform(ctm.inverse());

	for (const layout of layouts) {
		if (excludeId && layout.id === excludeId) {
			continue;
		}
		const dims = getNodeDimensions(layout.type);
		const x = layout.position.x;
		const y = layout.position.y;
		const w = dims.width;
		const h = dims.height;

		if (svgPt.x >= x && svgPt.x <= x + w && svgPt.y >= y && svgPt.y <= y + h) {
			return layout;
		}
	}

	return null;
}