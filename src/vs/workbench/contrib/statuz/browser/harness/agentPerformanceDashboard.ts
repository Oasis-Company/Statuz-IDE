/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentManagementService } from '../agentManagementService.js';

export class AgentPerformanceDashboard extends Disposable {

	private readonly container: HTMLElement;
	private readonly agentMgmtService: IAgentManagementService;

	constructor(
		parent: HTMLElement,
		agentMgmtService: IAgentManagementService,
	) {
		super();
		this.container = parent;
		this.agentMgmtService = agentMgmtService;
		this.render();
	}

	private async render(): Promise<void> {
		clearNode(this.container);
		this.container.className = 'agent-performance-dashboard';

		// Header
		const header = append(this.container, $('.agent-performance-header'));
		append(header, $('span.agent-performance-icon.codicon.codicon-graph'));
		append(header, $('h2.agent-performance-title')).textContent = 'Agent Performance';

		try {
			const allStats = await this.agentMgmtService.getAllUsageStats();
			const statsArray = Array.from(allStats.values());

			if (statsArray.length === 0) {
				this.renderEmpty();
				return;
			}

			// Summary metrics
			const summary = append(this.container, $('.agent-performance-summary'));
			const totalCalls = statsArray.reduce((sum, s) => sum + s.totalCalls, 0);
			const avgLatency = statsArray.length > 0
				? statsArray.reduce((sum, s) => sum + s.avgLatencyMs, 0) / statsArray.length
				: 0;
			const avgSuccess = statsArray.length > 0
				? statsArray.reduce((sum, s) => sum + s.successRate, 0) / statsArray.length
				: 0;

			this.renderMetricCard(summary, 'Total Calls', String(totalCalls), 'codicon-request-changes');
			this.renderMetricCard(summary, 'Avg Latency', `${avgLatency.toFixed(0)}ms`, 'codicon-dashboard');
			this.renderMetricCard(summary, 'Success Rate', `${(avgSuccess * 100).toFixed(1)}%`, 'codicon-pass');

			// Per-agent breakdown
			const tableSection = append(this.container, $('.agent-performance-table-section'));
			append(tableSection, $('h3.agent-performance-section-title')).textContent = 'Per-Agent Breakdown';

			const table = append(tableSection, $('table.agent-performance-table'));
			const thead = append(table, $('thead'));
			const headerRow = append(thead, $('tr'));
			['Agent', 'Calls', 'Tokens In', 'Tokens Out', 'Avg Latency', 'Success'].forEach(h => {
				append(headerRow, $('th')).textContent = h;
			});

			const tbody = append(table, $('tbody'));
			for (const stats of statsArray) {
				const def = await this.agentMgmtService.getDefinition(stats.agentId);
				const row = append(tbody, $('tr'));
				append(row, $('td')).textContent = def?.name ?? stats.agentId;
				append(row, $('td')).textContent = String(stats.totalCalls);
				append(row, $('td')).textContent = this.formatTokens(stats.totalTokensIn);
				append(row, $('td')).textContent = this.formatTokens(stats.totalTokensOut);
				append(row, $('td')).textContent = `${stats.avgLatencyMs.toFixed(0)}ms`;
				append(row, $('td')).textContent = `${(stats.successRate * 100).toFixed(1)}%`;
			}
		} catch (e) {
			this.renderError(String(e));
		}
	}

	private renderMetricCard(
		parent: HTMLElement,
		label: string,
		value: string,
		icon: string,
	): void {
		const card = append(parent, $('.agent-performance-metric-card'));
		append(card, $('span.agent-performance-metric-icon.codicon')).className = `agent-performance-metric-icon codicon ${icon}`;
		append(card, $('.agent-performance-metric-value')).textContent = value;
		append(card, $('.agent-performance-metric-label')).textContent = label;
	}

	private renderEmpty(): void {
		const empty = append(this.container, $('.agent-performance-empty'));
		append(empty, $('span.codicon.codicon-info'));
		append(empty, $('p')).textContent = 'No usage data yet. Use agents in the Sandbox to collect performance metrics.';
	}

	private renderError(message: string): void {
		const error = append(this.container, $('.agent-performance-error'));
		append(error, $('span.codicon.codicon-error'));
		append(error, $('p')).textContent = `Error: ${message}`;
	}

	private formatTokens(n: number): string {
		if (n >= 1000000) { return `${(n / 1000000).toFixed(1)}M`; }
		if (n >= 1000) { return `${(n / 1000).toFixed(1)}K`; }
		return String(n);
	}
}