/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { IAgentManagementService } from '../agentManagementService.js';
import { IAgentLLMService, AgentLLMResponse } from './agentLLMService.js';
import { IChatMessage, IChatMessagePart, IChatMessageToolResultPart, IChatResponseToolUsePart, ChatMessageRole } from '../../../chat/common/languageModels.js';
import { AgentToolCallSimulator, ToolCallRound } from './agentToolCallSimulator.js';

export class AgentSandbox extends Disposable {

	private readonly container: HTMLElement;
	private readonly agentId: string;
	private readonly agentMgmtService: IAgentManagementService;
	private readonly llmService?: IAgentLLMService;

	private cancellationSource?: CancellationTokenSource;
	private messageHistory: IChatMessage[] = [];
	private messageTimestamps: number[] = [];
	private rafId: number = 0;
	private responseArea: HTMLElement | null = null;
	private conversationArea: HTMLElement | null = null;
	private runBtn: HTMLButtonElement | null = null;
	private cancelBtn: HTMLButtonElement | null = null;
	private clearHistoryBtn: HTMLButtonElement | null = null;
	private textarea: HTMLTextAreaElement | null = null;
	private readonly MAX_HISTORY_ROUNDS = 20;
	private historyTrimmed = false;

	constructor(
		parent: HTMLElement,
		agentId: string,
		agentMgmtService: IAgentManagementService,
		llmService?: IAgentLLMService,
	) {
		super();
		this.container = parent;
		this.agentId = agentId;
		this.agentMgmtService = agentMgmtService;
		this.llmService = llmService;
		this.render();
	}

	override dispose(): void {
		this.cancelStreaming();
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
		super.dispose();
	}

	// ─── Render (agent-harness-construction: observation design) ───

	private async render(): Promise<void> {
		clearNode(this.container);
		this.container.className = 'agent-sandbox';

		try {
			const def = await this.agentMgmtService.getDefinition(this.agentId);
			if (!def) {
				this.renderNotFound();
				return;
			}

			// Header
			const header = append(this.container, $('.agent-sandbox-header'));
			append(header, $('span.agent-sandbox-icon.codicon.codicon-beaker'));
			append(header, $('h2.agent-sandbox-title')).textContent = `Sandbox: ${def.name}`;

			// Prompt input area
			const promptSection = append(this.container, $('.agent-sandbox-prompt-section'));
			append(promptSection, $('label.agent-sandbox-label')).textContent = 'Test Prompt';
			this.textarea = append(promptSection, $('textarea.agent-sandbox-input')) as HTMLTextAreaElement;
			this.textarea.placeholder = 'Enter a test prompt to see how the agent responds...';
			this.textarea.rows = 4;

			// Action buttons
			const actions = append(this.container, $('.agent-sandbox-actions'));
			this.runBtn = append(actions, $('button.agent-sandbox-run-btn')) as HTMLButtonElement;
			this.runBtn.textContent = 'Run Test';
			this.runBtn.addEventListener('click', () => this.handleRun());

			this.cancelBtn = append(actions, $('button.agent-sandbox-cancel-btn')) as HTMLButtonElement;
			this.cancelBtn.textContent = 'Cancel';
			this.cancelBtn.style.display = 'none';
			this.cancelBtn.addEventListener('click', () => this.cancelStreaming());

			this.clearHistoryBtn = append(actions, $('button.agent-sandbox-clear-btn')) as HTMLButtonElement;
			this.clearHistoryBtn.textContent = 'Clear History';
			this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

			// Response area
			append(this.container, $('label.agent-sandbox-label')).textContent = 'Response';
			this.responseArea = append(this.container, $('.agent-sandbox-response'));
			this.responseArea.setAttribute('data-sandbox-output', '');
			this.responseArea.textContent = this.llmService
				? 'Waiting for test input...'
				: 'Waiting for test input... (mock mode)';

			// Conversation history area (Task 8: multi-turn conversation UI)
			this.conversationArea = append(this.container, $('.agent-sandbox-conversation'));
			this.renderConversation();
		} catch (e) {
			this.renderError(String(e));
		}
	}

	// ─── Run / Cancel ──────────────────────────────────────────

	private async handleRun(): Promise<void> {
		const prompt = this.textarea?.value.trim();
		if (!prompt) { return; }
		await this.runTest(prompt);
	}

	private cancelStreaming(): void {
		if (this.cancellationSource) {
			this.cancellationSource.cancel();
			this.cancellationSource.dispose();
			this.cancellationSource = undefined;
		}
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
		this.setUIState('idle');
		if (this.responseArea && this.responseArea.textContent === 'Processing...') {
			this.responseArea.textContent = 'Cancelled.';
			this.responseArea.classList.remove('loading');
		}
	}

	private setUIState(state: 'idle' | 'running'): void {
		if (this.runBtn) {
			this.runBtn.style.display = state === 'running' ? 'none' : '';
		}
		if (this.cancelBtn) {
			this.cancelBtn.style.display = state === 'running' ? '' : 'none';
		}
		if (this.textarea) {
			this.textarea.disabled = state === 'running';
		}
	}

	// ─── Core runTest (agentic-engineering: eval-first design) ───

	private async runTest(prompt: string): Promise<void> {
		if (!this.responseArea) { return; }

		this.responseArea.textContent = 'Processing...';
		this.responseArea.classList.add('loading');
		this.responseArea.classList.remove('error');
		this.setUIState('running');

		// ── Phase 1: Failure Capture setup (agent-introspection-debugging) ──
		const startTime = Date.now();
		const requestContext = { agentId: this.agentId, prompt: prompt.substring(0, 200), timestamp: startTime };

		try {
			// ── Mock mode fallback (ai-regression-testing: sandbox-mode) ──
			if (!this.llmService) {
				await this.runMockTest(prompt, startTime);
				return;
			}

			// ── Real LLM mode ──
			const def = await this.agentMgmtService.getDefinition(this.agentId);
			if (!def) {
				this.responseArea.textContent = 'Agent not found.';
				this.responseArea.classList.remove('loading');
				this.setUIState('idle');
				return;
			}

			// Build messages (Layer 1: system prompt injection, Layer 2: message history)
			const messages: IChatMessage[] = [];

			// System prompt from agent config (Layer 1 CRITICAL: code-gated injection)
			const systemPrompt = def.config?.systemPrompt as string | undefined;
			if (systemPrompt) {
				messages.push({
					role: ChatMessageRole.System,
					content: [{ type: 'text', value: systemPrompt }],
				});
			}

			// Message history (Layer 2 CRITICAL: IChatMessagePart[] format)
			messages.push(...this.messageHistory);

			// User prompt
			messages.push({
				role: ChatMessageRole.User,
				content: [{ type: 'text', value: prompt }],
			});

			// Select model and create cancellation token
			const identifier = await this.llmService.selectModel(def.config || {});
			this.cancellationSource = new CancellationTokenSource();

			// Send prompt with streaming
			let response: AgentLLMResponse = await this.llmService.sendPrompt(
				identifier,
				messages,
				{
					token: this.cancellationSource.token,
					timeoutMs: 60000,
				},
			);

			// Check cancellation
			if (this.cancellationSource.token.isCancellationRequested) {
				this.responseArea.textContent = 'Cancelled.';
				this.responseArea.classList.remove('loading');
				this.setUIState('idle');
				return;
			}

			// ── Tool Calling Loop (Layer 6-8: tool selection, execution, interpretation) ──
			const maxRounds = 5;
			let currentRound = 0;
			const simulator = new AgentToolCallSimulator();
			let totalToolCalls = 0;

			while (response.artifacts.toolCalls.length > 0 && currentRound < maxRounds) {
				if (this.cancellationSource.token.isCancellationRequested) {
					this.responseArea.textContent = 'Cancelled during tool execution.';
					this.responseArea.classList.remove('loading');
					this.setUIState('idle');
					return;
				}

				currentRound++;

				// Build assistant message with text + tool_use parts (Layer 6: tool selection)
				const assistantParts: IChatMessagePart[] = [];
				if (response.artifacts.text) {
					assistantParts.push({ type: 'text', value: response.artifacts.text });
				}
				for (const tc of response.artifacts.toolCalls) {
					const toolCallId = `call_${currentRound}_${tc.toolName}`;
					const toolUsePart: IChatResponseToolUsePart = {
						type: 'tool_use',
						name: tc.toolName,
						toolCallId,
						parameters: tc.input,
					};
					assistantParts.push(toolUsePart);
				}
				messages.push({
					role: ChatMessageRole.Assistant,
					content: assistantParts,
				});

				// Execute each tool call and build tool_result parts (Layer 7: tool execution)
				const toolResultParts: IChatMessagePart[] = [];
				for (let i = 0; i < response.artifacts.toolCalls.length; i++) {
					const tc = response.artifacts.toolCalls[i];
					const toolCallId = `call_${currentRound}_${tc.toolName}`;
					const { result, durationMs } = simulator.executeToolCall(tc.toolName, tc.input);
					const status: 'success' | 'error' = result.startsWith('Error:') ? 'error' : 'success';

					// Render tool call card in UI
					this.renderToolCallCard({
						round: currentRound,
						toolName: tc.toolName,
						input: tc.input,
						output: result,
						durationMs,
						status,
					});

					// Layer 8: tool_result injected as IChatMessageToolResultPart, not raw text
					const toolResult: IChatMessageToolResultPart = {
						type: 'tool_result',
						toolCallId,
						value: [{ type: 'text', value: result }],
						isError: status === 'error',
					};
					toolResultParts.push(toolResult);
					totalToolCalls++;
				}
				messages.push({
					role: ChatMessageRole.User,
					content: toolResultParts,
				});

				// Re-send with tool results to get next response
				response = await this.llmService.sendPrompt(
					identifier,
					messages,
					{
						token: this.cancellationSource.token,
						timeoutMs: 60000,
					},
				);

				if (this.cancellationSource.token.isCancellationRequested) {
					this.responseArea.textContent = 'Cancelled during tool execution.';
					this.responseArea.classList.remove('loading');
					this.setUIState('idle');
					return;
				}
			}

			// Render final response text
			this.responseArea.textContent = response.artifacts.text;
			this.responseArea.classList.remove('loading');

			// Update message history (Layer 2: persistence)
			this.messageHistory.push({
				role: ChatMessageRole.User,
				content: [{ type: 'text', value: prompt }],
			});
			this.messageTimestamps.push(Date.now());
			this.messageHistory.push({
				role: ChatMessageRole.Assistant,
				content: [{ type: 'text', value: response.artifacts.text }],
			});
			this.messageTimestamps.push(Date.now());

			// Trim history to MAX_HISTORY_ROUNDS (Task 8.3: context window management)
			this.trimHistory();

			// Render conversation bubbles (Task 8.1: multi-turn conversation UI)
			this.renderConversation();

			// Record usage (agentic-os: append-only log)
			this.agentMgmtService.recordUsage(this.agentId, {
				agentId: this.agentId,
				timestamp: Date.now(),
				promptPreview: prompt.substring(0, 100),
				responsePreview: response.artifacts.text.substring(0, 100),
				tokensIn: response.metrics.tokensIn,
				tokensOut: response.metrics.tokensOut,
				latencyMs: response.metrics.totalLatencyMs,
				success: true,
				ttftMs: response.metrics.ttftMs,
				streaming: true,
				modelId: identifier,
				toolCalls: response.artifacts.toolCalls.length + totalToolCalls,
				sessionId: undefined,
				errorCategory: undefined,
			});

			// Show latency
			this.showLatency(response.metrics.totalLatencyMs);

		} catch (e) {
			// ── Phase 4: Introspection Report (agent-introspection-debugging) ──
			const error = e instanceof Error ? e : new Error(String(e));
			const classified = this.llmService
				? this.llmService.classifyError(error)
				: { category: 'unknown' as const, retryable: false };

			this.llmService?.logIntrospectionReport({
				failure: `[Agent: ${requestContext.agentId}, Prompt: ${requestContext.prompt}] ${error.message}`,
				rootCause: `Category: ${classified.category}, Retryable: ${classified.retryable}`,
				recoveryAction: 'Displayed error to user in sandbox UI',
				result: 'blocked',
				tokenBurnRisk: 'N/A',
				followUpNeeded: classified.retryable ? 'Retry with backoff' : 'Check agent configuration',
			});

			if (!this.cancellationSource?.token.isCancellationRequested) {
				this.responseArea!.textContent = `Error: ${error.message}`;
				this.responseArea!.classList.add('error');

				// Record failed usage
				this.agentMgmtService.recordUsage(this.agentId, {
					agentId: this.agentId,
					timestamp: Date.now(),
					promptPreview: prompt.substring(0, 100),
					responsePreview: error.message.substring(0, 100),
					tokensIn: Math.ceil(prompt.length / 4),
					tokensOut: 0,
					latencyMs: Date.now() - startTime,
					success: false,
					errorCategory: classified.category,
				});
			}
		} finally {
			this.responseArea?.classList.remove('loading');
			this.setUIState('idle');
			if (this.cancellationSource) {
				this.cancellationSource.dispose();
				this.cancellationSource = undefined;
			}
		}
	}

	// ─── Mock mode (ai-regression-testing: sandbox-mode fallback) ───

	private async runMockTest(prompt: string, startTime: number): Promise<void> {
		const def = await this.agentMgmtService.getDefinition(this.agentId);
		const response = def
			? `[Agent: ${def.name}]\n[Prompt]: ${prompt}\n\n[Simulated Response]\nAgent "${def.name}" would process: "${prompt}"\n\nConfiguration:\n${JSON.stringify(def.config, null, 2)}`
			: 'Agent not found.';

		const latency = Date.now() - startTime;

		this.agentMgmtService.recordUsage(this.agentId, {
			agentId: this.agentId,
			timestamp: Date.now(),
			promptPreview: prompt.substring(0, 100),
			responsePreview: response.substring(0, 100),
			tokensIn: Math.ceil(prompt.length / 4),
			tokensOut: Math.ceil(response.length / 4),
			latencyMs: latency,
			success: true,
			streaming: false,
		});

		if (this.responseArea) {
			this.responseArea.textContent = response;
			this.responseArea.classList.remove('loading');
		}

		// Update message history (mock mode)
		this.messageHistory.push({
			role: ChatMessageRole.User,
			content: [{ type: 'text', value: prompt }],
		});
		this.messageTimestamps.push(Date.now());
		this.messageHistory.push({
			role: ChatMessageRole.Assistant,
			content: [{ type: 'text', value: response }],
		});
		this.messageTimestamps.push(Date.now());

		// Trim history and render conversation
		this.trimHistory();
		this.renderConversation();

		this.showLatency(latency);
	}

	// ─── Conversation UI (Task 8: multi-turn conversation + message history) ───

	/**
	 * Renders all messageHistory entries as chat bubbles in the conversation area.
	 * User messages: right-aligned blue; Assistant: left-aligned gray; System: centered italic.
	 */
	private renderConversation(): void {
		if (!this.conversationArea) { return; }
		clearNode(this.conversationArea);

		// Show trim indicator if trimming occurred (Task 8.3)
		if (this.historyTrimmed) {
			const trimNotice = append(this.conversationArea, $('.agent-sandbox-trim-notice'));
			trimNotice.textContent = 'Context trimmed (20 rounds max)';
		}

		for (let i = 0; i < this.messageHistory.length; i++) {
			const msg = this.messageHistory[i];
			const timestamp = this.messageTimestamps[i] || Date.now();

			const bubble = append(this.conversationArea, $(`.agent-sandbox-message.${String(msg.role)}`));

			const header = append(bubble, $('.agent-sandbox-message-header'));
			const roleLabel = append(header, $('span.agent-sandbox-message-role'));
			roleLabel.textContent = String(msg.role);

			const timeLabel = append(header, $('span.agent-sandbox-message-time'));
			timeLabel.textContent = new Date(timestamp).toLocaleTimeString();

			const content = append(bubble, $('div.agent-sandbox-message-content'));
			content.textContent = this.getMessageText(msg);
		}

		// Auto-scroll to bottom (Task 8.4)
		this.scrollToBottom();
	}

	/**
	 * Extracts the concatenated text content from an IChatMessage's content parts.
	 */
	private getMessageText(message: IChatMessage): string {
		return message.content
			.filter(part => part.type === 'text')
			.map(part => part.value)
			.join('\n');
	}

	/**
	 * Clears all message history, timestamps, and the conversation DOM.
	 * Shows a temporary notification and records a session end event.
	 * (Task 8.2: Clear History button)
	 */
	private clearHistory(): void {
		this.messageHistory = [];
		this.messageTimestamps = [];
		this.historyTrimmed = false;

		if (this.conversationArea) {
			clearNode(this.conversationArea);
		}

		// Show "History cleared" notification that auto-dismisses after 2 seconds
		const notification = append(this.container, $('.agent-sandbox-clear-notification'));
		notification.textContent = 'History cleared';
		setTimeout(() => notification.remove(), 2000);

		// Record session end event (agentic-os: auto-reflection log)
		this.agentMgmtService.recordUsage(this.agentId, {
			agentId: this.agentId,
			timestamp: Date.now(),
			promptPreview: '[Session cleared]',
			responsePreview: '[History cleared by user]',
			tokensIn: 0,
			tokensOut: 0,
			latencyMs: 0,
			success: true,
		});
	}

	/**
	 * Trims message history to MAX_HISTORY_ROUNDS (20 rounds = 40 messages + system messages).
	 * System messages are always preserved. Oldest user+assistant pairs are removed first.
	 * (Task 8.3: context window management)
	 */
	private trimHistory(): void {
		// Count system messages (they are always preserved)
		const systemCount = this.messageHistory.filter(m => m.role === ChatMessageRole.System).length;
		const maxMessages = this.MAX_HISTORY_ROUNDS * 2 + systemCount;

		if (this.messageHistory.length <= maxMessages) {
			return;
		}

		// Find indices of system messages to preserve
		const systemIndices = new Set<number>();
		for (let i = 0; i < this.messageHistory.length; i++) {
			if (this.messageHistory[i].role === ChatMessageRole.System) {
				systemIndices.add(i);
			}
		}

		// Build new arrays, preserving system messages and trimming from the front
		const newHistory: IChatMessage[] = [];
		const newTimestamps: number[] = [];

		// First pass: collect system messages
		for (let i = 0; i < this.messageHistory.length; i++) {
			if (systemIndices.has(i)) {
				newHistory.push(this.messageHistory[i]);
				newTimestamps.push(this.messageTimestamps[i]);
			}
		}

		// Second pass: add non-system messages from the end, up to the limit
		const remainingSlots = maxMessages - newHistory.length;
		const nonSystemMessages: { msg: IChatMessage; ts: number }[] = [];
		for (let i = 0; i < this.messageHistory.length; i++) {
			if (!systemIndices.has(i)) {
				nonSystemMessages.push({ msg: this.messageHistory[i], ts: this.messageTimestamps[i] });
			}
		}

		// Take the most recent non-system messages
		const trimmed = nonSystemMessages.slice(-remainingSlots);
		for (const item of trimmed) {
			newHistory.push(item.msg);
			newTimestamps.push(item.ts);
		}

		this.messageHistory = newHistory;
		this.messageTimestamps = newTimestamps;
		this.historyTrimmed = true;
	}

	/**
	 * Auto-scrolls the conversation area to the bottom when new messages are added.
	 * (Task 8.4: auto-scroll behavior)
	 */
	private scrollToBottom(): void {
		if (this.conversationArea) {
			this.conversationArea.scrollTop = this.conversationArea.scrollHeight;
		}
	}

	/**
	 * Resets sandbox state when switching agents.
	 * Clears message history, timestamps, and conversation DOM.
	 * (Task 8.5: Switch Agent handling)
	 */
	resetSandbox(): void {
		this.messageHistory = [];
		this.messageTimestamps = [];
		this.historyTrimmed = false;
		if (this.conversationArea) {
			clearNode(this.conversationArea);
		}
		if (this.responseArea) {
			this.responseArea.textContent = this.llmService
				? 'Waiting for test input...'
				: 'Waiting for test input... (mock mode)';
			this.responseArea.classList.remove('loading', 'error');
		}
		if (this.textarea) {
			this.textarea.value = '';
		}
	}

	// ─── Helpers ────────────────────────────────────────────────

	private showLatency(latencyMs: number): void {
		// Remove any existing latency indicator
		const existing = this.container.querySelector('.agent-sandbox-latency');
		if (existing) { existing.remove(); }

		const latencyEl = append(this.container, $('.agent-sandbox-latency'));
		latencyEl.textContent = `Latency: ${latencyMs}ms`;
		setTimeout(() => latencyEl.remove(), 3000);
	}

	/**
	 * Render a tool call card in the sandbox response area.
	 *
	 * Each card shows { round, toolName, input, output, durationMs, status }
	 * as required by agent-harness-construction.
	 *
	 * @param round The ToolCallRound data to render.
	 */
	private renderToolCallCard(round: ToolCallRound): void {
		if (!this.responseArea) { return; }

		const card = $('.agent-sandbox-tool-call');
		card.classList.add(round.status === 'success' ? 'success' : 'error');

		// Header: round number + tool name + duration
		const header = append(card, $('.agent-sandbox-tool-call-header'));
		const headerSpan = append(header, $('span'));
		const statusDot = round.status === 'success' ? '\u2713' : '\u2717';
		headerSpan.textContent = `${statusDot} Round ${round.round}: ${round.toolName} (${round.durationMs}ms)`;

		// Input section: pre-formatted JSON input
		const inputSection = append(card, $('.agent-sandbox-tool-call-section'));
		append(inputSection, $('label.agent-sandbox-tool-call-label')).textContent = 'Input';
		const inputPre = append(inputSection, $('pre.agent-sandbox-tool-call-pre'));
		inputPre.textContent = JSON.stringify(round.input, null, 2);

		// Output section: pre-formatted text output
		const outputSection = append(card, $('.agent-sandbox-tool-call-section'));
		append(outputSection, $('label.agent-sandbox-tool-call-label')).textContent = 'Output';
		const outputPre = append(outputSection, $('pre.agent-sandbox-tool-call-pre'));
		outputPre.textContent = round.output;

		append(this.responseArea, card);
	}

	private renderNotFound(): void {
		append(this.container, $('span.codicon.codicon-warning'));
		append(this.container, $('p')).textContent = 'Agent not found.';
	}

	private renderError(message: string): void {
		append(this.container, $('span.codicon.codicon-error'));
		append(this.container, $('p')).textContent = `Error: ${message}`;
	}
}