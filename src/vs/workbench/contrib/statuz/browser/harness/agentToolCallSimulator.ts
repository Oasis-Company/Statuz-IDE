/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Structured definition of a tool that can be called by the agent.
 * Conforms to agent-harness-construction: stable tool names, narrow input schema,
 * deterministic output shapes.
 */
export interface ToolDefinition {
	/** Unique, stable name of the tool (e.g. "read_file", "search_code"). */
	name: string;
	/** Human-readable description of what the tool does. */
	description: string;
	/** JSON Schema describing the expected input shape. */
	inputSchema: Record<string, unknown>;
}

/**
 * A single round of tool calling with its result.
 * Each card shows { round, toolName, input, output, durationMs, status }.
 */
export interface ToolCallRound {
	/** The round number within the tool-calling loop (1-based). */
	round: number;
	/** The name of the tool that was called. */
	toolName: string;
	/** The input arguments passed to the tool. */
	input: Record<string, unknown>;
	/** The output from the tool execution. */
	output: string;
	/** How long the tool execution took in milliseconds. */
	durationMs: number;
	/** Whether the tool call succeeded or failed. */
	status: 'success' | 'error';
}

/**
 * Simulates agent tool calling in a sandbox environment.
 *
 * Layer 6 (tool selection): tools are code-gated via registered handlers,
 * not just prompt text. Each handler is a deterministic function mapping
 * input to output.
 *
 * Layer 7 (tool execution): executeToolCall provides a deterministic
 * execution path with timing measurement.
 *
 * Layer 8 (tool interpretation): results are structured as strings that
 * are injected into message history as IChatMessageToolResultPart, not
 * raw text.
 *
 * Implements ai-regression-testing sandbox/production path matching:
 * mock tools must match the shape of real tool signatures.
 */
export class AgentToolCallSimulator {

	/**
	 * Registry of mock tool handlers keyed by tool name.
	 * Each handler is a pure-ish function: (input) => output string.
	 */
	private readonly mockTools: Map<string, (input: Record<string, unknown>) => string>;

	constructor() {
		this.mockTools = new Map();
		this.registerBuiltInTools();
	}

	/**
	 * Register the 5 built-in mock tools that mirror common agent tool patterns.
	 *
	 * Tool definitions (agent-harness-construction):
	 * - read_file:   reads file contents from a given path
	 * - search_code: searches code in workspace for a query string
	 * - list_files:  lists files in a directory path
	 * - get_current_time: returns current ISO timestamp
	 * - calculate:   evaluates a mathematical expression
	 */
	private registerBuiltInTools(): void {
		// read_file: mimics file system access
		this.registerTool('read_file', (input: Record<string, unknown>) =>
			`[Mock] Contents of ${input.path}:\n// File content mock...`
		);

		// search_code: mimics code search in workspace
		this.registerTool('search_code', (input: Record<string, unknown>) =>
			`[Mock] Found 3 results for "${input.query}" in ${input.path || 'workspace'}...`
		);

		// list_files: mimics directory listing
		this.registerTool('list_files', (input: Record<string, unknown>) =>
			`[Mock] ${input.path || '.'}/:\n  file1.ts\n  file2.ts\n  package.json`
		);

		// get_current_time: returns real ISO timestamp (purely informational)
		this.registerTool('get_current_time', () =>
			new Date().toISOString()
		);

		// calculate: evaluates mathematical expressions with error handling
		this.registerTool('calculate', (input: Record<string, unknown>) => {
			try {
				const expression = String(input.expression);
				return String(eval(expression));
			} catch (e) {
				return `Error: Invalid expression — ${e instanceof Error ? e.message : String(e)}`;
			}
		});
	}

	/**
	 * Register a new mock tool handler.
	 *
	 * @param name    Stable tool name (must match what the LLM emits).
	 * @param handler Function that takes input and returns an output string.
	 */
	registerTool(name: string, handler: (input: Record<string, unknown>) => string): void {
		this.mockTools.set(name, handler);
	}

	/**
	 * Execute a tool call and return the result with timing.
	 *
	 * Layer 7 (tool execution): deterministic execution path.
	 * If the tool is not registered, returns an error string.
	 *
	 * @param toolName The name of the tool to execute.
	 * @param input    The input arguments for the tool.
	 * @returns An object with the result string and execution duration in ms.
	 */
	executeToolCall(toolName: string, input: Record<string, unknown>): { result: string; durationMs: number } {
		const startTime = Date.now();
		const handler = this.mockTools.get(toolName);

		if (!handler) {
			return {
				result: `Error: Unknown tool "${toolName}". Available tools: ${[...this.mockTools.keys()].join(', ')}`,
				durationMs: Date.now() - startTime,
			};
		}

		const result = handler(input);
		return {
			result,
			durationMs: Date.now() - startTime,
		};
	}
}