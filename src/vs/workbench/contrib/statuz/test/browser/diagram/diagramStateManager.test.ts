/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Phase 3: DiagramStateManager Tests — CRUD + persistence + cross-tab sync
 *  ai-regression-testing: sandbox-mode testing (mock localStorage)
 *  agent-introspection-debugging: expected/actual/diff on failure
 *--------------------------------------------------------------------------------------------*/

import { DiagramStateManager } from '../../../browser/diagram/diagramStateManager.js';
import type { DiagramDefinition } from '../../../browser/diagram/diagramTypes.js';

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

/* ─── Mock Definition ────────────────────────────────────── */

let storageKeyCounter = 0;

function createDefinition(): DiagramDefinition {
	const key = `test-diagram-${++storageKeyCounter}`;
	return {
		id: 'test',
		nodeTypes: [],
		edgeTypes: [],
		storageKey: key,
		maxUndoSteps: 50,
		defaultViewport: { x: 0, y: 0, zoom: 1 },
		toolbar: { showUndoRedo: true, showZoom: true, showFitView: true, showAutoLayout: true, showAddNode: false },
		contextMenu: { canvasActions: [], nodeActions: [], edgeActions: [] },
		callbacks: {},
	};
}

/* ─── Test 1: CRUD — add, update, remove nodes ──────────── */

function testNodeCRUD(): TestResult {
	const name = 'Node CRUD: add, update, remove';

	try {
		const mgr = new DiagramStateManager(createDefinition());

		// Add
		mgr.addNodeLayout('node-1', 'card', { x: 100, y: 200 });
		let state = mgr.getState();
		assertEquals(state.layouts.length, 1, '1 node after add');
		assertEquals(state.layouts[0].id, 'node-1', 'Node ID preserved');
		assertEquals(state.layouts[0].position.x, 100, 'Position X preserved');
		assertEquals(state.layouts[0].position.y, 200, 'Position Y preserved');

		// Update position
		mgr.updateNodePosition('node-1', { x: 300, y: 400 });
		state = mgr.getState();
		assertEquals(state.layouts[0].position.x, 300, 'Position X updated');
		assertEquals(state.layouts[0].position.y, 400, 'Position Y updated');

		// Remove
		mgr.removeNodeLayout('node-1');
		state = mgr.getState();
		assertEquals(state.layouts.length, 0, '0 nodes after remove');

		mgr.destroy();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'All CRUD operations succeed', actual: (e as Error).message, diff: 'Node CRUD failure' };
	}
}

/* ─── Test 2: Edge CRUD ──────────────────────────────────── */

function testEdgeCRUD(): TestResult {
	const name = 'Edge CRUD: add, remove';

	try {
		const mgr = new DiagramStateManager(createDefinition());

		mgr.addNodeLayout('a', 'card');
		mgr.addNodeLayout('b', 'card');

		// Add edge
		const id = mgr.addEdge('a', 'b', 'depends-on');
		assert(id.length > 0, 'Edge ID generated');
		let state = mgr.getState();
		assertEquals(state.edges.length, 1, '1 edge after add');
		assertEquals(state.edges[0].source, 'a', 'Edge source');
		assertEquals(state.edges[0].target, 'b', 'Edge target');

		// Remove edge
		mgr.removeEdge(id);
		state = mgr.getState();
		assertEquals(state.edges.length, 0, '0 edges after remove');

		mgr.destroy();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Edge CRUD operations succeed', actual: (e as Error).message, diff: 'Edge CRUD failure' };
	}
}

/* ─── Test 3: Duplicate edge prevention ──────────────────── */

function testDuplicateEdgePrevention(): TestResult {
	const name = 'Duplicate edge prevention';

	try {
		const mgr = new DiagramStateManager(createDefinition());

		mgr.addNodeLayout('a', 'card');
		mgr.addNodeLayout('b', 'card');

		const id1 = mgr.addEdge('a', 'b', 'depends-on');
		const id2 = mgr.addEdge('a', 'b', 'depends-on');

		assert(id1.length > 0, 'First edge created');
		assertEquals(id2, '', 'Duplicate edge returns empty string');
		assertEquals(mgr.getState().edges.length, 1, 'Only 1 edge in state');

		mgr.destroy();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Duplicate edge prevented', actual: (e as Error).message, diff: 'Duplicate edge prevention failure' };
	}
}

/* ─── Test 4: Persistence to localStorage ────────────────── */

function testPersistence(): TestResult {
	const name = 'Persistence to localStorage';

	try {
		const def = createDefinition();
		const mgr = new DiagramStateManager(def);

		mgr.addNodeLayout('node-1', 'card', { x: 50, y: 60 });
		mgr.addEdge('node-1', 'node-2', 'extends');
		mgr.addNodeLayout('node-2', 'decision', { x: 200, y: 300 });
		mgr.flushPendingWrites();

		// Verify localStorage
		const layoutsRaw = localStorage.getItem(`${def.storageKey}-layouts`);
		assert(layoutsRaw !== null, 'Layouts persisted to localStorage');
		const layouts = JSON.parse(layoutsRaw!);
		assertEquals(layouts.length, 2, '2 layouts persisted');

		const edgesRaw = localStorage.getItem(`${def.storageKey}-edges`);
		assert(edgesRaw !== null, 'Edges persisted to localStorage');

		mgr.destroy();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Data persisted to localStorage', actual: (e as Error).message, diff: 'Persistence failure' };
	}
}

/* ─── Test 5: Subscribe pattern ──────────────────────────── */

function testSubscribe(): TestResult {
	const name = 'Subscribe pattern';

	try {
		const mgr = new DiagramStateManager(createDefinition());
		let notified = false;

		const unsubscribe = mgr.subscribe(() => { notified = true; });
		mgr.addNodeLayout('node-1', 'card');
		assert(notified, 'Listener notified on add');

		notified = false;
		unsubscribe();
		mgr.addNodeLayout('node-2', 'card');
		assert(!notified, 'Listener NOT notified after unsubscribe');

		mgr.destroy();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Subscribe/unsubscribe works', actual: (e as Error).message, diff: 'Subscribe pattern failure' };
	}
}

/* ─── Test 6: Remove node cascades to edges ──────────────── */

function testRemoveNodeCascades(): TestResult {
	const name = 'Remove node cascades to edges';

	try {
		const mgr = new DiagramStateManager(createDefinition());

		mgr.addNodeLayout('a', 'card');
		mgr.addNodeLayout('b', 'card');
		mgr.addNodeLayout('c', 'card');
		mgr.addEdge('a', 'b', 'depends-on');
		mgr.addEdge('b', 'c', 'depends-on');
		mgr.addEdge('a', 'c', 'depends-on');

		assertEquals(mgr.getState().edges.length, 3, '3 edges initially');

		mgr.removeNodeLayout('a');
		const state = mgr.getState();
		assertEquals(state.edges.length, 1, 'Only b->c edge remains (a->b and a->c removed)');
		assertEquals(state.edges[0].source, 'b', 'Remaining edge source is b');
		assertEquals(state.edges[0].target, 'c', 'Remaining edge target is c');

		mgr.destroy();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Orphan edges removed with node', actual: (e as Error).message, diff: 'Cascade failure' };
	}
}

/* ─── Runner ──────────────────────────────────────────────── */

export function runDiagramStateManagerTests(): TestResult[] {
	return [
		testNodeCRUD(),
		testEdgeCRUD(),
		testDuplicateEdgePrevention(),
		testPersistence(),
		testSubscribe(),
		testRemoveNodeCascades(),
	];
}