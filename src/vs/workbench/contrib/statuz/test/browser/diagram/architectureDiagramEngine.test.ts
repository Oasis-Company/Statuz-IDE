/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: ArchitectureDiagramEngine Tests — 10 test scenarios
 *
 *  ai-regression-testing: Mode 4 — Missing rollback (undo/redo integration).
 *  Tests verify the engine's public API, state delegation, and cleanup.
 *
 *  agent-introspection-debugging: Each TestResult on failure includes expected, actual, diff.
 *--------------------------------------------------------------------------------------------*/

import { ArchitectureDiagramEngine } from '../../../browser/diagram/architectureDiagramEngine.js';
import { DiagramStateManager } from '../../../browser/diagram/diagramStateManager.js';
import { DiagramUndoRedo } from '../../../browser/diagram/diagramUndoRedo.js';
import type { DiagramDefinition } from '../../../browser/diagram/diagramTypes.js';

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

/* ─── Mock IContextMenuService ─────────────────────────────── */

function createMockContextMenuService(): any {
	return {
		showContextMenu: (_delegate: any): void => { /* no-op */ },
		_serviceBrand: undefined,
	};
}

/* ─── Helpers ─────────────────────────────────────────────── */

let engineStorageKeyCounter = 0;

function makeDefinition(storageKey?: string): DiagramDefinition {
	const key = storageKey || `test-engine-${++engineStorageKeyCounter}`;
	return {
		id: key,
		storageKey: key,
		nodeTypes: [
			{
				type: 'agent',
				displayName: 'Agent',
				color: '#007acc',
				defaultDimensions: { width: 220, height: 100 },
				renderer: () => {
					const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
					return g;
				},
			},
		],
		edgeTypes: [
			{ type: 'depends-on', displayName: 'Depends', color: '#ff0000', arrowMarker: true },
		],
		maxUndoSteps: 50,
		defaultViewport: { x: 0, y: 0, zoom: 1, width: 1200, height: 800 },
		toolbar: { showUndoRedo: true, showZoom: true, showFitView: true, showAutoLayout: true, showAddNode: false },
		contextMenu: { canvasActions: [], nodeActions: [], edgeActions: [] },
		callbacks: {},
	};
}

/* ─── Test 1: Constructor creates SVG ─────────────────────── */

function testConstructorCreatesSVG(): TestResult {
	const name = 'Constructor creates SVG';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		// Verify SVG is in container
		const svg = container.querySelector('svg');
		assert(svg !== null, 'SVG element should be in container');
		assert(svg!.getAttribute('class') === 'diagram-canvas', 'SVG has correct class');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVG element attached to container', actual: e instanceof Error ? e.message : String(e), diff: 'Constructor failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 2: Initial render ──────────────────────────────── */

function testInitialRender(): TestResult {
	const name = 'Initial render';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		// render() is called in constructor — should not throw
		engine.render(); // should not throw on multiple calls
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'render() does not throw', actual: e instanceof Error ? e.message : String(e), diff: 'Initial render failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 3: Update data ─────────────────────────────────── */

function testUpdateData(): TestResult {
	const name = 'Update data';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		engine.updateData([{ id: 'test', type: 'agent' }]);
		// If we get here without error, updateData worked
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'updateData() does not throw', actual: e instanceof Error ? e.message : String(e), diff: 'Update data failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 4: fitView with layout ─────────────────────────── */

function testFitViewWithLayout(): TestResult {
	const name = 'fitView with layout';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		// Add some node layouts
		stateManager.addNodeLayout('a', 'agent', { x: 100, y: 100 });
		stateManager.addNodeLayout('b', 'agent', { x: 500, y: 300 });

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		engine.fitView();
		// fitView should update viewBox — we can verify by checking the SVG viewBox attribute
		const svg = container.querySelector('svg')!;
		const viewBox = svg.getAttribute('viewBox');
		assert(viewBox !== null, 'viewBox attribute should be set');
		// viewBox should be something like "20 20 600 380" (with padding)
		assert(viewBox!.split(' ').length === 4, 'viewBox has 4 values');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'viewBox updated after fitView', actual: e instanceof Error ? e.message : String(e), diff: 'fitView with layout failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 5: fitView empty canvas ────────────────────────── */

function testFitViewEmptyCanvas(): TestResult {
	const name = 'fitView empty canvas';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		// fitView on empty canvas should not throw
		engine.fitView();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'fitView() does not throw on empty canvas', actual: e instanceof Error ? e.message : String(e), diff: 'fitView empty canvas failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 6: getNodeLayouts delegation ───────────────────── */

function testGetNodeLayoutsDelegation(): TestResult {
	const name = 'getNodeLayouts delegation';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		stateManager.addNodeLayout('a', 'agent', { x: 100, y: 100 });

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		const layouts = engine.getNodeLayouts();
		assertEquals(layouts.length, 1, 'Should have 1 layout');
		assertEquals(layouts[0].id, 'a', 'Node id matches');
		assertEquals(layouts[0].position.x, 100, 'Node x position');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'getNodeLayouts returns stateManager layouts', actual: e instanceof Error ? e.message : String(e), diff: 'getNodeLayouts delegation failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 7: getEdges delegation ─────────────────────────── */

function testGetEdgesDelegation(): TestResult {
	const name = 'getEdges delegation';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		stateManager.addNodeLayout('a', 'agent', { x: 100, y: 100 });
		stateManager.addNodeLayout('b', 'agent', { x: 400, y: 100 });
		stateManager.addEdge('a', 'b', 'depends-on');

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		const edges = engine.getEdges();
		assertEquals(edges.length, 1, 'Should have 1 edge');
		assert(edges[0].id.length > 0, 'Edge id should be non-empty');
		assertEquals(edges[0].source, 'a', 'Edge source matches');
		assertEquals(edges[0].target, 'b', 'Edge target matches');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'getEdges returns stateManager edges', actual: e instanceof Error ? e.message : String(e), diff: 'getEdges delegation failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 8: getZoom calculation ─────────────────────────── */

function testGetZoomCalculation(): TestResult {
	const name = 'getZoom calculation';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		// Set a fixed size so we can calculate zoom
		Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true });
		Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });

		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		const zoom = engine.getZoom();
		assert(zoom > 0, `Zoom should be positive, got ${zoom}`);
		// With default viewBox (1200x800) and client rect (1200x800), zoom should be ~1.0
		assert(zoom >= 0.9 && zoom <= 1.1, `Zoom should be ~1.0, got ${zoom}`);
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Zoom > 0', actual: e instanceof Error ? e.message : String(e), diff: 'getZoom calculation failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test 9: Destroy cleanup ─────────────────────────────── */

function testDestroyCleanup(): TestResult {
	const name = 'Destroy cleanup';
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		const engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		// Verify SVG exists before destroy
		assert(container.querySelector('svg') !== null, 'SVG should exist before destroy');

		engine.destroy();

		// Verify SVG is removed after destroy
		assert(container.querySelector('svg') === null, 'SVG should be removed after destroy');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVG removed from container after destroy', actual: e instanceof Error ? e.message : String(e), diff: 'Destroy cleanup failed' };
	}
}

/* ─── Test 10: Focus ──────────────────────────────────────── */

function testFocus(): TestResult {
	const name = 'Focus';
	let engine: ArchitectureDiagramEngine | null = null;
	try {
		const container = document.createElement('div');
		const def = makeDefinition();
		const stateManager = new DiagramStateManager(def);
		const undoRedo = new DiagramUndoRedo(50);
		const contextMenuService = createMockContextMenuService();

		engine = new ArchitectureDiagramEngine(container, def, stateManager, undoRedo, contextMenuService);

		// focus() should not throw
		engine.focus();
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'focus() does not throw', actual: e instanceof Error ? e.message : String(e), diff: 'Focus failed' };
	} finally {
		engine?.destroy();
	}
}

/* ─── Test runner ─────────────────────────────────────────── */

export function runArchitectureDiagramEngineTests(): TestResult[] {
	return [
		testConstructorCreatesSVG(),
		testInitialRender(),
		testUpdateData(),
		testFitViewWithLayout(),
		testFitViewEmptyCanvas(),
		testGetNodeLayoutsDelegation(),
		testGetEdgesDelegation(),
		testGetZoomCalculation(),
		testDestroyCleanup(),
		testFocus(),
	];
}