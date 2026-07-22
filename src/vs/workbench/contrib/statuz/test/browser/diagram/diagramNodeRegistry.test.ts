/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Phase 3: DiagramNodeRegistry Tests — register, query, overwrite
 *  ai-regression-testing: regression pattern 2 — SELECT clause omission (all fields present)
 *--------------------------------------------------------------------------------------------*/

import { registerNodeType, getNodeTypeConfig, hasNodeType, clearNodeTypeRegistry } from '../../../browser/diagram/diagramNodeRegistry.js';
import type { DiagramNodeTypeConfig } from '../../../browser/diagram/diagramTypes.js';

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

const mockConfig: DiagramNodeTypeConfig = {
	type: 'agent',
	displayName: 'Agent',
	defaultDimensions: { width: 220, height: 110 },
	color: '#4fc3f7',
	renderer: () => {
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		return g;
	},
};

/* ─── Test 1: Register and query ─────────────────────────── */

function testRegisterAndQuery(): TestResult {
	const name = 'Register and query node type';

	try {
		clearNodeTypeRegistry();
		registerNodeType(mockConfig);

		assert(hasNodeType('agent'), 'Node type registered');
		const config = getNodeTypeConfig('agent');
		assert(config !== undefined, 'Config retrieved');
		assertEquals(config!.type, 'agent', 'Type preserved');
		assertEquals(config!.displayName, 'Agent', 'Display name preserved');
		assertEquals(config!.defaultDimensions.width, 220, 'Width preserved');
		assertEquals(config!.defaultDimensions.height, 110, 'Height preserved');
		assertEquals(config!.color, '#4fc3f7', 'Color preserved');

		clearNodeTypeRegistry();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'All fields preserved', actual: (e as Error).message, diff: 'Register/query failure' };
	}
}

/* ─── Test 2: Missing type returns undefined ─────────────── */

function testMissingType(): TestResult {
	const name = 'Missing type returns undefined';

	try {
		clearNodeTypeRegistry();
		const config = getNodeTypeConfig('nonexistent');
		assertEquals(config, undefined, 'Missing type returns undefined');
		assert(!hasNodeType('nonexistent'), 'hasNodeType returns false');

		clearNodeTypeRegistry();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'undefined for missing type', actual: (e as Error).message, diff: 'Missing type failure' };
	}
}

/* ─── Test 3: Overwrite protection ───────────────────────── */

function testOverwrite(): TestResult {
	const name = 'Overwrite protection';

	try {
		clearNodeTypeRegistry();
		registerNodeType(mockConfig);

		const overwrite: DiagramNodeTypeConfig = {
			...mockConfig,
			color: '#ff0000',
		};
		registerNodeType(overwrite);

		const config = getNodeTypeConfig('agent');
		assert(config !== undefined, 'Config still exists');
		assertEquals(config!.color, '#ff0000', 'Overwritten color applied');

		clearNodeTypeRegistry();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Overwrite succeeds', actual: (e as Error).message, diff: 'Overwrite failure' };
	}
}

/* ─── Runner ──────────────────────────────────────────────── */

export function runDiagramNodeRegistryTests(): TestResult[] {
	return [
		testRegisterAndQuery(),
		testMissingType(),
		testOverwrite(),
	];
}