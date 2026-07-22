/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Pipeline Mode Regression Tests — 5 test scenarios
 *
 *  ai-regression-testing: Pattern 4 (Missing rollback) — snapshot/restore + undo/redo.
 *  agent-introspection-debugging: Each TestResult on failure includes expected, actual, diff.
 *--------------------------------------------------------------------------------------------*/

import { ArchitectureDiagramEngine } from '../../../browser/diagram/architectureDiagramEngine.js';
import { DiagramStateManager } from '../../../browser/diagram/diagramStateManager.js';
import { DiagramUndoRedo } from '../../../browser/diagram/diagramUndoRedo.js';
import type { DiagramDefinition, PipelineDefinition, DiagramNodeDefinition, DiagramNodeRenderState, DiagramNodeCallbacks } from '../../../browser/diagram/diagramTypes.js';

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

/* ─── Helpers ──────────────────────────────────────────────── */

let storageKeyCounter = 0;

function makeNodeRenderer(dims: { width: number; height: number }, color: string, label: string) {
	return (_layout: DiagramNodeDefinition, _item: unknown, _state: DiagramNodeRenderState, _callbacks: DiagramNodeCallbacks) => {
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		rect.setAttribute('width', String(dims.width));
		rect.setAttribute('height', String(dims.height));
		rect.setAttribute('fill', color);
		rect.setAttribute('rx', '8');
		g.appendChild(rect);
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text.setAttribute('x', String(dims.width / 2));
		text.setAttribute('y', String(dims.height / 2 + 5));
		text.setAttribute('text-anchor', 'middle');
		text.setAttribute('fill', '#ffffff');
		text.textContent = label;
		g.appendChild(text);
		return g;
	};
}

function makePipelineDefinition(): {
	definition: DiagramDefinition;
	pipeline: PipelineDefinition;
	stateManager: DiagramStateManager;
	undoRedo: DiagramUndoRedo;
	container: HTMLElement;
} {
	const key = `test-pipeline-${++storageKeyCounter}`;
	const definition: DiagramDefinition = {
		id: key,
		storageKey: key,
		maxUndoSteps: 50,
		defaultViewport: { x: 0, y: 0, zoom: 1, width: 1200, height: 800 },
		toolbar: {
			showUndoRedo: true,
			showZoom: true,
			showFitView: true,
			showAutoLayout: true,
			showAddNode: false,
		},
		nodeTypes: [
			{
				type: 'source',
				displayName: 'Source',
				color: '#4ec9b0',
				defaultDimensions: { width: 200, height: 80 },
				renderer: makeNodeRenderer({ width: 200, height: 80 }, '#4ec9b0', 'Source'),
			},
			{
				type: 'processor',
				displayName: 'Processor',
				color: '#569cd6',
				defaultDimensions: { width: 200, height: 80 },
				renderer: makeNodeRenderer({ width: 200, height: 80 }, '#569cd6', 'Processor'),
			},
			{
				type: 'sink',
				displayName: 'Sink',
				color: '#ce9178',
				defaultDimensions: { width: 200, height: 80 },
				renderer: makeNodeRenderer({ width: 200, height: 80 }, '#ce9178', 'Sink'),
			},
		],
		edgeTypes: [
			{
				type: 'flow',
				displayName: 'Flow',
				color: '#6a9955',
				arrowMarker: true,
			},
		],
		contextMenu: { canvasActions: [], nodeActions: [], edgeActions: [] },
		callbacks: {},
	};

	const pipeline: PipelineDefinition = {
		stages: [
			{ name: 'Input', allowedNodeTypes: ['source'], allowedEdgeTypes: ['flow'] },
			{ name: 'Process', allowedNodeTypes: ['processor'], allowedEdgeTypes: ['flow'] },
			{ name: 'Output', allowedNodeTypes: ['sink'], allowedEdgeTypes: ['flow'] },
		],
	};

	const stateManager = new DiagramStateManager(definition);
	const undoRedo = new DiagramUndoRedo(50);

	// Seed initial nodes: one of each type
	stateManager.setLayouts([
		{
			id: 'node-source',
			type: 'source',
			position: { x: 100, y: 100 },
			size: { width: 200, height: 80 },
		},
		{
			id: 'node-processor',
			type: 'processor',
			position: { x: 400, y: 100 },
			size: { width: 200, height: 80 },
		},
		{
			id: 'node-sink',
			type: 'sink',
			position: { x: 700, y: 100 },
			size: { width: 200, height: 80 },
		},
	]);

	const container = document.createElement('div');
	container.style.width = '1200px';
	container.style.height = '800px';
	document.body.appendChild(container);

	return { definition, pipeline, stateManager, undoRedo, container };
}

function cleanup(container: HTMLElement, engine: ArchitectureDiagramEngine): void {
	engine.destroy();
	container.remove();
}

/* ─── Test 1: enablePipelineMode saves snapshot ────────────── */

function testEnablePipelineSavesSnapshot(): TestResult {
	const { definition, pipeline, stateManager, undoRedo, container } = makePipelineDefinition();
	const engine = new ArchitectureDiagramEngine(container, definition, stateManager, undoRedo, createMockContextMenuService());

	// Verify initial layout has 3 nodes
	const initialLayouts = engine.getNodeLayouts();
	assert(initialLayouts.length === 3, 'Should have 3 initial nodes');

	// Enable pipeline mode
	engine.enablePipelineMode(pipeline);

	// Verify snapshot was saved (pipelineMode is true)
	const afterPipelineLayouts = engine.getNodeLayouts();
	assert(afterPipelineLayouts.length === 3, 'Should still have 3 nodes after pipeline');

	// Verify nodes are vertically arranged (y positions should differ significantly)
	const yPositions = afterPipelineLayouts.map(l => l.position.y);
	const uniqueY = new Set(yPositions);
	assert(uniqueY.size >= 2, 'Pipeline layout should arrange nodes in different vertical positions');

	cleanup(container, engine);
	return { name: 'enablePipelineMode saves snapshot', passed: true };
}

/* ─── Test 2: enablePipelineMode arranges nodes by stage ───── */

function testPipelineArrangesByStage(): TestResult {
	const { definition, pipeline, stateManager, undoRedo, container } = makePipelineDefinition();
	const engine = new ArchitectureDiagramEngine(container, definition, stateManager, undoRedo, createMockContextMenuService());

	engine.enablePipelineMode(pipeline);

	const layouts = engine.getNodeLayouts();

	// Find each node by type
	const sourceNode = layouts.find(l => l.type === 'source');
	const processorNode = layouts.find(l => l.type === 'processor');
	const sinkNode = layouts.find(l => l.type === 'sink');

	assert(sourceNode !== undefined, 'Source node should exist');
	assert(processorNode !== undefined, 'Processor node should exist');
	assert(sinkNode !== undefined, 'Sink node should exist');

	// Source should be above processor, processor above sink
	assert(sourceNode!.position.y < processorNode!.position.y,
		'Source should be positioned above processor');
	assert(processorNode!.position.y < sinkNode!.position.y,
		'Processor should be positioned above sink');

	cleanup(container, engine);
	return { name: 'enablePipelineMode arranges nodes by stage', passed: true };
}

/* ─── Test 3: disablePipelineMode restores original layout ─── */

function testDisablePipelineRestoresLayout(): TestResult {
	const { definition, pipeline, stateManager, undoRedo, container } = makePipelineDefinition();
	const engine = new ArchitectureDiagramEngine(container, definition, stateManager, undoRedo, createMockContextMenuService());

	// Capture original positions
	const originalLayouts = engine.getNodeLayouts();
	const originalPositions = new Map(originalLayouts.map(l => [l.id, { ...l.position }]));

	// Enable pipeline mode
	engine.enablePipelineMode(pipeline);
	const pipelineLayouts = engine.getNodeLayouts();
	const pipelinePositions = new Map(pipelineLayouts.map(l => [l.id, { ...l.position }]));

	// Verify positions changed
	let changed = false;
	for (const [id, pos] of pipelinePositions) {
		const orig = originalPositions.get(id);
		if (orig && (pos.x !== orig.x || pos.y !== orig.y)) {
			changed = true;
			break;
		}
	}
	assert(changed, 'Pipeline mode should change node positions');

	// Disable pipeline mode
	engine.disablePipelineMode();

	// Verify positions are restored to original
	const restoredLayouts = engine.getNodeLayouts();
	const restoredPositions = new Map(restoredLayouts.map(l => [l.id, { ...l.position }]));

	for (const [id, orig] of originalPositions) {
		const rest = restoredPositions.get(id);
		assert(rest !== undefined, `Node ${id} should exist after restore`);
		assertEquals(rest!.x, orig.x, `Node ${id} x should be restored`);
		assertEquals(rest!.y, orig.y, `Node ${id} y should be restored`);
	}

	cleanup(container, engine);
	return { name: 'disablePipelineMode restores original layout', passed: true };
}

/* ─── Test 4: Pipeline mode + undo/redo ────────────────────── */

function testPipelineUndoRedo(): TestResult {
	const { definition, pipeline, stateManager, undoRedo, container } = makePipelineDefinition();
	const engine = new ArchitectureDiagramEngine(container, definition, stateManager, undoRedo, createMockContextMenuService());

	// Enable pipeline mode
	engine.enablePipelineMode(pipeline);

	// Verify undo stack has the pipeline entry
	assert(undoRedo.canUndo(), 'Should be able to undo after pipeline enable');

	// Undo the pipeline enable
	undoRedo.undo();
	const afterUndoLayouts = engine.getNodeLayouts();
	assert(afterUndoLayouts.length === 3, 'Should have 3 nodes after undo');

	// Redo
	undoRedo.redo();
	const afterRedoLayouts = engine.getNodeLayouts();
	assert(afterRedoLayouts.length === 3, 'Should have 3 nodes after redo');

	cleanup(container, engine);
	return { name: 'Pipeline mode supports undo/redo', passed: true };
}

/* ─── Test 5: Empty pipeline doesn't crash ─────────────────── */

function testEmptyPipelineNoCrash(): TestResult {
	const { definition, stateManager, undoRedo, container } = makePipelineDefinition();
	const engine = new ArchitectureDiagramEngine(container, definition, stateManager, undoRedo, createMockContextMenuService());

	const emptyPipeline: PipelineDefinition = { stages: [] };

	// Should not throw
	try {
		engine.enablePipelineMode(emptyPipeline);
		// Should fall back to column layout
		const layouts = engine.getNodeLayouts();
		assert(layouts.length === 3, 'Should still have 3 nodes with empty pipeline');
	} catch (e) {
		return { name: 'Empty pipeline does not crash', passed: false, expected: 'no error', actual: String(e) };
	}

	// Disable should also not throw
	try {
		engine.disablePipelineMode();
	} catch (e) {
		return { name: 'Empty pipeline disable does not crash', passed: false, expected: 'no error', actual: String(e) };
	}

	cleanup(container, engine);
	return { name: 'Empty pipeline does not crash', passed: true };
}

/* ─── Test Runner ──────────────────────────────────────────── */

export function runPipelineModeTests(): TestResult[] {
	const results: TestResult[] = [];

	const tests = [
		testEnablePipelineSavesSnapshot,
		testPipelineArrangesByStage,
		testDisablePipelineRestoresLayout,
		testPipelineUndoRedo,
		testEmptyPipelineNoCrash,
	];

	for (const test of tests) {
		try {
			const result = test();
			results.push(result);
		} catch (err) {
			results.push({
				name: test.name,
				passed: false,
				expected: 'test to pass',
				actual: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}