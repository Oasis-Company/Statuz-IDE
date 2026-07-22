/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Diagram Port Utilities — port calculation, best port selection, bezier paths
 *--------------------------------------------------------------------------------------------*/

import type { DiagramNodeDefinition, DiagramPort } from './diagramTypes.js';

/* ─── Port Calculation ───────────────────────────────────── */

export function getNodePorts(
	layout: DiagramNodeDefinition,
	dimensions: { width: number; height: number },
): DiagramPort[] {
	const { x, y } = layout.position;
	const w = layout.size?.width ?? dimensions.width;
	const h = layout.size?.height ?? dimensions.height;

	return [
		{ side: 'top', x: x + w / 2, y },
		{ side: 'right', x: x + w, y: y + h / 2 },
		{ side: 'bottom', x: x + w / 2, y: y + h },
		{ side: 'left', x, y: y + h / 2 },
	];
}

/* ─── Best Port Selection ────────────────────────────────── */

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function findBestPorts(
	sourceLayout: DiagramNodeDefinition,
	targetLayout: DiagramNodeDefinition,
	dimensions: { width: number; height: number },
): { sourcePort: DiagramPort; targetPort: DiagramPort } | null {
	const sourcePorts = getNodePorts(sourceLayout, dimensions);
	const targetPorts = getNodePorts(targetLayout, dimensions);

	let bestDistance = Infinity;
	let bestPair: { sourcePort: DiagramPort; targetPort: DiagramPort } | null = null;

	for (const sp of sourcePorts) {
		for (const tp of targetPorts) {
			// Prefer ports on opposite sides
			const sideBonus = getOppositeSideBonus(sp.side, tp.side);
			const d = distance(sp, tp) * (1 - sideBonus * 0.3);

			if (d < bestDistance) {
				bestDistance = d;
				bestPair = { sourcePort: sp, targetPort: tp };
			}
		}
	}

	return bestPair;
}

function getOppositeSideBonus(a: string, b: string): number {
	const opposites: Record<string, string> = {
		top: 'bottom',
		bottom: 'top',
		left: 'right',
		right: 'left',
	};
	return opposites[a] === b ? 1 : 0;
}

/* ─── Bezier Path ────────────────────────────────────────── */

export function computeEdgePath(
	sourcePort: DiagramPort,
	targetPort: DiagramPort,
): string {
	const dx = Math.abs(targetPort.x - sourcePort.x);
	const dy = Math.abs(targetPort.y - sourcePort.y);
	const offset = Math.max(40, Math.min(dx, dy) * 0.5);

	const sourceControl = getControlPoint(sourcePort, offset, false);
	const targetControl = getControlPoint(targetPort, offset, true);

	return `M ${sourcePort.x} ${sourcePort.y} C ${sourceControl.x} ${sourceControl.y}, ${targetControl.x} ${targetControl.y}, ${targetPort.x} ${targetPort.y}`;
}

function getControlPoint(
	port: DiagramPort,
	offset: number,
	isTarget: boolean,
): { x: number; y: number } {
	const sign = isTarget ? -1 : 1;

	switch (port.side) {
		case 'right':
			return { x: port.x + offset * sign, y: port.y };
		case 'left':
			return { x: port.x - offset * sign, y: port.y };
		case 'bottom':
			return { x: port.x, y: port.y + offset * sign };
		case 'top':
			return { x: port.x, y: port.y - offset * sign };
	}
}