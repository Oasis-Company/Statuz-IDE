/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { ILanguageModelsService, IChatMessage, IChatResponseTextPart, IChatResponseToolUsePart } from '../../../chat/common/languageModels.js';
import { AgentRequestRetry } from './agentRequestRetry.js';

// ─── Response types (harness-construction: observation design) ───

export interface IToolCallRecord {
	toolName: string;
	input: Record<string, unknown>;
	output?: string;
	error?: string;
	durationMs: number;
}

export interface AgentLLMResponse {
	status: 'success' | 'error';
	summary: string;
	artifacts: { text: string; toolCalls: IToolCallRecord[] };
	metrics: { ttftMs: number; totalLatencyMs: number; tokensIn: number; tokensOut: number };
	next_actions: string[];
}

// ─── Error types (harness-construction: error recovery contract) ───

export class AgentLLMError extends Error {
	constructor(
		message: string,
		readonly category: 'network' | 'timeout' | 'rate_limit' | 'content_filter' | 'off_topic' | 'unknown' | 'quota' | 'not_found' | 'permission',
		readonly retryable: boolean,
		readonly originalError?: Error,
	) {
		super(message);
		this.name = 'AgentLLMError';
	}
}

/**
 * Retry event payload emitted when a retry attempt is made.
 * Includes root_cause_hint, safe_retry_instruction, and explicit_stop_condition
 * as required by the agent-harness-construction error recovery contract.
 */
export interface RetryEvent {
	attempt: number;
	maxRetries: number;
	category: string;
	message: string;
	delayMs: number;
	rootCauseHint: string;
	safeRetryInstruction: string;
	explicitStopCondition: string;
}

export interface IntrospectionReport {
	failure: string;
	rootCause: string;
	recoveryAction: string;
	result: 'success' | 'partial' | 'blocked';
	tokenBurnRisk?: string;
	followUpNeeded?: string;
}

// ─── Service Interface ───

export const IAgentLLMService = createDecorator<IAgentLLMService>('agentLLMService');

export interface IAgentLLMService {
	readonly _serviceBrand: undefined;
	readonly onRetry: Event<RetryEvent>;
	selectModel(agentConfig: Record<string, unknown>): Promise<string>;
	sendPrompt(identifier: string, messages: IChatMessage[], options: {
		tools?: { name: string; description: string; inputSchema?: object }[];
		timeoutMs?: number;
		token: CancellationToken;
	}): Promise<AgentLLMResponse>;
	countTokens(text: string, identifier: string): Promise<number>;
	classifyError(error: Error): AgentLLMError;
	logIntrospectionReport(report: IntrospectionReport): void;
}

// ─── Service ───

export class AgentLLMService extends Disposable implements IAgentLLMService {

	readonly _serviceBrand: undefined;

	private static readonly STATUZ_EXTENSION_ID = new ExtensionIdentifier('statuz.statuz-ide');

	private readonly _onRetry = this._register(new Emitter<RetryEvent>());
	readonly onRetry = this._onRetry.event;

	private readonly retryEngine: AgentRequestRetry;

	constructor(
		@ILanguageModelsService private readonly lmService: ILanguageModelsService,
	) {
		super();
		this.retryEngine = new AgentRequestRetry();
	}

	/**
	 * Select a language model based on agent configuration.
	 * Falls back to first available model if no config specified.
	 */
	async selectModel(agentConfig: Record<string, unknown>): Promise<string> {
		const vendor = agentConfig['modelVendor'] as string | undefined;
		const family = agentConfig['modelFamily'] as string | undefined;

		const selector: { vendor?: string; family?: string } = {};
		if (vendor) { selector.vendor = vendor; }
		if (family) { selector.family = family; }

		const models = await this.lmService.selectLanguageModels(selector);

		if (models.length > 0) {
			return models[0];
		}

		// Fallback: try all available models
		const allModels = await this.lmService.selectLanguageModels({});
		if (allModels.length === 0) {
			throw new AgentLLMError('No language models available', 'unknown', false);
		}
		return allModels[0];
	}

	/**
	 * Send a prompt to the LLM and return a structured response.
	 * Implements streaming with metrics collection, automatic retry via AgentRequestRetry,
	 * and fallback model selection on rate_limit/timeout exhaustion.
	 */
	async sendPrompt(
		identifier: string,
		messages: IChatMessage[],
		options: {
			tools?: { name: string; description: string; inputSchema?: object }[];
			timeoutMs?: number;
			token: CancellationToken;
		},
	): Promise<AgentLLMResponse> {
		let currentModelId = identifier;
		let finalError: Error | undefined;

		// Try primary model with retry, then fallback model
		for (let modelAttempt = 0; modelAttempt < 2; modelAttempt++) {
			try {
				const result = await this.retryEngine.execute(
					() => this.sendPromptWithModel(currentModelId, messages, options),
					options.token,
					(err) => this.classifyErrorCategory(err),
				);
				return result;
			} catch (err) {
				finalError = err instanceof Error ? err : new Error(String(err));
				const category = this.classifyErrorCategory(finalError);

				// If rate_limit or timeout, try fallback model
				if (modelAttempt === 0 && (category === 'rate_limit' || category === 'timeout')) {
					const fallbackModel = await this.selectFallbackModel(currentModelId);
					if (fallbackModel) {
						console.warn(`[AgentLLMService] Primary model "${currentModelId}" failed with ${category}. Falling back to "${fallbackModel}".`);
						currentModelId = fallbackModel;
						continue;
					}
				}

				// Retry exhausted or non-retryable — run introspection
				this.runIntrospectionLoop(finalError, category, currentModelId);
				throw finalError;
			}
		}

		// Should never reach here, but satisfy TypeScript
		throw finalError ?? new Error('All model attempts exhausted');
	}

	/**
	 * Core send prompt logic (extracted for retry wrapping).
	 * This is the actual LLM call that gets retried.
	 */
	private async sendPromptWithModel(
		identifier: string,
		messages: IChatMessage[],
		options: {
			tools?: { name: string; description: string; inputSchema?: object }[];
			timeoutMs?: number;
			token: CancellationToken;
		},
	): Promise<AgentLLMResponse> {
		const startTime = Date.now();
		let ttftMs = 0;
		let firstToken = true;
		const textParts: string[] = [];
		const toolCalls: IToolCallRecord[] = [];
		let tokensIn = 0;
		let tokensOut = 0;

		// Estimate input tokens
		try {
			for (const msg of messages) {
				const contentStr = typeof msg.content === 'string'
					? msg.content
					: JSON.stringify(msg.content);
				tokensIn += await this.lmService.computeTokenLength(identifier, contentStr, options.token);
			}
		} catch {
			// Token counting is best-effort
			tokensIn = 0;
		}

		const requestOptions: Record<string, unknown> = {};
		if (options.tools && options.tools.length > 0) {
			requestOptions['tools'] = options.tools;
		}
		if (options.timeoutMs) {
			requestOptions['timeoutMs'] = options.timeoutMs;
		}

		const response = await this.lmService.sendChatRequest(
			identifier,
			AgentLLMService.STATUZ_EXTENSION_ID,
			messages,
			requestOptions,
			options.token,
		);

		for await (const fragment of response.stream) {
			if (firstToken) {
				ttftMs = Date.now() - startTime;
				firstToken = false;
			}

			if (fragment.part.type === 'text') {
				const textPart = fragment.part as IChatResponseTextPart;
				textParts.push(textPart.value);
				tokensOut++; // Approximate: 1 token per fragment
			} else if (fragment.part.type === 'tool_use') {
				const toolPart = fragment.part as IChatResponseToolUsePart;
				toolCalls.push({
					toolName: toolPart.name,
					input: toolPart.parameters as Record<string, unknown>,
					durationMs: 0,
				});
			}
		}

		const totalLatencyMs = Date.now() - startTime;
		const fullText = textParts.join('');

		// Estimate output tokens more accurately
		try {
			tokensOut = await this.lmService.computeTokenLength(identifier, fullText, options.token);
		} catch {
			// Fallback to approximate
			tokensOut = tokensOut || Math.ceil(fullText.length / 4);
		}

		return {
			status: 'success',
			summary: `Response received in ${totalLatencyMs}ms (TTFT: ${ttftMs}ms)`,
			artifacts: { text: fullText, toolCalls },
			metrics: { ttftMs, totalLatencyMs, tokensIn, tokensOut },
			next_actions: toolCalls.length > 0
				? toolCalls.map(tc => `Tool "${tc.toolName}" was called`)
				: ['Response complete'],
		};
	}

	/**
	 * Count tokens in a text string.
	 */
	async countTokens(text: string, identifier: string): Promise<number> {
		return this.lmService.computeTokenLength(identifier, text, CancellationToken.None);
	}

	/**
	 * Classify an error into a structured AgentLLMError.
	 *
	 * Priority-ordered classification (agent-harness-construction: error recovery contract).
	 * Each category maps to: root_cause_hint, safe_retry_instruction, explicit_stop_condition.
	 */
	classifyError(error: Error): AgentLLMError {
		const message = error.message || 'Unknown error';
		const code = (error as { code?: string }).code || '';
		const statusCode = (error as { statusCode?: number }).statusCode || 0;

		// ── Priority 1: Network errors (retryable) ──
		// ECONNREFUSED, ENOTFOUND, fetch failed
		// root_cause_hint: "Connection refused or DNS resolution failure"
		// safe_retry_instruction: "Retry with exponential backoff — network may recover"
		// explicit_stop_condition: "Stop after maxRetries attempts or if cancellation requested"
		if (
			message.includes('ECONNREFUSED') ||
			message.includes('ENOTFOUND') ||
			message.includes('fetch failed') ||
			message.includes('ECONNRESET') ||
			message.includes('ETIMEDOUT') ||
			code === 'ECONNREFUSED' ||
			code === 'ENOTFOUND' ||
			code === 'ECONNRESET'
		) {
			return new AgentLLMError(message, 'network', true, error);
		}

		// ── Priority 2: Timeout errors (retryable) ──
		// timeout, ETIMEDOUT, timed out
		// root_cause_hint: "Request exceeded time limit"
		// safe_retry_instruction: "Increase timeoutMs or retry with backoff"
		// explicit_stop_condition: "Stop after maxRetries or if upstream consistently slow"
		if (
			message.includes('timeout') ||
			message.includes('ETIMEDOUT') ||
			message.includes('timed out') ||
			code === 'ETIMEDOUT'
		) {
			return new AgentLLMError(message, 'timeout', true, error);
		}

		// ── Priority 3: Rate limit errors (retryable) ──
		// 429, rate limit, rate_limit
		// root_cause_hint: "Rate limit exceeded — too many requests"
		// safe_retry_instruction: "Wait for backoff window, reduce request frequency"
		// explicit_stop_condition: "Stop after maxRetries; try fallback model if available"
		if (
			statusCode === 429 ||
			message.includes('429') ||
			message.includes('rate limit') ||
			message.includes('rate_limit') ||
			message.includes('too many requests') ||
			message.includes('RateLimitError')
		) {
			return new AgentLLMError(message, 'rate_limit', true, error);
		}

		// ── Priority 4: Quota/Billing errors (not retryable) ──
		// quota exceeded, billing issue
		// root_cause_hint: "Account quota or billing limit reached"
		// safe_retry_instruction: "Do not retry — requires manual intervention"
		// explicit_stop_condition: "Immediate stop; notify user to check billing"
		if (
			message.includes('quota') ||
			message.includes('billing') ||
			message.includes('insufficient_quota') ||
			message.includes('payment required') ||
			code === 'QuotaExceeded' ||
			code === 'BillingError'
		) {
			return new AgentLLMError(message, 'quota', false, error);
		}

		// ── Priority 5: Content filter / Safety errors (not retryable) ──
		// content filter, safety, blocked
		// root_cause_hint: "Content flagged by safety filter"
		// safe_retry_instruction: "Do not retry — modify prompt content"
		// explicit_stop_condition: "Immediate stop; review prompt for policy violations"
		if (
			message.includes('content filter') ||
			message.includes('safety') ||
			message.includes('blocked') ||
			message.includes('content_filter') ||
			message.includes('ContentFilter') ||
			message.includes('filtered') ||
			code === 'Blocked' ||
			code === 'ContentFilter'
		) {
			return new AgentLLMError(message, 'content_filter', false, error);
		}

		// ── Priority 6: Not Found errors (not retryable) ──
		// NotFound, 404, model_not_found
		// root_cause_hint: "Requested model or resource does not exist"
		// safe_retry_instruction: "Do not retry — verify model identifier"
		// explicit_stop_condition: "Immediate stop; check model availability"
		if (
			code === 'NotFound' ||
			statusCode === 404 ||
			message.includes('NotFound') ||
			message.includes('404') ||
			message.includes('model_not_found') ||
			message.includes('not found') ||
			message.includes('does not exist')
		) {
			return new AgentLLMError(message, 'not_found', false, error);
		}

		// ── Priority 7: Permission / Auth errors (not retryable) ──
		// NoPermissions, 403, unauthorized
		// root_cause_hint: "Authentication or authorization failure"
		// safe_retry_instruction: "Do not retry — check credentials and permissions"
		// explicit_stop_condition: "Immediate stop; verify API key and access rights"
		if (
			code === 'NoPermissions' ||
			statusCode === 403 ||
			statusCode === 401 ||
			message.includes('NoPermissions') ||
			message.includes('403') ||
			message.includes('401') ||
			message.includes('unauthorized') ||
			message.includes('forbidden') ||
			message.includes('permission denied') ||
			message.includes('access denied') ||
			message.includes('authentication')
		) {
			return new AgentLLMError(message, 'permission', false, error);
		}

		// ── Priority 8: Fallback — unknown (not retryable, conservative) ──
		// root_cause_hint: "Unclassified error — unknown failure mode"
		// safe_retry_instruction: "Do not retry — unknown errors are conservatively non-retryable"
		// explicit_stop_condition: "Immediate stop; manual investigation required"
		return new AgentLLMError(message, 'unknown', false, error);
	}

	/**
	 * Classify an error into a category string for the retry engine.
	 * Returns the category string matching RetryConfig.retryableErrors.
	 */
	private classifyErrorCategory(error: Error): string {
		const classified = this.classifyError(error);
		return classified.category;
	}

	/**
	 * Log an introspection report for debugging.
	 */
	logIntrospectionReport(report: IntrospectionReport): void {
		console.log('[AgentLLMService] Introspection Report:', JSON.stringify(report, null, 2));
	}

	/**
	 * Select a fallback model when the primary model fails.
	 */
	async selectFallbackModel(primaryModelId: string): Promise<string | null> {
		const allModels = await this.lmService.selectLanguageModels({});
		const fallback = allModels.find(m => m !== primaryModelId);
		return fallback || null;
	}

	/**
	 * Run the 4-phase introspection loop on retry exhaustion.
	 *
	 * Phase 1 — Capture: gather all error context (message, category, model, stack).
	 * Phase 2 — Diagnose: classify root cause and determine token burn risk.
	 * Phase 3 — Recover: propose recovery action (fallback, manual intervention, or abort).
	 * Phase 4 — Report: emit structured IntrospectionReport for logging and observability.
	 *
	 * This implements the agent-introspection-debugging 4-phase loop pattern.
	 */
	private runIntrospectionLoop(error: Error, category: string, modelId: string): void {
		// Phase 1: Capture — gather all error context
		const capturedError = {
			message: error.message,
			category,
			modelId,
			stack: error.stack?.slice(0, 500) || 'no stack',
			timestamp: new Date().toISOString(),
		};

		// Phase 2: Diagnose — classify root cause and determine token burn risk
		const rootCause = this.diagnoseRootCause(category, error.message);
		const tokenBurnRisk = this.assessTokenBurnRisk(category);

		// Phase 3: Recover — propose recovery action
		const recoveryAction = this.determineRecoveryAction(category);
		const result = this.determineResult(category);

		// Phase 4: Report — emit structured IntrospectionReport
		const report: IntrospectionReport = {
			failure: `[${capturedError.category}] ${capturedError.message}`,
			rootCause,
			recoveryAction,
			result,
			tokenBurnRisk,
			followUpNeeded: result === 'blocked' ? 'Manual intervention required — check model availability and credentials' : undefined,
		};

		this.logIntrospectionReport(report);
	}

	/**
	 * Diagnose the root cause based on error category.
	 */
	private diagnoseRootCause(category: string, message: string): string {
		switch (category) {
			case 'network':
				return 'Network connectivity failure — DNS, connection refused, or fetch infrastructure error';
			case 'timeout':
				return 'Request exceeded configured timeout — upstream LLM provider may be slow or unresponsive';
			case 'rate_limit':
				return 'Rate limit exceeded — too many requests in a short window or quota-based throttling';
			case 'quota':
				return 'Account quota exhausted — billing limit reached or insufficient credits';
			case 'content_filter':
				return 'Content flagged by safety filter — prompt may contain policy-violating content';
			case 'not_found':
				return 'Model or resource not found — verify model identifier and availability';
			case 'permission':
				return 'Authentication or authorization failure — verify API key and access permissions';
			default:
				return `Unclassified error: ${message}`;
		}
	}

	/**
	 * Assess the token burn risk for repeated retries.
	 */
	private assessTokenBurnRisk(category: string): string {
		switch (category) {
			case 'rate_limit':
				return 'HIGH — retry with backoff consumes tokens without progress; consider fallback model';
			case 'timeout':
				return 'MEDIUM — partial tokens may be consumed on each attempt; monitor token usage';
			case 'network':
				return 'LOW — network errors typically do not consume tokens';
			case 'quota':
			case 'content_filter':
			case 'not_found':
			case 'permission':
				return 'NONE — error is non-retryable; no token burn from further retries';
			default:
				return 'UNKNOWN — token consumption unclear; recommend manual review';
		}
	}

	/**
	 * Determine the recovery action based on error category.
	 */
	private determineRecoveryAction(category: string): string {
		switch (category) {
			case 'network':
				return 'Check network connectivity and DNS resolution. Verify upstream LLM endpoint is reachable.';
			case 'timeout':
				return 'Increase timeoutMs configuration or reduce prompt complexity. Consider fallback to a faster model.';
			case 'rate_limit':
				return 'Wait for rate limit window to reset. Reduce request frequency. Try fallback model if available.';
			case 'quota':
				return 'Check billing status and quota limits. Upgrade plan or wait for quota reset.';
			case 'content_filter':
				return 'Review prompt content for policy violations. Remove or rephrase flagged content.';
			case 'not_found':
				return 'Verify model identifier is correct. Check model availability in current region.';
			case 'permission':
				return 'Verify API key, authentication token, and access permissions. Regenerate credentials if needed.';
			default:
				return 'Manual investigation required. Review error logs for more details.';
		}
	}

	/**
	 * Determine the introspection result based on error category.
	 */
	private determineResult(category: string): 'success' | 'partial' | 'blocked' {
		switch (category) {
			case 'network':
			case 'timeout':
				return 'partial';
			case 'rate_limit':
				return 'partial';
			case 'quota':
			case 'content_filter':
			case 'not_found':
			case 'permission':
				return 'blocked';
			default:
				return 'blocked';
		}
	}

	override dispose(): void {
		super.dispose();
	}
}