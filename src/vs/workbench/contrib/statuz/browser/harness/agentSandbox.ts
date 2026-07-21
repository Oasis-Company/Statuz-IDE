/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentManagementService } from '../agentManagementService.js';

export class AgentSandbox extends Disposable {

	private readonly container: HTMLElement;
	private readonly agentId: string;
	private readonly agentMgmtService: IAgentManagementService;

	constructor(
		parent: HTMLElement,
		agentId: string,
		agentMgmtService: IAgentManagementService,
	) {
		super();
		this.container = parent;
		this.agentId = agentId;
		this.agentMgmtService = agentMgmtService;
		this.render();
	}

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
			const textarea = append(promptSection, $('textarea.agent-sandbox-input')) as HTMLTextAreaElement;
			textarea.placeholder = 'Enter a test prompt to see how the agent responds...';
			textarea.rows = 4;

			// Run button
			const actions = append(this.container, $('.agent-sandbox-actions'));
			const runBtn = append(actions, $('button.agent-sandbox-run-btn')) as HTMLButtonElement;
			runBtn.textContent = 'Run Test';
			runBtn.addEventListener('click', async () => {
				const prompt = textarea.value.trim();
				if (!prompt) { return; }
				await this.runTest(prompt);
			});

			// Response area
			append(this.container, $('label.agent-sandbox-label')).textContent = 'Response';
			const responseArea = append(this.container, $('.agent-sandbox-response'));
			responseArea.setAttribute('data-sandbox-output', '');
			responseArea.textContent = 'Waiting for test input...';
		} catch (e) {
			this.renderError(String(e));
		}
	}

	private async runTest(prompt: string): Promise<void> {
		const responseArea = this.container.querySelector('.agent-sandbox-response');
		if (!responseArea) { return; }

		responseArea.textContent = 'Processing...';
		responseArea.classList.add('loading');

		try {
			const startTime = Date.now();
			const def = await this.agentMgmtService.getDefinition(this.agentId);
			const response = def
				? `[Agent: ${def.name}]\n[Prompt]: ${prompt}\n\n[Simulated Response]\nAgent "${def.name}" would process: "${prompt}"\n\nConfiguration:\n${JSON.stringify(def.config, null, 2)}`
				: `Agent not found.`;

			const latency = Date.now() - startTime;

			// Record usage
			await this.agentMgmtService.recordUsage(this.agentId, {
				agentId: this.agentId,
				timestamp: Date.now(),
				promptPreview: prompt.substring(0, 100),
				responsePreview: response.substring(0, 100),
				tokensIn: Math.ceil(prompt.length / 4),
				tokensOut: Math.ceil(response.length / 4),
				latencyMs: latency,
				success: true,
			});

			responseArea.textContent = response;
			responseArea.classList.remove('loading');

			// Show latency
			const latencyEl = append(this.container, $('.agent-sandbox-latency'));
			latencyEl.textContent = `Latency: ${latency}ms`;
			setTimeout(() => latencyEl.remove(), 3000);
		} catch (e) {
			responseArea.textContent = `Error: ${String(e)}`;
			responseArea.classList.remove('loading');
			responseArea.classList.add('error');
		}
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