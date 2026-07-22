/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Phase 3: Diagram Test Runner — jsdom + dynamic import
 *
 *  Usage: npx tsx src/vs/workbench/contrib/statuz/test/browser/diagram/run.ts
 *
 *  ai-regression-testing: sandbox-mode testing (jsdom, no real browser)
 *  agent-introspection-debugging: expected/actual/diff on failure
 *--------------------------------------------------------------------------------------------*/

import { JSDOM } from 'jsdom';

/* ─── JSDOM Setup ─────────────────────────────────────────── */

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost',
	pretendToBeVisual: true,
	storageQuota: 10000000,
});

(globalThis as any).document = dom.window.document;
(globalThis as any).window = dom.window;
(globalThis as any).localStorage = dom.window.localStorage;
(globalThis as any).SVGElement = (dom.window as any).SVGElement;
(globalThis as any).HTMLElement = (dom.window as any).HTMLElement;
(globalThis as any).MouseEvent = (dom.window as any).MouseEvent;
(globalThis as any).KeyboardEvent = (dom.window as any).KeyboardEvent;
(globalThis as any).WheelEvent = (dom.window as any).WheelEvent;

/* ─── Types ───────────────────────────────────────────────── */

interface TestResult {
	name: string;
	passed: boolean;
	expected?: string;
	actual?: string;
	diff?: string;
}

interface TestModule {
	name: string;
	importPath: string;
	runnerFn: string;
}

/* ─── Test Registry ───────────────────────────────────────── */

const TEST_MODULES: TestModule[] = [
	{ name: 'DiagramStateManager', importPath: './diagramStateManager.test.js', runnerFn: 'runDiagramStateManagerTests' },
	{ name: 'DiagramUndoRedo', importPath: './diagramUndoRedo.test.js', runnerFn: 'runDiagramUndoRedoTests' },
	{ name: 'DiagramNodeRegistry', importPath: './diagramNodeRegistry.test.js', runnerFn: 'runDiagramNodeRegistryTests' },
	{ name: 'DiagramPortUtils', importPath: './diagramPortUtils.test.js', runnerFn: 'runDiagramPortUtilsTests' },
	{ name: 'DiagramEdgeUtils', importPath: './diagramEdgeUtils.test.js', runnerFn: 'runDiagramEdgeUtilsTests' },
	{ name: 'DiagramLayoutEngine', importPath: './diagramLayoutEngine.test.js', runnerFn: 'runDiagramLayoutEngineTests' },
	{ name: 'ArchitectureDiagramEngine', importPath: './architectureDiagramEngine.test.js', runnerFn: 'runArchitectureDiagramEngineTests' },
	{ name: 'PipelineMode', importPath: './pipelineMode.test.js', runnerFn: 'runPipelineModeTests' },
	{ name: 'ContextMenu', importPath: './contextMenu.test.js', runnerFn: 'runContextMenuTests' },
];

/* ─── Runner ──────────────────────────────────────────────── */

async function main(): Promise<void> {
	console.log('\n╔══════════════════════════════════════════════╗');
	console.log('║   Phase 3: Diagram Module Test Suite         ║');
	console.log('╚══════════════════════════════════════════════╝\n');

	let totalPassed = 0;
	let totalFailed = 0;
	const failures: { module: string; test: string; reason: string }[] = [];

	for (const mod of TEST_MODULES) {
		process.stdout.write(`  ${mod.name}... `);
		// Clear localStorage between modules to prevent cross-contamination
		localStorage.clear();
		try {
			// dynamic import with .js extension — tsx resolves to .ts
			const module = await import(mod.importPath);
			const runner = module[mod.runnerFn] as (() => TestResult[]);

			if (typeof runner !== 'function') {
				console.log('SKIP (no runner function)');
				continue;
			}

			const results = runner();
			const passed = results.filter(r => r.passed);
			const failed = results.filter(r => !r.passed);

			totalPassed += passed.length;
			totalFailed += failed.length;

			if (failed.length === 0) {
				console.log(`✓ ${passed.length}/${results.length} passed`);
			} else {
				console.log(`✗ ${failed.length} failed, ${passed.length} passed`);
				for (const f of failed) {
					console.log(`      FAIL: ${f.name}`);
					if (f.expected) { console.log(`        Expected: ${f.expected}`); }
					if (f.actual) { console.log(`        Actual:   ${f.actual}`); }
					if (f.diff) { console.log(`        Diff:     ${f.diff}`); }
					failures.push({ module: mod.name, test: f.name, reason: f.actual || f.diff || 'unknown' });
				}
			}
		} catch (err) {
			console.log(`✗ MODULE ERROR`);
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`      ${msg}`);
			failures.push({ module: mod.name, test: '(module load)', reason: msg });
			totalFailed++;
		}
	}

	/* ─── Summary ──────────────────────────────────────── */

	console.log('\n──────────────────────────────────────────────────');
	console.log(`  TOTAL: ${totalPassed + totalFailed} tests`);
	console.log(`  PASSED: ${totalPassed}`);
	console.log(`  FAILED: ${totalFailed}`);
	console.log('──────────────────────────────────────────────────\n');

	if (totalFailed > 0) {
		console.log('FAILURES:');
		for (const f of failures) {
			console.log(`  [${f.module}] ${f.test}`);
			console.log(`    ${f.reason}\n`);
		}
		process.exit(1);
	} else {
		console.log('All tests passed!\n');
		process.exit(0);
	}
}

main().catch(err => {
	console.error('Test runner crashed:', err);
	process.exit(2);
});