/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Diagram Layout Engine Tests — 7 test scenarios
 *
 *  ai-regression-testing: Mode 1 — Sandbox/production mismatch (dagre dynamic require).
 *  Dagre tests gracefully degrade (skip, not fail) when dagre is unavailable.
 *
 *  agent-introspection-debugging: Each TestResult on failure includes expected, actual, diff.
 *--------------------------------------------------------------------------------------------*/

import { DiagramLayoutEngine } from '../../../browser/diagram/diagramLayoutEngine.js';
import type { DiagramNodeDefinition, DiagramDefinition, LayoutStrategy } from '../../../browser/diagram/diagramTypes.js';

/* ─── Test infrastructure ─────────────────────────────────── */

interface TestResult {
	name: string;
	passed: boolean;
	expected?: string;
	actual?: string;
	diff?: string;
}

function assert(condition: boolean, message: string): void {
	if (!condition) { throw new Error(`Assertion failed: ${message}`); }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
	if (actual !== expected) {
		throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
	}
}

/* ─── Helpers ─────────────────────────────────────────────── */

function makeNode(id: string, type: string): DiagramNodeDefinition {
	return { id, type, position: { x: 0, y: 0 }, size: { width: 220, height: 100 }, metadata: {} };
}

function makeDefinition(): DiagramDefinition {
	return {
		id: 'test-layout',
		storageKey: 'test-layout',
		nodeTypes: [],
		edgeTypes: [],
		maxUndoSteps: 50,
		defaultViewport: { x: 0, y: 0, zoom: 1 },
		toolbar: { showUndoRedo: false, showZoom: false, showFitView: false, showAutoLayout: true, showAddNode: false },
		contextMenu: { canvasActions: [], nodeActions: [], edgeActions: [] },
		callbacks: {},
	};
}

/* ─── Test 1: Column layout — vertical stack ──────────────── */

function testColumnLayoutVerticalStack(): TestResult {
	const name = 'Column layout — vertical stack';
	try {
		const engine = new DiagramLayoutEngine();
		const nodes = [
			makeNode('a', 'agent'),
			makeNode('b', 'agent'),
			makeNode('c', 'agent'),
		];
		const def = makeDefinition();

		const result = engine.layout('column', nodes, [], def);

		assertEquals(result.length, 3, '3 nodes');
		assertEquals(result[0].position.x, 100, 'Node 0 x');
		assertEquals(result[0].position.y, 100, 'Node 0 y');
		assertEquals(result[1].position.x, 100, 'Node 1 x');
		assertEquals(result[1].position.y, 250, 'Node 1 y (rowHeight 150)');
		assertEquals(result[2].position.x, 100, 'Node 2 x');
		assertEquals(result[2].position.y, 400, 'Node 2 y (rowHeight 150 * 2)');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Nodes stacked vertically at x=100', actual: e instanceof Error ? e.message : String(e), diff: 'Column layout vertical stack failed' };
	}
}

/* ─── Test 2: Column layout — empty array ─────────────────── */

function testColumnLayoutEmptyArray(): TestResult {
	const name = 'Column layout — empty array';
	try {
		const engine = new DiagramLayoutEngine();
		const def = makeDefinition();

		const result = engine.layout('column', [], [], def);

		assertEquals(result.length, 0, 'Empty result for empty input');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Empty array returned', actual: e instanceof Error ? e.message : String(e), diff: 'Column layout empty array failed' };
	}
}

/* ─── Test 3: Grouped layout — by type ────────────────────── */

function testGroupedLayoutByType(): TestResult {
	const name = 'Grouped layout — by type';
	try {
		const engine = new DiagramLayoutEngine();
		const nodes = [
			makeNode('a1', 'agent'),
			makeNode('a2', 'agent'),
			makeNode('s1', 'skill'),
		];
		const def = makeDefinition();

		const result = engine.layout('grouped', nodes, [], def);

		assertEquals(result.length, 3, '3 nodes');

		// 'agent' type nodes should be in column 0, 'skill' in column 1
		const agentNodes = result.filter(n => n.type === 'agent');
		const skillNodes = result.filter(n => n.type === 'skill');

		assertEquals(agentNodes.length, 2, '2 agent nodes');
		assertEquals(skillNodes.length, 1, '1 skill node');

		// Same type = same column
		assertEquals(agentNodes[0].position.x, 100, 'Agent 0 in column 0');
		assertEquals(agentNodes[1].position.x, 100, 'Agent 1 in column 0');

		// Different type = different column (columnWidth = 350)
		assertEquals(skillNodes[0].position.x, 450, 'Skill in column 1 (100 + 350)');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Agents in column 0, skills in column 1', actual: e instanceof Error ? e.message : String(e), diff: 'Grouped layout by type failed' };
	}
}

/* ─── Test 4: Grouped layout — single type ────────────────── */

function testGroupedLayoutSingleType(): TestResult {
	const name = 'Grouped layout — single type';
	try {
		const engine = new DiagramLayoutEngine();
		const nodes = [
			makeNode('a', 'agent'),
			makeNode('b', 'agent'),
			makeNode('c', 'agent'),
		];
		const def = makeDefinition();

		const result = engine.layout('grouped', nodes, [], def);

		// All same type = all in same column
		for (const node of result) {
			assertEquals(node.position.x, 100, `Node ${node.id} x = 100 (single column)`);
		}
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'All nodes in same column (x=100)', actual: e instanceof Error ? e.message : String(e), diff: 'Grouped layout single type failed' };
	}
}

/* ─── Test 5: Unknown strategy fallback ───────────────────── */

function testUnknownStrategyFallback(): TestResult {
	const name = 'Unknown strategy fallback';
	try {
		const engine = new DiagramLayoutEngine();
		const nodes = [
			makeNode('a', 'agent'),
			makeNode('b', 'agent'),
		];
		const def = makeDefinition();

		const result = engine.layout('non-existent-strategy', nodes, [], def);

		// Should fall back to column layout
		assertEquals(result.length, 2, '2 nodes');
		assertEquals(result[0].position.x, 100, 'Fallback to column x');
		assertEquals(result[0].position.y, 100, 'Fallback to column y');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Fallback to column layout for unknown strategy', actual: e instanceof Error ? e.message : String(e), diff: 'Unknown strategy fallback failed' };
	}
}

/* ─── Test 6: Strategy registration ───────────────────────── */

function testStrategyRegistration(): TestResult {
	const name = 'Strategy registration';
	try {
		const engine = new DiagramLayoutEngine();

		const customStrategy: LayoutStrategy = {
			name: 'custom-test',
			layout: (nodes) => nodes.map(n => ({ ...n, position: { x: 999, y: 999 } })),
		};

		engine.registerStrategy(customStrategy);

		const available = engine.getAvailableStrategies();
		assert(available.includes('custom-test'), 'Custom strategy registered');

		// Verify custom strategy works
		const nodes = [makeNode('a', 'agent')];
		const def = makeDefinition();
		const result = engine.layout('custom-test', nodes, [], def);
		assertEquals(result[0].position.x, 999, 'Custom strategy x position');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Custom strategy registered and functional', actual: e instanceof Error ? e.message : String(e), diff: 'Strategy registration failed' };
	}
}

/* ─── Test 7: Available strategies list ───────────────────── */

function testAvailableStrategiesList(): TestResult {
	const name = 'Available strategies list';
	try {
		const engine = new DiagramLayoutEngine();
		const available = engine.getAvailableStrategies();

		assert(available.includes('column'), 'column strategy');
		assert(available.includes('grouped'), 'grouped strategy');
		// dagre may or may not be available — just check it's in the list
		// The engine constructor registers it regardless
		assert(available.includes('dagre'), 'dagre strategy registered');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Available strategies includes column, grouped, dagre', actual: e instanceof Error ? e.message : String(e), diff: 'Available strategies list failed' };
	}
}

/* ─── Test runner ─────────────────────────────────────────── */

export function runDiagramLayoutEngineTests(): TestResult[] {
	return [
		testColumnLayoutVerticalStack(),
		testColumnLayoutEmptyArray(),
		testGroupedLayoutByType(),
		testGroupedLayoutSingleType(),
		testUnknownStrategyFallback(),
		testStrategyRegistration(),
		testAvailableStrategiesList(),
	];
}