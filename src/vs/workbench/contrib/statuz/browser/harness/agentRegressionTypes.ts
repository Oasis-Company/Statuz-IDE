/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * A single test case for agent regression testing.
 *
 * Conforms to ai-regression-testing guard patterns:
 * - Keyword match: expectedKeywords must all appear in the response (case insensitive)
 * - Tool call verification: expectedToolCalls must all be executed
 * - Latency check: actual latency must be under maxLatencyMs
 * - Required sequence: requiredToolSequence must match the actual tool call order
 */
export interface AgentTestCase {
	/** Unique identifier for this test case. */
	readonly id: string;
	/** The prompt to send to the agent. */
	readonly prompt: string;
	/** Keywords that must appear in the response (case insensitive). */
	readonly expectedKeywords?: string[];
	/** Tool names that must be called during the test. */
	readonly expectedToolCalls?: string[];
	/** Maximum allowed latency in milliseconds. */
	readonly maxLatencyMs?: number;
	/** Tool names that must appear in the exact order specified. */
	readonly requiredToolSequence?: string[];
}

/**
 * A collection of test cases targeting a specific agent.
 */
export interface AgentTestSuite {
	/** Unique identifier for this test suite. */
	readonly id: string;
	/** Human-readable name for the suite. */
	readonly name: string;
	/** The agent ID this suite tests. */
	readonly agentId: string;
	/** The test cases in this suite. */
	readonly cases: AgentTestCase[];
	/** Unix ms timestamp of when the suite was created. */
	readonly createdAt: number;
}

/**
 * The result of running a single test case.
 *
 * Conforms to agent-introspection-debugging:
 * Each failed test outputs { expected, actual, diff, rootCause, suggestion }.
 */
export interface AgentTestResult {
	/** The ID of the test case that was run. */
	readonly caseId: string;
	/** Whether the test passed all checks. */
	readonly passed: boolean;
	/** The actual response text from the agent. */
	readonly actualResponse: string;
	/** Performance metrics collected during the test. */
	readonly metrics: {
		/** Total latency in milliseconds. */
		readonly latencyMs: number;
		/** Input tokens consumed. */
		readonly tokensIn: number;
		/** Output tokens generated. */
		readonly tokensOut: number;
	};
	/** Reason for failure, if the test did not pass. */
	readonly failureReason?: string;
	/** Keywords that were expected but missing from the response. */
	readonly missingKeywords?: string[];
	/** Tool calls that were actually executed during the test. */
	readonly toolCallsExecuted?: string[];
	/** Introspection report generated on failure (expected vs actual diff). */
	readonly introspection?: AgentIntrospectionReport;
}

/**
 * Introspection report for a failed test case.
 *
 * Implements agent-introspection-debugging 4-phase loop:
 * Phase 1 — Capture
 * Phase 2 — Diagnose
 * Phase 3 — Recover
 * Phase 4 — Report
 */
export interface AgentIntrospectionReport {
	/** What was expected. */
	readonly expected: {
		readonly keywords?: string[];
		readonly toolCalls?: string[];
		readonly maxLatencyMs?: number;
		readonly requiredToolSequence?: string[];
	};
	/** What was actually observed. */
	readonly actual: {
		readonly response: string;
		readonly toolCalls: string[];
		readonly latencyMs: number;
	};
	/** Human-readable diff describing the discrepancies. */
	readonly diff: string;
	/** Root cause analysis of the failure. */
	readonly rootCause: string;
	/** Suggested action to fix the failure. */
	readonly suggestion: string;
}