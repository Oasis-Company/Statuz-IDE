/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IAgentLLMService, AgentLLMResponse } from './agentLLMService.js';
import { IAgentManagementService } from '../agentManagementService.js';
import { AgentToolCallSimulator } from './agentToolCallSimulator.js';
import { ChatMessageRole } from '../../../../contrib/chat/common/languageModels.js';
import {
	AgentTestCase,
	AgentTestSuite,
	AgentTestResult,
	AgentIntrospectionReport,
} from './agentRegressionTypes.js';

/**
 * Regression test runner for agent validation.
 *
 * Implements all 4 ai-regression-testing guard patterns:
 * 1. Keyword match — case-insensitive check of expectedKeywords in response
 * 2. Tool call verification — verify expectedToolCalls were executed
 * 3. Latency check — verify actual latency is under maxLatencyMs
 * 4. Required sequence — verify tool calls match requiredToolSequence order
 *
 * Implements agent-introspection-debugging:
 * Each failed test outputs { expected, actual, diff, rootCause, suggestion }.
 *
 * Implements agent-harness-construction:
 * runSuite() accepts suite + services, returns deterministic results.
 */
export class AgentRegressionRunner {

	/** Storage keys for persistence. */
	private static readonly SUITES_KEY = 'statuz.agent.regressionSuites';
	private static readonly RESULTS_KEY = 'statuz.agent.regressionResults';

	constructor(
		private readonly llmService: IAgentLLMService,
		agentMgmtService: IAgentManagementService,
		private readonly simulator: AgentToolCallSimulator,
		@IStorageService private readonly storageService: IStorageService,
	) {
		// agentMgmtService reserved for future introspection features
		void agentMgmtService;
	}

	// ─── Suite Execution ────────────────────────────────────────

	/**
	 * Run all test cases in a suite and return the results.
	 *
	 * @param suite The test suite to execute.
	 * @returns An array of results, one per test case.
	 */
	async runSuite(suite: AgentTestSuite): Promise<AgentTestResult[]> {
		const results: AgentTestResult[] = [];

		for (const testCase of suite.cases) {
			const result = await this.runCase(testCase, suite.agentId);
			results.push(result);
			this.saveResult(result, suite.id);
		}

		return results;
	}

	/**
	 * Run a single test case against the specified agent.
	 *
	 * Execution flow:
	 * 1. Send the prompt to the LLM via the agent.
	 * 2. Execute tool calls via the simulator.
	 * 3. Run all 4 guard checks on the response.
	 * 4. Generate introspection report on failure.
	 *
	 * @param testCase The test case to execute.
	 * @param agentId The agent ID to test against.
	 * @returns The test result.
	 */
	async runCase(testCase: AgentTestCase, agentId: string): Promise<AgentTestResult> {
		const startTime = Date.now();
		const toolCallsExecuted: string[] = [];

		try {
			// Step 1: Send prompt to the LLM
			const response = await this.llmService.sendPrompt(
				agentId,
				[{ role: ChatMessageRole.User, content: [{ type: 'text' as const, value: testCase.prompt }] }],
				{
					token: CancellationToken.None,
					timeoutMs: testCase.maxLatencyMs || 30000,
				},
			);

			const latencyMs = response.metrics.totalLatencyMs;

			// Step 2: Execute tool calls via simulator
			for (const tc of response.artifacts.toolCalls) {
				this.simulator.executeToolCall(tc.toolName, tc.input);
				toolCallsExecuted.push(tc.toolName);
			}

			// Step 3: Run all 4 guard checks
			const checks = this.runAllChecks(testCase, response, toolCallsExecuted, latencyMs);

			if (checks.passed) {
				return {
					caseId: testCase.id,
					passed: true,
					actualResponse: response.artifacts.text,
					metrics: {
						latencyMs,
						tokensIn: response.metrics.tokensIn,
						tokensOut: response.metrics.tokensOut,
					},
					toolCallsExecuted,
				};
			}

			// Step 4: Generate introspection report on failure
			const introspection = this.generateIntrospectionReport(
				testCase,
				response.artifacts.text,
				toolCallsExecuted,
				latencyMs,
				checks.failureReason || 'Unknown failure',
				checks.missingKeywords,
			);

			return {
				caseId: testCase.id,
				passed: false,
				actualResponse: response.artifacts.text,
				metrics: {
					latencyMs,
					tokensIn: response.metrics.tokensIn,
					tokensOut: response.metrics.tokensOut,
				},
				failureReason: checks.failureReason,
				missingKeywords: checks.missingKeywords,
				toolCallsExecuted,
				introspection,
			};
		} catch (err) {
			const latencyMs = Date.now() - startTime;
			const errorMessage = err instanceof Error ? err.message : String(err);

			const introspection = this.generateIntrospectionReport(
				testCase,
				`[ERROR] ${errorMessage}`,
				toolCallsExecuted,
				latencyMs,
				`Execution error: ${errorMessage}`,
				testCase.expectedKeywords,
			);

			return {
				caseId: testCase.id,
				passed: false,
				actualResponse: `[ERROR] ${errorMessage}`,
				metrics: {
					latencyMs,
					tokensIn: 0,
					tokensOut: 0,
				},
				failureReason: `Execution error: ${errorMessage}`,
				missingKeywords: testCase.expectedKeywords,
				toolCallsExecuted,
				introspection,
			};
		}
	}

	// ─── Guard Checks ───────────────────────────────────────────

	/**
	 * Run all 4 guard checks and return the combined result.
	 *
	 * Guard 1 (Keyword match): Check expectedKeywords are present (case insensitive).
	 * Guard 2 (Tool call verification): Check expectedToolCalls were executed.
	 * Guard 3 (Latency check): Check actual latency is under maxLatencyMs.
	 * Guard 4 (Required sequence): Check tool call order matches requiredToolSequence.
	 */
	private runAllChecks(
		testCase: AgentTestCase,
		response: AgentLLMResponse,
		toolCallsExecuted: string[],
		latencyMs: number,
	): { passed: boolean; failureReason?: string; missingKeywords?: string[] } {
		const responseText = response.artifacts.text;

		// Guard 1: Keyword match (case insensitive)
		if (testCase.expectedKeywords && testCase.expectedKeywords.length > 0) {
			const missingKeywords = this.checkKeywords(responseText, testCase.expectedKeywords);
			if (missingKeywords.length > 0) {
				return {
					passed: false,
					failureReason: `Missing expected keywords: ${missingKeywords.join(', ')}`,
					missingKeywords,
				};
			}
		}

		// Guard 2: Tool call verification
		if (testCase.expectedToolCalls && testCase.expectedToolCalls.length > 0) {
			const missingToolCalls = this.checkToolCalls(toolCallsExecuted, testCase.expectedToolCalls);
			if (missingToolCalls.length > 0) {
				return {
					passed: false,
					failureReason: `Missing expected tool calls: ${missingToolCalls.join(', ')}`,
				};
			}
		}

		// Guard 3: Latency check
		if (testCase.maxLatencyMs !== undefined && latencyMs > testCase.maxLatencyMs) {
			return {
				passed: false,
				failureReason: `Latency ${latencyMs}ms exceeded max ${testCase.maxLatencyMs}ms`,
			};
		}

		// Guard 4: Required tool call sequence
		if (testCase.requiredToolSequence && testCase.requiredToolSequence.length > 0) {
			if (!this.checkToolSequence(toolCallsExecuted, testCase.requiredToolSequence)) {
				return {
					passed: false,
					failureReason: `Tool call sequence mismatch. Expected: [${testCase.requiredToolSequence.join(', ')}]. Actual: [${toolCallsExecuted.join(', ') || 'none'}]`,
				};
			}
		}

		return { passed: true };
	}

	/**
	 * Guard 1: Check that all expected keywords are present in the response (case insensitive).
	 *
	 * @returns Array of keywords that were NOT found in the response.
	 */
	private checkKeywords(responseText: string, expectedKeywords: string[]): string[] {
		const lowerResponse = responseText.toLowerCase();
		const missing: string[] = [];

		for (const keyword of expectedKeywords) {
			if (!lowerResponse.includes(keyword.toLowerCase())) {
				missing.push(keyword);
			}
		}

		return missing;
	}

	/**
	 * Guard 2: Check that all expected tool calls were executed.
	 *
	 * @returns Array of tool names that were NOT executed.
	 */
	private checkToolCalls(executed: string[], expected: string[]): string[] {
		const missing: string[] = [];

		for (const toolName of expected) {
			if (!executed.includes(toolName)) {
				missing.push(toolName);
			}
		}

		return missing;
	}

	/**
	 * Guard 4: Check that the executed tool calls match the required sequence.
	 *
	 * Uses a subsequence check: the required sequence must appear in order
	 * within the executed tool calls (not necessarily contiguous).
	 *
	 * @returns true if the sequence is satisfied.
	 */
	private checkToolSequence(executed: string[], required: string[]): boolean {
		let reqIdx = 0;

		for (const toolName of executed) {
			if (reqIdx < required.length && toolName === required[reqIdx]) {
				reqIdx++;
			}
		}

		return reqIdx === required.length;
	}

	// ─── Introspection Report ───────────────────────────────────

	/**
	 * Generate a structured introspection report for a failed test case.
	 *
	 * Implements the 4-phase agent-introspection-debugging pattern:
	 * Phase 1 — Capture: gather all expected vs actual context.
	 * Phase 2 — Diagnose: classify root cause.
	 * Phase 3 — Recover: propose recovery action.
	 * Phase 4 — Report: emit structured report.
	 */
	private generateIntrospectionReport(
		testCase: AgentTestCase,
		actualResponse: string,
		toolCallsExecuted: string[],
		latencyMs: number,
		failureReason: string,
		missingKeywords?: string[],
	): AgentIntrospectionReport {
		// Phase 1: Capture — gather all context
		const expected = {
			keywords: testCase.expectedKeywords,
			toolCalls: testCase.expectedToolCalls,
			maxLatencyMs: testCase.maxLatencyMs,
			requiredToolSequence: testCase.requiredToolSequence,
		};

		const actual = {
			response: actualResponse,
			toolCalls: toolCallsExecuted,
			latencyMs,
		};

		// Phase 2: Diagnose — classify root cause
		const rootCause = this.diagnoseRootCause(failureReason, missingKeywords);

		// Phase 3: Recover — propose recovery action
		const suggestion = this.proposeRecoveryAction(failureReason, missingKeywords);

		// Phase 4: Report — build diff
		const diff = this.buildDiff(expected, actual, failureReason, missingKeywords);

		return {
			expected,
			actual,
			diff,
			rootCause,
			suggestion,
		};
	}

	/**
	 * Diagnose the root cause of a test failure.
	 */
	private diagnoseRootCause(failureReason: string, missingKeywords?: string[]): string {
		if (failureReason.startsWith('Execution error:')) {
			return `Agent execution failed with an unhandled error. The agent may be misconfigured or the LLM provider may be unreachable.`;
		}

		if (failureReason.includes('Missing expected keywords')) {
			const kwList = missingKeywords?.join(', ') || 'unknown';
			return `The LLM response did not contain the expected keywords: ${kwList}. The agent's prompt, system instructions, or model behavior may have changed, causing it to omit critical information.`;
		}

		if (failureReason.includes('Missing expected tool calls')) {
			return `The agent did not execute the expected tool calls. The agent's tool configuration or the LLM's tool selection strategy may have changed.`;
		}

		if (failureReason.includes('Latency')) {
			return `The agent's response time exceeded the maximum allowed latency. The LLM provider may be experiencing slowdowns or the prompt complexity may have increased.`;
		}

		if (failureReason.includes('sequence mismatch')) {
			return `The agent executed tool calls in an unexpected order. The agent's tool selection logic or the LLM's reasoning pattern may have changed.`;
		}

		return `Unknown failure: ${failureReason}`;
	}

	/**
	 * Propose a recovery action for a test failure.
	 */
	private proposeRecoveryAction(failureReason: string, missingKeywords?: string[]): string {
		if (failureReason.startsWith('Execution error:')) {
			return `Check the agent configuration, verify the LLM provider is accessible, and ensure the agent definition is valid. Run the agent in sandbox mode to debug.`;
		}

		if (failureReason.includes('Missing expected keywords')) {
			return `Review the agent's system prompt and behavior instructions. Ensure the expected keywords are covered by the agent's response templates. Consider updating the test case if the agent's behavior has intentionally changed.`;
		}

		if (failureReason.includes('Missing expected tool calls')) {
			return `Verify the agent's tool definitions are correctly configured. Check the LLM's tool selection behavior in the sandbox. Update expectedToolCalls if the tool set has changed.`;
		}

		if (failureReason.includes('Latency')) {
			return `Increase maxLatencyMs for this test case, or investigate the LLM provider's performance. Consider using a faster model or reducing prompt complexity.`;
		}

		if (failureReason.includes('sequence mismatch')) {
			return `Review the agent's tool selection logic. The required sequence may need to be updated to match the new behavior, or the agent's tool selection pattern may need to be corrected.`;
		}

		return `Investigate the failure manually. Review the actual response and tool calls to determine the appropriate fix.`;
	}

	/**
	 * Build a human-readable diff of expected vs actual.
	 */
	private buildDiff(
		expected: AgentIntrospectionReport['expected'],
		actual: AgentIntrospectionReport['actual'],
		failureReason: string,
		missingKeywords?: string[],
	): string {
		const lines: string[] = [`FAILURE: ${failureReason}`, ''];

		// Keyword diff
		if (expected.keywords && expected.keywords.length > 0) {
			lines.push('--- Keywords ---');
			lines.push(`  Expected: [${expected.keywords.join(', ')}]`);
			if (missingKeywords && missingKeywords.length > 0) {
				const found = expected.keywords.filter(k => !missingKeywords.includes(k));
				lines.push(`  Found:    [${found.join(', ') || 'none'}]`);
				lines.push(`  Missing:  [${missingKeywords.join(', ')}]`);
			}
			lines.push('');
		}

		// Tool call diff
		if (expected.toolCalls && expected.toolCalls.length > 0) {
			lines.push('--- Tool Calls ---');
			lines.push(`  Expected: [${expected.toolCalls.join(', ')}]`);
			lines.push(`  Actual:   [${actual.toolCalls.join(', ') || 'none'}]`);
			lines.push('');
		}

		// Latency diff
		if (expected.maxLatencyMs !== undefined) {
			lines.push('--- Latency ---');
			lines.push(`  Max:      ${expected.maxLatencyMs}ms`);
			lines.push(`  Actual:   ${actual.latencyMs}ms`);
			lines.push('');
		}

		// Sequence diff
		if (expected.requiredToolSequence && expected.requiredToolSequence.length > 0) {
			lines.push('--- Tool Sequence ---');
			lines.push(`  Expected: [${expected.requiredToolSequence.join(', ')}]`);
			lines.push(`  Actual:   [${actual.toolCalls.join(', ') || 'none'}]`);
			lines.push('');
		}

		// Actual response snippet
		lines.push('--- Response (first 500 chars) ---');
		lines.push(actual.response.slice(0, 500));

		return lines.join('\n');
	}

	// ─── Persistence ────────────────────────────────────────────

	/**
	 * Save a test suite to persistent storage.
	 */
	saveSuite(suite: AgentTestSuite): void {
		const suites = this.loadSuites();
		const existingIdx = suites.findIndex(s => s.id === suite.id);
		if (existingIdx >= 0) {
			suites[existingIdx] = suite;
		} else {
			suites.push(suite);
		}
		this.storageService.store(
			AgentRegressionRunner.SUITES_KEY,
			JSON.stringify(suites),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
	}

	/**
	 * Load all test suites from persistent storage.
	 */
	loadSuites(): AgentTestSuite[] {
		const raw = this.storageService.get(AgentRegressionRunner.SUITES_KEY, StorageScope.PROFILE);
		if (!raw) {
			return [];
		}
		try {
			return JSON.parse(raw) as AgentTestSuite[];
		} catch {
			return [];
		}
	}

	/**
	 * Delete a test suite from persistent storage.
	 */
	deleteSuite(suiteId: string): void {
		const suites = this.loadSuites().filter(s => s.id !== suiteId);
		this.storageService.store(
			AgentRegressionRunner.SUITES_KEY,
			JSON.stringify(suites),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
		// Also clean up results for this suite
		this.deleteResults(suiteId);
	}

	/**
	 * Save a test result to persistent storage.
	 */
	saveResult(result: AgentTestResult, suiteId: string): void {
		const allResults = this.loadAllResults();
		const suiteResults = allResults[suiteId] || [];
		const existingIdx = suiteResults.findIndex(r => r.caseId === result.caseId);
		if (existingIdx >= 0) {
			suiteResults[existingIdx] = result;
		} else {
			suiteResults.push(result);
		}
		allResults[suiteId] = suiteResults;
		this.storageService.store(
			AgentRegressionRunner.RESULTS_KEY,
			JSON.stringify(allResults),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
	}

	/**
	 * Load test results for a specific suite.
	 */
	loadResults(suiteId: string): AgentTestResult[] {
		const allResults = this.loadAllResults();
		return allResults[suiteId] || [];
	}

	/**
	 * Load all test results from persistent storage.
	 */
	private loadAllResults(): Record<string, AgentTestResult[]> {
		const raw = this.storageService.get(AgentRegressionRunner.RESULTS_KEY, StorageScope.PROFILE);
		if (!raw) {
			return {};
		}
		try {
			return JSON.parse(raw) as Record<string, AgentTestResult[]>;
		} catch {
			return {};
		}
	}

	/**
	 * Delete all test results for a specific suite.
	 */
	private deleteResults(suiteId: string): void {
		const allResults = this.loadAllResults();
		delete allResults[suiteId];
		this.storageService.store(
			AgentRegressionRunner.RESULTS_KEY,
			JSON.stringify(allResults),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
	}
}