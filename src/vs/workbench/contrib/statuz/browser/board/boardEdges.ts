/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Enhanced edge rendering, port computation, and drag-to-connect
 *--------------------------------------------------------------------------------------------*/

import type { FlowNodeLayout, FlowEdgeData } from './boardTypes.js';

/* ─── Edge Metadata ─────────────────────────────────────── */

export const EDGE_COLORS: Record<string, string> = {
	informs: '#a8a29e',
	constrains: '#f59e0b',
	contradicts: '#ef4444',
	validates: '#10b981',
	extends: '#3b82f6',
};

export const EDGE_LABELS: Record<string, string> = {
	informs: 'informs',
	constrains: 'constrains',
	contradicts: 'contradicts',
	validates: 'validates',
	extends: 'extends',
};

/* ─── Port Types ────────────────────────────────────────── */

export type PortPosition = 'top' | 'right' | 'bottom' | 'left';

export interface NodePorts {
	top: { x: number; y: number };
	right: { x: number; y: number };
	bottom: { x: number; y: number };
	left: { x: number; y: number };
}

/* ─── Node Dimensions ───────────────────────────────────── */

const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
	constitution: { width: 240, height: 100 },
	card: { width: 220, height: 90 },
	decision: { width: 180, height: 100 },
	'skill-group': { width: 220, height: 90 },
};

/* ─── Port Computation ──────────────────────────────────── */

export function getNodePorts(layout: FlowNodeLayout): NodePorts {
	const dims = NODE_DIMENSIONS[layout.type] || { width: 220, height: 90 };
	const { x, y } = layout.position;
	return {
		top: { x: x + dims.width / 2, y },
		right: { x: x + dims.width, y: y + dims.height / 2 },
		bottom: { x: x + dims.width / 2, y: y + dims.height },
		left: { x, y: y + dims.height / 2 },
	};
}

/**
 * Find the best port pair for an edge between two nodes.
 * Chooses ports based on relative node positions (center-to-center vector).
 */
export function findBestPorts(
	sourceLayout: FlowNodeLayout,
	targetLayout: FlowNodeLayout,
): { sourcePort: PortPosition; targetPort: PortPosition } {
	const sourceDims = NODE_DIMENSIONS[sourceLayout.type] || { width: 220, height: 90 };
	const targetDims = NODE_DIMENSIONS[targetLayout.type] || { width: 220, height: 90 };

	const sx = sourceLayout.position.x + sourceDims.width / 2;
	const sy = sourceLayout.position.y + sourceDims.height / 2;
	const tx = targetLayout.position.x + targetDims.width / 2;
	const ty = targetLayout.position.y + targetDims.height / 2;

	const dx = tx - sx;
	const dy = ty - sy;

	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0
			? { sourcePort: 'right', targetPort: 'left' }
			: { sourcePort: 'left', targetPort: 'right' };
	} else {
		return dy > 0
			? { sourcePort: 'bottom', targetPort: 'top' }
			: { sourcePort: 'top', targetPort: 'bottom' };
	}
}

/* ─── Path Computation ──────────────────────────────────── */

/**
 * Compute a cubic bezier path between two port positions.
 * Control points extend outward from the port direction for natural curves.
 */
export function computeEdgePath(
	sourcePort: { x: number; y: number },
	targetPort: { x: number; y: number },
	sourceSide: PortPosition,
	targetSide: PortPosition,
): string {
	const sx = sourcePort.x;
	const sy = sourcePort.y;
	const tx = targetPort.x;
	const ty = targetPort.y;

	const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
	const offset = Math.max(dist * 0.4, 30);

	const getControlOffset = (side: PortPosition): { dx: number; dy: number } => {
		switch (side) {
			case 'right': return { dx: offset, dy: 0 };
			case 'left': return { dx: -offset, dy: 0 };
			case 'bottom': return { dx: 0, dy: offset };
			case 'top': return { dx: 0, dy: -offset };
		}
	};

	const sc = getControlOffset(sourceSide);
	const tc = getControlOffset(targetSide);

	return `M ${sx} ${sy} C ${sx + sc.dx} ${sy + sc.dy}, ${tx + tc.dx} ${ty + tc.dy}, ${tx} ${ty}`;
}

/* ─── Edge SVG Rendering ────────────────────────────────── */

export function renderEdgePath(
	edge: FlowEdgeData,
	layouts: FlowNodeLayout[],
	selected: boolean = false,
): SVGPathElement | null {
	const sourceLayout = layouts.find(n => n.id === edge.source);
	const targetLayout = layouts.find(n => n.id === edge.target);
	if (!sourceLayout || !targetLayout) return null;

	const { sourcePort, targetPort } = findBestPorts(sourceLayout, targetLayout);
	const sourcePorts = getNodePorts(sourceLayout);
	const targetPorts = getNodePorts(targetLayout);

	const d = computeEdgePath(
		sourcePorts[sourcePort], targetPorts[targetPort],
		sourcePort, targetPort,
	);
	const color = EDGE_COLORS[edge.type] || '#a8a29e';

	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', d);
	path.setAttribute('fill', 'none');
	path.setAttribute('stroke', color);
	path.setAttribute('stroke-width', selected ? '2.5' : '1.5');
	path.setAttribute('stroke-dasharray', edge.type === 'contradicts' ? '5,3' : 'none');
	path.setAttribute('marker-end', `url(#arrow-${edge.type})`);
	path.setAttribute('class', `board-edge${selected ? ' selected' : ''}`);
	path.setAttribute('data-edge-id', edge.id);
	path.setAttribute('data-edge-type', edge.type);

	return path;
}

/* ─── Edge Label Rendering ──────────────────────────────── */

export function renderEdgeLabel(
	edge: FlowEdgeData,
	sourceLayout: FlowNodeLayout,
	targetLayout: FlowNodeLayout,
): SVGTextElement {
	const { sourcePort, targetPort } = findBestPorts(sourceLayout, targetLayout);
	const sourcePorts = getNodePorts(sourceLayout);
	const targetPorts = getNodePorts(targetLayout);

	const sx = sourcePorts[sourcePort].x;
	const sy = sourcePorts[sourcePort].y;
	const tx = targetPorts[targetPort].x;
	const ty = targetPorts[targetPort].y;

	const midX = (sx + tx) / 2;
	const midY = (sy + ty) / 2 - 12;

	const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	text.setAttribute('x', String(midX));
	text.setAttribute('y', String(midY));
	text.setAttribute('text-anchor', 'middle');
	text.setAttribute('class', 'board-edge-label');
	text.setAttribute('font-size', '10');
	text.setAttribute('fill', 'var(--vscode-descriptionForeground)');
	text.textContent = edge.label || EDGE_LABELS[edge.type] || edge.type;

	return text;
}

/* ─── Connection Handle Rendering ───────────────────────── */

export function renderConnectionHandles(
	layout: FlowNodeLayout,
): SVGGElement {
	const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	group.setAttribute('class', 'board-connection-handles');
	group.setAttribute('data-node-id', layout.id);

	const dims = NODE_DIMENSIONS[layout.type] || { width: 220, height: 90 };
	const cx = dims.width / 2;
	const cy = dims.height / 2;

	const handles: Array<{ x: number; y: number; dir: PortPosition }> = [
		{ x: cx, y: 0, dir: 'top' },
		{ x: dims.width, y: cy, dir: 'right' },
		{ x: cx, y: dims.height, dir: 'bottom' },
		{ x: 0, y: cy, dir: 'left' },
	];

	for (const h of handles) {
		const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		circle.setAttribute('cx', String(h.x));
		circle.setAttribute('cy', String(h.y));
		circle.setAttribute('r', '4');
		circle.setAttribute('class', 'board-connection-handle');
		circle.setAttribute('data-direction', h.dir);
		circle.setAttribute('data-node-id', layout.id);
		circle.setAttribute('fill', 'var(--vscode-input-border)');
		circle.setAttribute('stroke', 'var(--vscode-editor-background)');
		circle.setAttribute('stroke-width', '2');
		circle.setAttribute('opacity', '0');
		group.appendChild(circle);
	}

	return group;
}

/* ─── Drag-to-Connect State Machine ─────────────────────── */

export interface ConnectState {
	active: boolean;
	sourceNodeId: string | null;
	sourcePort: PortPosition | null;
	currentX: number;
	currentY: number;
}

export function createConnectState(): ConnectState {
	return { active: false, sourceNodeId: null, sourcePort: null, currentX: 0, currentY: 0 };
}

/**
 * Render a temporary connection line during drag-to-connect.
 */
export function renderTempEdge(
	state: ConnectState,
	sourceLayout: FlowNodeLayout,
): SVGPathElement | null {
	if (!state.active || !state.sourcePort) return null;

	const sourcePorts = getNodePorts(sourceLayout);
	const startPort = sourcePorts[state.sourcePort];

	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	const d = computeEdgePath(
		startPort,
		{ x: state.currentX, y: state.currentY },
		state.sourcePort,
		state.sourcePort === 'right' ? 'left' : state.sourcePort === 'left' ? 'right' :
		state.sourcePort === 'bottom' ? 'top' : 'bottom',
	);
	path.setAttribute('d', d);
	path.setAttribute('fill', 'none');
	path.setAttribute('stroke', 'var(--vscode-textLink-foreground, #3794ff)');
	path.setAttribute('stroke-width', '1.5');
	path.setAttribute('stroke-dasharray', '5,4');
	path.setAttribute('class', 'board-temp-edge');
	path.setAttribute('pointer-events', 'none');

	return path;
}

/**
 * Find the node under a given SVG coordinate (for connection target detection).
 */
export function findNodeAtPosition(
	x: number, y: number,
	layouts: FlowNodeLayout[],
	excludeId?: string,
): FlowNodeLayout | null {
	for (const layout of layouts) {
		if (layout.id === excludeId) continue;
		const dims = NODE_DIMENSIONS[layout.type] || { width: 220, height: 90 };
		if (
			x >= layout.position.x && x <= layout.position.x + dims.width &&
			y >= layout.position.y && y <= layout.position.y + dims.height
		) {
			return layout;
		}
	}
	return null;
}