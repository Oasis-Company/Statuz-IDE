/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Diagram Edge Utilities Tests — 14 test scenarios
 *
 *  ai-regression-testing: Mode 3 — DOM simulation correctness.
 *  All functions return SVG DOM elements; tests verify attribute key-value correctness.
 *
 *  agent-introspection-debugging: Each TestResult on failure includes expected, actual, diff.
 *--------------------------------------------------------------------------------------------*/

import {
	renderEdgePath, renderEdgeLabel, renderConnectionHandles,
	renderTempEdge, renderArrowMarkerDefs, applyNodeRenderState,
	createSVGElement,
} from '../../../browser/diagram/diagramEdgeUtils.js';
import type { DiagramEdgeDefinition, DiagramNodeDefinition, DiagramEdgeTypeConfig, ConnectState } from '../../../browser/diagram/diagramTypes.js';

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

function assertNotNull<T>(value: T | null, message: string): asserts value is T {
	if (value === null) { throw new Error(`Assertion failed: ${message} — value is null`); }
}

/* ─── Helpers ─────────────────────────────────────────────── */

function makeLayout(id: string, x: number, y: number, type: string = 'agent'): DiagramNodeDefinition {
	return {
		id,
		type,
		position: { x, y },
		size: { width: 220, height: 100 },
		metadata: {},
	};
}

function makeEdgeConfig(type: string, color: string, arrowMarker: boolean = true, dash?: string): DiagramEdgeTypeConfig {
	return { type, displayName: type, color, strokeDasharray: dash, arrowMarker };
}

function makeEdge(id: string, source: string, target: string, type: string, label?: string): DiagramEdgeDefinition {
	return { id, source, target, type, label };
}

const defaultDimensions = { width: 220, height: 100 };

/* ─── Test 1: Edge path with valid layouts ────────────────── */

function testEdgePathWithValidLayouts(): TestResult {
	const name = 'Edge path with valid layouts';
	try {
		const layouts = new Map<string, DiagramNodeDefinition>();
		layouts.set('a', makeLayout('a', 100, 100));
		layouts.set('b', makeLayout('b', 400, 100));
		const edge = makeEdge('e1', 'a', 'b', 'depends-on');
		const config = makeEdgeConfig('depends-on', '#ff0000');

		const path = renderEdgePath(edge, layouts, false, config, defaultDimensions);

		assert(path.tagName === 'path', 'Should return SVGPathElement');
		const d = path.getAttribute('d')!;
		assert(d.length > 0, `d attribute should be non-empty, got "${d}"`);
		assertEquals(path.getAttribute('stroke'), '#ff0000', 'stroke color');
		assertEquals(path.getAttribute('data-edge-id'), 'e1', 'data-edge-id');
		assertEquals(path.getAttribute('stroke-width'), '2', 'stroke-width for unselected');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVGPathElement with correct attributes', actual: e instanceof Error ? e.message : String(e), diff: 'Edge path rendering failed' };
	}
}

/* ─── Test 2: Edge path with missing layout ───────────────── */

function testEdgePathWithMissingLayout(): TestResult {
	const name = 'Edge path with missing layout';
	try {
		const layouts = new Map<string, DiagramNodeDefinition>();
		layouts.set('a', makeLayout('a', 100, 100));
		const edge = makeEdge('e1', 'a', 'missing', 'depends-on');
		const config = makeEdgeConfig('depends-on', '#ff0000');

		const path = renderEdgePath(edge, layouts, false, config, defaultDimensions);

		assertEquals(path.getAttribute('visibility'), 'hidden', 'visibility hidden for missing layout');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Hidden path for missing layout', actual: e instanceof Error ? e.message : String(e), diff: 'Missing layout handling failed' };
	}
}

/* ─── Test 3: Edge path with arrow marker ─────────────────── */

function testEdgePathWithArrowMarker(): TestResult {
	const name = 'Edge path with arrow marker';
	try {
		const layouts = new Map<string, DiagramNodeDefinition>();
		layouts.set('a', makeLayout('a', 100, 100));
		layouts.set('b', makeLayout('b', 400, 100));
		const edge = makeEdge('e1', 'a', 'b', 'depends-on');
		const config = makeEdgeConfig('depends-on', '#ff0000', true);

		const path = renderEdgePath(edge, layouts, false, config, defaultDimensions);

		assertEquals(path.getAttribute('marker-end'), 'url(#arrow-depends-on)', 'marker-end attribute');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'marker-end = url(#arrow-depends-on)', actual: e instanceof Error ? e.message : String(e), diff: 'Arrow marker rendering failed' };
	}
}

/* ─── Test 4: Edge path with dasharray ────────────────────── */

function testEdgePathWithDasharray(): TestResult {
	const name = 'Edge path with dasharray';
	try {
		const layouts = new Map<string, DiagramNodeDefinition>();
		layouts.set('a', makeLayout('a', 100, 100));
		layouts.set('b', makeLayout('b', 400, 100));
		const edge = makeEdge('e1', 'a', 'b', 'dashed');
		const config = makeEdgeConfig('dashed', '#00ff00', false, '5,5');

		const path = renderEdgePath(edge, layouts, false, config, defaultDimensions);

		assertEquals(path.getAttribute('stroke-dasharray'), '5,5', 'stroke-dasharray');
		// No arrow marker for arrowMarker=false
		assert(path.getAttribute('marker-end') === null, 'No marker-end for non-arrow edge');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'stroke-dasharray = 5,5, no marker-end', actual: e instanceof Error ? e.message : String(e), diff: 'Dasharray rendering failed' };
	}
}

/* ─── Test 5: Edge label with text ────────────────────────── */

function testEdgeLabelWithText(): TestResult {
	const name = 'Edge label with text';
	try {
		const edge = makeEdge('e1', 'a', 'b', 'depends-on', 'dependency');
		const sourceLayout = makeLayout('a', 100, 100);
		const targetLayout = makeLayout('b', 400, 100);
		const config = makeEdgeConfig('depends-on', '#ff0000');

		const label = renderEdgeLabel(edge, sourceLayout, targetLayout, config);

		assertNotNull(label, 'Label should not be null');
		assert(label.tagName === 'text', 'Should return SVGTextElement');
		assertEquals(label.textContent, 'dependency', 'textContent matches edge.label');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVGTextElement with textContent = dependency', actual: e instanceof Error ? e.message : String(e), diff: 'Edge label with text failed' };
	}
}

/* ─── Test 6: Edge label without text ─────────────────────── */

function testEdgeLabelWithoutText(): TestResult {
	const name = 'Edge label without text';
	try {
		const edge = makeEdge('e1', 'a', 'b', 'depends-on'); // no label
		const sourceLayout = makeLayout('a', 100, 100);
		const targetLayout = makeLayout('b', 400, 100);
		const config = makeEdgeConfig('depends-on', '#ff0000');

		const label = renderEdgeLabel(edge, sourceLayout, targetLayout, config);

		assert(label === null, 'Label should be null when edge has no label');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'null for edge without label', actual: e instanceof Error ? e.message : String(e), diff: 'Edge label without text failed' };
	}
}

/* ─── Test 7: Connection handles generation ───────────────── */

function testConnectionHandlesGeneration(): TestResult {
	const name = 'Connection handles generation';
	try {
		const layout = makeLayout('a', 100, 100);
		const g = renderConnectionHandles(layout, defaultDimensions);

		assert(g.tagName === 'g', 'Should return SVGGElement');
		const circles = g.querySelectorAll('circle');
		assertEquals(circles.length, 4, '4 circles (one per port side)');

		const sides = ['top', 'right', 'bottom', 'left'];
		for (let i = 0; i < 4; i++) {
			const side = circles[i].getAttribute('data-port-side');
			assert(sides.includes(side!), `Circle ${i} has valid port side: ${side}`);
			assertEquals(circles[i].getAttribute('data-node-id'), 'a', 'data-node-id on handle');
		}
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVGGElement with 4 circles, each with data-port-side', actual: e instanceof Error ? e.message : String(e), diff: 'Connection handles generation failed' };
	}
}

/* ─── Test 8: Temp edge rendering ─────────────────────────── */

function testTempEdgeRendering(): TestResult {
	const name = 'Temp edge rendering';
	try {
		const connectState: ConnectState = {
		sourceNodeId: 'a',
		sourcePort: { side: 'right', x: 320, y: 150 },
		sourceType: 'depends-on',
		mousePos: { x: 500, y: 200 },
	};
		const sourceLayout = makeLayout('a', 100, 100);

		const path = renderTempEdge(connectState, sourceLayout, defaultDimensions);

		assert(path.tagName === 'path', 'Should return SVGPathElement');
		assertEquals(path.getAttribute('stroke-dasharray'), '5,5', 'stroke-dasharray for temp edge');
		assertEquals(path.getAttribute('class'), 'diagram-temp-edge', 'class name');
		const d = path.getAttribute('d')!;
		assert(d.length > 0, 'd attribute should be non-empty');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVGPathElement with dasharray 5,5 and class diagram-temp-edge', actual: e instanceof Error ? e.message : String(e), diff: 'Temp edge rendering failed' };
	}
}

/* ─── Test 9: Arrow marker defs generation ────────────────── */

function testArrowMarkerDefsGeneration(): TestResult {
	const name = 'Arrow marker defs generation';
	try {
		const edgeTypes: DiagramEdgeTypeConfig[] = [
			makeEdgeConfig('depends-on', '#ff0000', true),
			makeEdgeConfig('extends', '#00ff00', true),
		];

		const defs = renderArrowMarkerDefs(edgeTypes);

		assert(defs.tagName === 'defs', 'Should return SVGDefsElement');
		const markers = defs.querySelectorAll('marker');
		assertEquals(markers.length, 2, '2 arrow markers (one per edge type)');
		assertEquals(markers[0].getAttribute('id'), 'arrow-depends-on', 'First marker id');
		assertEquals(markers[1].getAttribute('id'), 'arrow-extends', 'Second marker id');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVGDefsElement with 2 marker elements', actual: e instanceof Error ? e.message : String(e), diff: 'Arrow marker defs generation failed' };
	}
}

/* ─── Test 10: Arrow marker defs skips non-arrow ──────────── */

function testArrowMarkerDefsSkipsNonArrow(): TestResult {
	const name = 'Arrow marker defs skips non-arrow';
	try {
		const edgeTypes: DiagramEdgeTypeConfig[] = [
			makeEdgeConfig('depends-on', '#ff0000', true),
			makeEdgeConfig('contains', '#0000ff', false),
		];

		const defs = renderArrowMarkerDefs(edgeTypes);

		const markers = defs.querySelectorAll('marker');
		assertEquals(markers.length, 1, 'Only 1 marker (arrowMarker: false skipped)');
		assertEquals(markers[0].getAttribute('id'), 'arrow-depends-on', 'Skip non-arrow type');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: '1 marker (skip arrowMarker: false)', actual: e instanceof Error ? e.message : String(e), diff: 'Arrow marker skip non-arrow failed' };
	}
}

/* ─── Test 11: Apply dimmed state ─────────────────────────── */

function testApplyDimmedState(): TestResult {
	const name = 'Apply dimmed state';
	try {
		const g = createSVGElement('g');
		applyNodeRenderState(g, { dimmed: true, selected: false, highlighted: false });

		assertEquals(g.getAttribute('opacity'), '0.3', 'opacity for dimmed');
		assert(!g.classList.contains('diagram-node-selected'), 'No selected class');
		assert(!g.classList.contains('diagram-node-highlighted'), 'No highlighted class');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'opacity = 0.3, no selected/highlighted classes', actual: e instanceof Error ? e.message : String(e), diff: 'Apply dimmed state failed' };
	}
}

/* ─── Test 12: Apply selected state ───────────────────────── */

function testApplySelectedState(): TestResult {
	const name = 'Apply selected state';
	try {
		const g = createSVGElement('g');
		applyNodeRenderState(g, { dimmed: false, selected: true, highlighted: false });

		assertEquals(g.getAttribute('opacity'), '1', 'opacity for selected');
		assert(g.classList.contains('diagram-node-selected'), 'Has selected class');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'opacity = 1, has diagram-node-selected class', actual: e instanceof Error ? e.message : String(e), diff: 'Apply selected state failed' };
	}
}

/* ─── Test 13: Apply highlighted state ────────────────────── */

function testApplyHighlightedState(): TestResult {
	const name = 'Apply highlighted state';
	try {
		const g = createSVGElement('g');
		applyNodeRenderState(g, { dimmed: false, selected: false, highlighted: true });

		assertEquals(g.getAttribute('opacity'), '1', 'opacity for highlighted');
		assert(g.classList.contains('diagram-node-highlighted'), 'Has highlighted class');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'opacity = 1, has diagram-node-highlighted class', actual: e instanceof Error ? e.message : String(e), diff: 'Apply highlighted state failed' };
	}
}

/* ─── Test 14: SVG element creation ───────────────────────── */

function testSVGElementCreation(): TestResult {
	const name = 'SVG element creation';
	try {
		const rect = createSVGElement('rect', { x: '10', y: '20', width: '100', height: '50', fill: 'red' });

		assert(rect.tagName === 'rect', 'Should create rect element');
		assertEquals(rect.getAttribute('x'), '10', 'x attribute');
		assertEquals(rect.getAttribute('y'), '20', 'y attribute');
		assertEquals(rect.getAttribute('width'), '100', 'width attribute');
		assertEquals(rect.getAttribute('height'), '50', 'height attribute');
		assertEquals(rect.getAttribute('fill'), 'red', 'fill attribute');
		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'SVG rect element with correct attributes', actual: e instanceof Error ? e.message : String(e), diff: 'SVG element creation failed' };
	}
}

/* ─── Test runner ─────────────────────────────────────────── */

export function runDiagramEdgeUtilsTests(): TestResult[] {
	return [
		testEdgePathWithValidLayouts(),
		testEdgePathWithMissingLayout(),
		testEdgePathWithArrowMarker(),
		testEdgePathWithDasharray(),
		testEdgeLabelWithText(),
		testEdgeLabelWithoutText(),
		testConnectionHandlesGeneration(),
		testTempEdgeRendering(),
		testArrowMarkerDefsGeneration(),
		testArrowMarkerDefsSkipsNonArrow(),
		testApplyDimmedState(),
		testApplySelectedState(),
		testApplyHighlightedState(),
		testSVGElementCreation(),
	];
}