/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { AgentConfigPromptAdapter } from '../agentdef/agentConfigPromptAdapter.js';

export class AgentBehaviorPreview extends Disposable {

	private readonly container: HTMLElement;
	private readonly adapter = new AgentConfigPromptAdapter();

	constructor(parent: HTMLElement) {
		super();
		this.container = parent;
		this.container.className = 'agent-behavior-preview';
		this.renderEmpty();
	}

	show(config: Record<string, unknown>): void {
		clearNode(this.container);
		const promptConfig = this.adapter.extractPromptConfig(config);
		const fragment = this.adapter.toPromptFragment(promptConfig);

		const content = append(this.container, $('.agent-behavior-preview-content'));

		// Header
		const header = append(content, $('.agent-behavior-preview-header'));
		append(header, $('span.codicon.codicon-eye'));
		append(header, document.createTextNode(' Behavior Preview'));
		append(header, $('.agent-behavior-preview-badge')).textContent = 'Live';

		// Prompt preview
		const promptSection = append(content, $('.agent-behavior-preview-section'));
		append(promptSection, $('.agent-behavior-preview-section-label')).textContent = 'System Prompt Fragment';
		const promptCode = append(promptSection, $('pre.agent-behavior-preview-code'));
		promptCode.textContent = fragment || '(No agent-specific instructions — Chat will use global settings only)';

		// Summary cards
		const summary = append(content, $('.agent-behavior-preview-summary'));

		if (promptConfig.role) {
			this.renderSummaryCard(summary, 'Role', promptConfig.role, 'codicon-person');
		}
		if (promptConfig.style) {
			this.renderSummaryCard(summary, 'Style', promptConfig.style, 'codicon-symbol-color');
		}
		if (promptConfig.domain) {
			this.renderSummaryCard(summary, 'Domain', promptConfig.domain, 'codicon-globe');
		}
		if (promptConfig.constraints.length > 0) {
			this.renderSummaryCard(summary, 'Constraints', `${promptConfig.constraints.length} rules`, 'codicon-law');
		}
		if (promptConfig.tools.length > 0) {
			this.renderSummaryCard(summary, 'Tools', `${promptConfig.tools.length} available`, 'codicon-tools');
		}

		// Effect description
		const effect = append(content, $('.agent-behavior-preview-effect'));
		append(effect, $('.agent-behavior-preview-effect-title')).textContent = 'What this means';
		append(effect, $('.agent-behavior-preview-effect-text')).textContent =
			promptConfig.role
				? `When this agent is active in Chat, the AI will act as "${promptConfig.role}"${promptConfig.style ? ` with a "${promptConfig.style}" style` : ''}${promptConfig.domain ? `, specializing in ${promptConfig.domain}` : ''}.`
				: 'No agent-specific behavior defined. Chat will use the global AI instructions.';
	}

	private renderSummaryCard(parent: HTMLElement, label: string, value: string, icon: string): void {
		const card = append(parent, $('.agent-behavior-preview-summary-card'));
		const iconEl = append(card, $('span.codicon'));
		iconEl.className = `codicon ${icon}`;
		append(card, $('.agent-behavior-preview-summary-card-label')).textContent = label;
		append(card, $('.agent-behavior-preview-summary-card-value')).textContent = value;
	}

	private renderEmpty(): void {
		clearNode(this.container);
		const empty = append(this.container, $('.agent-behavior-preview-empty'));
		append(empty, $('span.codicon.codicon-eye-closed'));
		append(empty, $('span')).textContent = 'Select an agent to preview behavior';
	}

	override dispose(): void {
		super.dispose();
	}
}