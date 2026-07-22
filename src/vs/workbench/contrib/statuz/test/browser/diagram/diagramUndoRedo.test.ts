/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Phase 3: DiagramUndoRedo Tests — snapshot-based undo/redo
 *  ai-regression-testing: regression pattern 4 — missing rollback
 *  agent-introspection-debugging: expected/actual/diff on failure
 *--------------------------------------------------------------------------------------------*/

import { DiagramUndoRedo } from '../../../browser/diagram/diagramUndoRedo.js';
import type { DiagramSnapshot } from '../../../browser/diagram/diagramTypes.js';

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

function makeSnapshot(id: string, x: number, y: number): DiagramSnapshot {
	return {
		layouts: [{ id, type: 'card', position: { x, y } }],
		edges: [],
		viewport: { x: 0, y: 0, zoom: 1 },
	};
}

/* ─── Test 1: Undo restores previous snapshot ────────────── */

function testUndoRestores(): TestResult {
	const name = 'Undo restores previous snapshot';

	try {
		const undoRedo = new DiagramUndoRedo(50);

		undoRedo.pushSnapshot(makeSnapshot('n1', 100, 200));
		undoRedo.pushSnapshot(makeSnapshot('n1', 300, 400));

		const current = makeSnapshot('n1', 500, 600);
		const restored = undoRedo.undo(current);

		assert(restored !== null, 'Undo returns snapshot');
		assertEquals(restored!.layouts[0].position.x, 300, 'Position X restored to previous');
		assertEquals(restored!.layouts[0].position.y, 400, 'Position Y restored to previous');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Undo restores previous snapshot', actual: (e as Error).message, diff: 'Undo failure' };
	}
}

/* ─── Test 2: Redo restores undone snapshot ──────────────── */

function testRedoRestores(): TestResult {
	const name = 'Redo restores undone snapshot';

	try {
		const undoRedo = new DiagramUndoRedo(50);

		undoRedo.pushSnapshot(makeSnapshot('n1', 100, 200));
		undoRedo.pushSnapshot(makeSnapshot('n1', 300, 400));

		const current = makeSnapshot('n1', 500, 600);
		undoRedo.undo(current);

		const current2 = makeSnapshot('n1', 300, 400);
		const restored = undoRedo.redo(current2);

		assert(restored !== null, 'Redo returns snapshot');
		assertEquals(restored!.layouts[0].position.x, 500, 'Position X restored after redo');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Redo restores undone snapshot', actual: (e as Error).message, diff: 'Redo failure' };
	}
}

/* ─── Test 3: Max steps truncation ───────────────────────── */

function testMaxStepsTruncation(): TestResult {
	const name = 'Max steps truncation';

	try {
		const undoRedo = new DiagramUndoRedo(3);

		for (let i = 0; i < 5; i++) {
			undoRedo.pushSnapshot(makeSnapshot(`n${i}`, i * 100, i * 100));
		}

		// Should have at most 3 snapshots
		let count = 0;
		while (undoRedo.canUndo()) {
			const result = undoRedo.undo();
			if (result) { count++; }
		}

		assert(count <= 3, `Max 3 undo steps, got ${count}`);
		assert(!undoRedo.canUndo(), 'Cannot undo beyond limit');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Max 3 undo steps', actual: (e as Error).message, diff: 'Truncation failure' };
	}
}

/* ─── Test 4: State change callback ──────────────────────── */

function testStateChangeCallback(): TestResult {
	const name = 'State change callback';

	try {
		const undoRedo = new DiagramUndoRedo(50);
		let canUndo = false;
		let canRedo = false;

		undoRedo.setOnStateChange((u: boolean, r: boolean) => { canUndo = u; canRedo = r; });

		assert(!canUndo, 'Initially cannot undo');
		assert(!canRedo, 'Initially cannot redo');

		undoRedo.pushSnapshot(makeSnapshot('n1', 100, 200));
		assert(canUndo, 'Can undo after push');
		assert(!canRedo, 'Cannot redo after push');

		return { name, passed: true };
	} catch (e) {
		return { name, passed: false, expected: 'Callback fires on state change', actual: (e as Error).message, diff: 'Callback failure' };
	}
}

/* ─── Runner ──────────────────────────────────────────────── */

export function runDiagramUndoRedoTests(): TestResult[] {
	return [
		testUndoRestores(),
		testRedoRestores(),
		testMaxStepsTruncation(),
		testStateChangeCallback(),
	];
}