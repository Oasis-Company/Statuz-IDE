/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Phase 3: DiagramPortUtils Tests — port calculation, best port selection, bezier paths
 *  ai-regression-testing: regression pattern 1 — sandbox/production mismatch
 *--------------------------------------------------------------------------------------------*/

import { getNodePorts, findBestPorts, computeEdgePath } from '../../../browser/diagram/diagramPortUtils.js';
import type { DiagramNodeDefinition } from '../../../browser/diagram/diagramTypes.js';

/* ─── Helpers ────────────────────────────────────────────── */

function assert(condition: boolean, message: string): void {
	if (!condition) { throw new Error(`FAIL: ${message}`); }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
	if (actual !== expected) {
		throw new Error(`FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
	}
}

interface TestResult {
	name: string;
	passed: boolean;
	expected?: string;
	actual?: string;
	diff?: string;
}

const dims = { width: 200, height: 100 };

/* ─── Test 1: Port calculation — 4 ports ─────────────────── */

function testPortCalculation(): TestResult {
	const name = 'Port calculation: 4 ports';

	try {
		const layout: DiagramNodeDefinition = {
			id: 'n1',
			type: 'card',
			position: { x: 100, y: 200 },
		};

		const ports = getNodePorts(layout, dims);
		assertEquals(ports.length, 4, '4 ports generated');

		// Top
		assertEquals(ports[0].side, 'top', 'Port 0 is top');
		assertEquals(ports[0].x, 200, 'Top port X at center');
		assertEquals(ports[0].y, 200, 'Top port Y at top edge');

		// Right
		assertEquals(ports[1].side, 'right', 'Port 1 is right');
		assertEquals(ports[1].x, 300, 'Right port X at right edge');
		assertEquals(ports[1].y, 250, 'Right port Y at center');

		// Bottom
		assertEquals(ports[2].side, 'bottom', 'Port 2 is bottom');
		assertEquals(ports[2].x, 200, 'Bottom port X at center');
		assertEquals(ports[2].y, 300, 'Bottom port Y at bottom edge');

		// Left
		assertEquals(ports[3].side, 'left', 'Port 3 is left');
		assertEquals(ports[3].x, 100, 'Left port X at left edge');
		assertEquals(ports[3].y, 250, 'Left port Y at center');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: '4 ports at correct positions', actual: (e as Error).message, diff: 'Port calculation failure' };
	}
}

/* ─── Test 2: Best port selection — opposite sides preferred ─ */

function testBestPortSelection(): TestResult {
	const name = 'Best port selection: opposite sides preferred';

	try {
		// Source on left, target on right → source.right ↔ target.left
		const sourceLayout: DiagramNodeDefinition = {
			id: 's', type: 'card', position: { x: 0, y: 0 },
		};
		const targetLayout: DiagramNodeDefinition = {
			id: 't', type: 'card', position: { x: 400, y: 0 },
		};

		const ports = findBestPorts(sourceLayout, targetLayout, dims);
		assert(ports !== null, 'Ports found');
		assertEquals(ports!.sourcePort.side, 'right', 'Source port is right');
		assertEquals(ports!.targetPort.side, 'left', 'Target port is left');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Opposite sides selected', actual: (e as Error).message, diff: 'Best port selection failure' };
	}
}

/* ─── Test 3: Bezier path generation ──────────────────────── */

function testBezierPath(): TestResult {
	const name = 'Bezier path generation';

	try {
		const path = computeEdgePath(
			{ side: 'right', x: 100, y: 50 },
			{ side: 'left', x: 300, y: 50 },
		);

		assert(path.startsWith('M 100 50 C'), 'Path starts with correct M command');
		assert(path.endsWith('300 50'), 'Path ends at target coordinates');
		assert(path.includes('C'), 'Path contains cubic bezier command');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Valid SVG path string', actual: (e as Error).message, diff: 'Bezier path failure' };
	}
}

/* ─── Test 4: Custom size overrides default dimensions ────── */

function testCustomSize(): TestResult {
	const name = 'Custom size overrides default dimensions';

	try {
		const layout: DiagramNodeDefinition = {
			id: 'n1',
			type: 'card',
			position: { x: 100, y: 200 },
			size: { width: 300, height: 150 },
		};

		const ports = getNodePorts(layout, dims);
		assertEquals(ports[1].x, 400, 'Right port uses custom width (100+300)');
		assertEquals(ports[2].y, 350, 'Bottom port uses custom height (200+150)');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Custom size applied', actual: (e as Error).message, diff: 'Custom size failure' };
	}
}

/* ─── Runner ──────────────────────────────────────────────── */

export function runDiagramPortUtilsTests(): TestResult[] {
	return [
		testPortCalculation(),
		testBestPortSelection(),
		testBezierPath(),
		testCustomSize(),
	];
}