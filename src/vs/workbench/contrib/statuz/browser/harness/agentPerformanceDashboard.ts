/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, clearNode, addDisposableListener } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentManagementService } from '../agentManagementService.js';
import { AgentUsageRecord, AgentUsageStats } from '../agentManagement.types.js';

/** Error category color mapping for the CSS-only bar chart */
const ERROR_CATEGORY_COLORS: Record<string, string> = {
	network: '#f0ad4e',
	timeout: '#f0c040',
	rate_limit: '#dc3545',
	content_filter: '#6f42c1',
	off_topic: '#6c757d',
	quota: '#8b0000',
	not_found: '#6c757d',
	permission: '#6c757d',
	unknown: '#6c757d',
};

function getErrorCategoryColor(category: string): string {
	return ERROR_CATEGORY_COLORS[category] ?? '#6c757d';
}

function getLatencyDotColor(ms: number | undefined): string {
	if (ms === undefined) { return 'var(--vscode-descriptionForeground)'; }
	if (ms < 2000) { return 'var(--vscode-testing-iconPassed)'; }
	if (ms <= 5000) { return 'var(--vscode-testing-iconQueued)'; }
	return 'var(--vscode-testing-iconFailed)';
}

function formatLatency(ms: number | undefined): string {
	return ms !== undefined ? `${Math.round(ms)}ms` : 'N/A';
}

export class AgentPerformanceDashboard extends Disposable {

	private readonly container: HTMLElement;
	private readonly agentMgmtService: IAgentManagementService;

	private lastRefreshTimestamp = 0;
	private readonly THROTTLE_MS = 500;
	private pendingRefresh = false;

	constructor(
		parent: HTMLElement,
		agentMgmtService: IAgentManagementService,
	) {
		super();
		this.container = parent;
		this.agentMgmtService = agentMgmtService;

		// Step 7.1: Subscribe to onDidRecordUsage for real-time updates
		this._register(agentMgmtService.onDidRecordUsage(() => this.debouncedRefresh()));
		this.render();
	}

	/**
	 * Step 7.1: Debounced refresh with 500ms throttle.
	 * Tracks lastRefresh timestamp; if less than 500ms since last refresh, skips.
	 * Uses requestAnimationFrame for the actual refresh to avoid layout thrashing.
	 */
	private debouncedRefresh(): void {
		const now = Date.now();
		if (now - this.lastRefreshTimestamp < this.THROTTLE_MS) {
			return;
		}
		this.lastRefreshTimestamp = now;

		if (this.pendingRefresh) {
			return;
		}
		this.pendingRefresh = true;
		requestAnimationFrame(() => {
			this.pendingRefresh = false;
			this.render();
		});
	}

	private async render(): Promise<void> {
		clearNode(this.container);
		this.container.className = 'agent-performance-dashboard';

		// Header with export button
		const header = append(this.container, $('.agent-performance-header'));
		append(header, $('span.agent-performance-icon.codicon.codicon-graph'));
		append(header, $('h2.agent-performance-title')).textContent = 'Agent Performance';

		// Step 7.5: Export CSV button
		const exportBtn = append(header, $('button.agent-perf-export-btn'));
		append(exportBtn, $('span.codicon.codicon-export'));
		exportBtn.appendChild(document.createTextNode(' Export CSV'));
		this._register(addDisposableListener(exportBtn, 'click', () => this.exportCSV()));

		try {
			const allStats = await this.agentMgmtService.getAllUsageStats();
			// getAllUsageStats returns AgentUsageStats[], not a Map
			const statsArray = allStats;

			if (statsArray.length === 0) {
				this.renderEmptyState();
				return;
			}

			// ── Summary metrics ──────────────────────────────────
			const summary = append(this.container, $('.agent-performance-summary'));
			const totalCalls = statsArray.reduce((sum, s) => sum + s.totalCalls, 0);
			const totalTokensIn = statsArray.reduce((sum, s) => sum + s.totalTokensIn, 0);
			const totalTokensOut = statsArray.reduce((sum, s) => sum + s.totalTokensOut, 0);
			const avgSuccess = statsArray.reduce((sum, s) => sum + s.successRate, 0) / statsArray.length;
			const totalErrors = statsArray.reduce((sum, s) => sum + (s.totalErrors ?? 0), 0);

			this.renderMetricCard(summary, 'Total Calls', String(totalCalls), 'codicon-request-changes');
			this.renderMetricCard(summary, 'Tokens In', this.formatTokens(totalTokensIn), 'codicon-arrow-down');
			this.renderMetricCard(summary, 'Tokens Out', this.formatTokens(totalTokensOut), 'codicon-arrow-up');
			this.renderMetricCard(summary, 'Success Rate', `${(avgSuccess * 100).toFixed(1)}%`, 'codicon-pass');
			this.renderMetricCard(summary, 'Total Errors', String(totalErrors), 'codicon-error');

			// ── Step 7.2: Quantile display cards ──────────────────
			this.renderQuantileCards(statsArray);

			// ── Step 7.3: Error breakdown panel ───────────────────
			this.renderErrorBreakdown(statsArray);

			// ── Step 7.4: Token consumption trend chart ────────────
			this.renderTokenTrendChart(statsArray);

			// ── Per-agent breakdown table ─────────────────────────
			this.renderAgentTable(statsArray);

			// ── Recent Run Summary (agentic-os pattern) ───────────
			this.renderRecentRunSummary(statsArray);

		} catch (e) {
			this.renderError(String(e));
		}
	}

	// ─── Step 7.2: Quantile Display Cards ────────────────────────

	private renderQuantileCards(statsArray: AgentUsageStats[]): void {
		// Collect all latencies from recentRecords across all agents
		const allLatencies: number[] = [];
		for (const stats of statsArray) {
			for (const rec of stats.recentRecords) {
				allLatencies.push(rec.latencyMs);
			}
		}
		allLatencies.sort((a, b) => a - b);

		const p50 = this.calculateQuantile(allLatencies, 0.50);
		const p95 = this.calculateQuantile(allLatencies, 0.95);
		const p99 = this.calculateQuantile(allLatencies, 0.99);

		const section = append(this.container, $('.agent-perf-section'));
		append(section, $('h3.agent-perf-section-title')).textContent = 'Latency Distribution';

		const grid = append(section, $('.agent-perf-quantile-grid'));
		this.renderQuantileCard(grid, 'P50', p50);
		this.renderQuantileCard(grid, 'P95', p95);
		this.renderQuantileCard(grid, 'P99', p99);
	}

	private calculateQuantile(sorted: number[], q: number): number | undefined {
		if (sorted.length === 0) { return undefined; }
		const pos = (sorted.length - 1) * q;
		const lower = Math.floor(pos);
		const upper = Math.ceil(pos);
		if (lower === upper) { return sorted[lower]; }
		return sorted[lower] * (upper - pos) + sorted[upper] * (pos - lower);
	}

	private renderQuantileCard(parent: HTMLElement, label: string, valueMs: number | undefined): void {
		const card = append(parent, $('.agent-perf-quantile-card'));
		const dotColor = getLatencyDotColor(valueMs);

		// Color-coded status dot
		const dot = append(card, $('.agent-perf-quantile-dot'));
		dot.style.backgroundColor = dotColor;

		const labelEl = append(card, $('.agent-perf-quantile-label'));
		labelEl.textContent = label;

		const valueEl = append(card, $('.agent-perf-quantile-value'));
		valueEl.textContent = formatLatency(valueMs);
		valueEl.style.color = dotColor;
	}

	// ─── Step 7.3: Error Breakdown Panel ─────────────────────────

	private renderErrorBreakdown(statsArray: AgentUsageStats[]): void {
		// Aggregate error breakdown across all agents
		const aggregated: Record<string, number> = {};
		for (const stats of statsArray) {
			if (stats.errorBreakdown) {
				for (const [category, count] of Object.entries(stats.errorBreakdown)) {
					aggregated[category] = (aggregated[category] || 0) + count;
				}
			}
		}

		const entries = Object.entries(aggregated).sort((a, b) => b[1] - a[1]);
		if (entries.length === 0) {
			return;
		}

		const section = append(this.container, $('.agent-perf-section'));
		append(section, $('h3.agent-perf-section-title')).textContent = 'Error Breakdown';

		const totalErrors = entries.reduce((sum, [, count]) => sum + count, 0);
		const barChart = append(section, $('.agent-perf-error-bars'));

		for (const [category, count] of entries) {
			const percentage = totalErrors > 0 ? ((count / totalErrors) * 100).toFixed(1) : '0.0';
			const barColor = getErrorCategoryColor(category);

			const row = append(barChart, $('.agent-perf-error-row'));
			const info = append(row, $('.agent-perf-error-info'));
			append(info, $('.agent-perf-error-label')).textContent = category.replace(/_/g, ' ');
			append(info, $('.agent-perf-error-count')).textContent = `${count} (${percentage}%)`;

			const barTrack = append(row, $('.agent-perf-error-bar-track'));
			const bar = append(barTrack, $('.agent-perf-error-bar'));
			bar.style.width = `${percentage}%`;
			bar.style.backgroundColor = barColor;
		}
	}

	// ─── Step 7.4: Token Consumption Trend Chart ─────────────────

	private renderTokenTrendChart(statsArray: AgentUsageStats[]): void {
		// Collect all token trend data across agents, flat into one ordered array
		const allPoints: { tokensIn: number; tokensOut: number }[] = [];
		for (const stats of statsArray) {
			if (stats.tokenTrend) {
				for (const point of stats.tokenTrend) {
					allPoints.push({ tokensIn: point.tokensIn, tokensOut: point.tokensOut });
				}
			}
		}

		if (allPoints.length === 0) {
			return;
		}

		const section = append(this.container, $('.agent-perf-section'));
		append(section, $('h3.agent-perf-section-title')).textContent = 'Token Consumption Trend';

		// Try Canvas first, fall back to CSS bars
		const canvasContainer = append(section, $('.agent-perf-canvas-container'));
		const canvas = append(canvasContainer, $('canvas.agent-perf-trend-canvas')) as HTMLCanvasElement;
		canvas.width = 600;
		canvas.height = 200;

		const ctx = canvas.getContext('2d');
		if (ctx) {
			this.drawTokenTrendCanvas(ctx, canvas.width, canvas.height, allPoints);
		} else {
			// CSS fallback: simple bars if Canvas fails
			canvas.style.display = 'none';
			this.renderTokenTrendFallback(canvasContainer, allPoints);
		}
	}

	private drawTokenTrendCanvas(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		points: { tokensIn: number; tokensOut: number }[],
	): void {
		const padding = { top: 20, right: 20, bottom: 30, left: 50 };
		const chartW = width - padding.left - padding.right;
		const chartH = height - padding.top - padding.bottom;

		// Find max value for Y-axis scaling
		let maxTokens = 0;
		for (const p of points) {
			maxTokens = Math.max(maxTokens, p.tokensIn, p.tokensOut);
		}
		if (maxTokens === 0) { maxTokens = 1; }

		// Clear background
		ctx.fillStyle = 'var(--vscode-editor-background, #1e1e1e)';
		ctx.fillRect(0, 0, width, height);

		// Draw grid lines
		ctx.strokeStyle = 'var(--vscode-sideBarSectionHeader-border, #333)';
		ctx.lineWidth = 0.5;
		const gridLines = 4;
		for (let i = 0; i <= gridLines; i++) {
			const y = padding.top + (chartH / gridLines) * i;
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(width - padding.right, y);
			ctx.stroke();

			// Y-axis labels
			const labelValue = Math.round(maxTokens * (1 - i / gridLines));
			ctx.fillStyle = 'var(--vscode-descriptionForeground, #999)';
			ctx.font = '10px sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(String(labelValue), padding.left - 5, y + 3);
		}

		// Draw axes
		ctx.strokeStyle = 'var(--vscode-foreground, #ccc)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(padding.left, padding.top);
		ctx.lineTo(padding.left, height - padding.bottom);
		ctx.lineTo(width - padding.right, height - padding.bottom);
		ctx.stroke();

		// Helper to draw a line
		const drawLine = (values: number[], color: string) => {
			if (points.length === 0) { return; }
			ctx.strokeStyle = color;
			ctx.lineWidth = 2;
			ctx.beginPath();
			for (let i = 0; i < values.length; i++) {
				const x = padding.left + (chartW / (points.length - 1 || 1)) * i;
				const y = padding.top + chartH - (values[i] / maxTokens) * chartH;
				if (i === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}
			}
			ctx.stroke();
		};

		// Draw tokensIn (blue) and tokensOut (green)
		drawLine(points.map(p => p.tokensIn), '#4fc3f7');
		drawLine(points.map(p => p.tokensOut), '#81c784');

		// Legend
		const legendY = 10;
		ctx.font = '11px sans-serif';

		// Tokens In legend
		ctx.fillStyle = '#4fc3f7';
		ctx.fillRect(padding.left, legendY, 10, 10);
		ctx.fillStyle = 'var(--vscode-foreground, #ccc)';
		ctx.textAlign = 'left';
		ctx.fillText('Tokens In', padding.left + 14, legendY + 9);

		// Tokens Out legend
		ctx.fillStyle = '#81c784';
		ctx.fillRect(padding.left + 80, legendY, 10, 10);
		ctx.fillStyle = 'var(--vscode-foreground, #ccc)';
		ctx.fillText('Tokens Out', padding.left + 94, legendY + 9);
	}

	private renderTokenTrendFallback(
		container: HTMLElement,
		points: { tokensIn: number; tokensOut: number }[],
	): void {
		const fallback = append(container, $('.agent-perf-trend-fallback'));
		append(fallback, $('.agent-perf-trend-fallback-note')).textContent =
			'Canvas not available. Showing CSS bar chart.';

		let maxTokens = 0;
		for (const p of points) {
			maxTokens = Math.max(maxTokens, p.tokensIn, p.tokensOut);
		}
		if (maxTokens === 0) { maxTokens = 1; }

		const barsContainer = append(fallback, $('.agent-perf-trend-bars'));
		for (const p of points) {
			const barGroup = append(barsContainer, $('.agent-perf-trend-bar-group'));
			const inBar = append(barGroup, $('.agent-perf-trend-bar.agent-perf-trend-bar-in'));
			inBar.style.height = `${(p.tokensIn / maxTokens) * 100}%`;
			const outBar = append(barGroup, $('.agent-perf-trend-bar.agent-perf-trend-bar-out'));
			outBar.style.height = `${(p.tokensOut / maxTokens) * 100}%`;
		}

		// Legend
		const legend = append(fallback, $('.agent-perf-trend-legend'));
		const legendIn = append(legend, $('.agent-perf-trend-legend-item'));
		legendIn.innerHTML = '<span class="agent-perf-trend-legend-swatch" style="background:#4fc3f7"></span> Tokens In';
		const legendOut = append(legend, $('.agent-perf-trend-legend-item'));
		legendOut.innerHTML = '<span class="agent-perf-trend-legend-swatch" style="background:#81c784"></span> Tokens Out';
	}

	// ─── Step 7.5: CSV Export ────────────────────────────────────

	private async exportCSV(): Promise<void> {
		const allStats = await this.agentMgmtService.getAllUsageStats();
		// Collect all recentRecords from all agents
		const allRecords: AgentUsageRecord[] = [];
		for (const stats of allStats) {
			for (const rec of stats.recentRecords) {
				allRecords.push(rec);
			}
		}

		// Sort by timestamp ascending
		allRecords.sort((a, b) => a.timestamp - b.timestamp);

		// CSV header
		const headers = [
			'timestamp', 'agentId', 'tokensIn', 'tokensOut', 'latencyMs',
			'success', 'errorCategory', 'modelId', 'ttftMs', 'toolCalls',
		];

		const rows: string[] = [headers.join(',')];

		for (const rec of allRecords) {
			const row = [
				new Date(rec.timestamp).toISOString(),
				this.escapeCSVField(rec.agentId),
				rec.tokensIn,
				rec.tokensOut,
				rec.latencyMs,
				rec.success ? 'true' : 'false',
				rec.errorCategory ?? '',
				this.escapeCSVField(rec.modelId ?? ''),
				rec.ttftMs ?? '',
				rec.toolCalls ?? 0,
			];
			rows.push(row.join(','));
		}

		const csvContent = rows.join('\n');
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `agent-usage-${timestamp}.csv`;

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	private escapeCSVField(field: string): string {
		if (field.includes(',') || field.includes('"') || field.includes('\n')) {
			return `"${field.replace(/"/g, '""')}"`;
		}
		return field;
	}

	// ─── Step 7.6: Empty State ──────────────────────────────────

	private renderEmptyState(): void {
		const empty = append(this.container, $('.agent-perf-empty'));
		append(empty, $('span.codicon.codicon-graph-line'));
		append(empty, $('p.agent-perf-empty-title')).textContent =
			'No usage data yet.';
		append(empty, $('p.agent-perf-empty-hint')).textContent =
			'Run an agent test to see performance metrics.';
		const suggestion = append(empty, $('p.agent-perf-empty-suggestion'));
		suggestion.textContent = 'Tip: Open the ';
		append(suggestion, $('span.codicon.codicon-beaker'));
		suggestion.appendChild(document.createTextNode(' Sandbox tab to run an agent and collect performance data.'));
	}

	// ─── Existing / Updated Renderers ───────────────────────────

	private renderMetricCard(
		parent: HTMLElement,
		label: string,
		value: string,
		icon: string,
	): void {
		const card = append(parent, $('.agent-perf-summary-card'));
		append(card, $('span.agent-perf-summary-icon.codicon')).className = `agent-perf-summary-icon codicon ${icon}`;
		append(card, $('.agent-perf-summary-value')).textContent = value;
		append(card, $('.agent-perf-summary-label')).textContent = label;
	}

	private async renderAgentTable(statsArray: AgentUsageStats[]): Promise<void> {
		const tableSection = append(this.container, $('.agent-perf-section'));
		append(tableSection, $('h3.agent-perf-section-title')).textContent = 'Per-Agent Breakdown';

		const table = append(tableSection, $('table.agent-perf-table'));
		const thead = append(table, $('thead'));
		const headerRow = append(thead, $('tr'));
		['Agent', 'Calls', 'Tokens In', 'Tokens Out', 'Avg Latency', 'Success', 'Status'].forEach(h => {
			append(headerRow, $('th')).textContent = h;
		});

		const tbody = append(table, $('tbody'));
		for (const stats of statsArray) {
			let agentName = stats.agentId;
			try {
				const def = await this.agentMgmtService.getDefinition(stats.agentId);
				agentName = def?.name ?? stats.agentId;
			} catch { /* use agentId as fallback */ }

			const row = append(tbody, $('tr'));
			append(row, $('td')).textContent = agentName;
			append(row, $('td')).textContent = String(stats.totalCalls);
			append(row, $('td')).textContent = this.formatTokens(stats.totalTokensIn);
			append(row, $('td')).textContent = this.formatTokens(stats.totalTokensOut);
			append(row, $('td')).textContent = `${stats.avgLatencyMs}ms`;
			append(row, $('td')).textContent = `${(stats.successRate * 100).toFixed(1)}%`;

			// Status badge
			const statusCell = append(row, $('td'));
			const statusBadge = append(statusCell, $('span.agent-perf-status-badge'));
			const status = stats.status ?? 'inactive';
			statusBadge.textContent = status;
			statusBadge.classList.add(`agent-perf-status-${status}`);
		}
	}

	/**
	 * Recent Run Summary (agentic-os: auto-reflection pattern).
	 * Generates a summary of the most recent run and suggested actions.
	 */
	private renderRecentRunSummary(statsArray: AgentUsageStats[]): void {
		const section = append(this.container, $('.agent-perf-section'));
		append(section, $('h3.agent-perf-section-title')).textContent = 'Recent Run Summary';

		const summaryContent = append(section, $('.agent-perf-run-summary'));

		// Suggestions based on data analysis
		const suggestions: string[] = [];
		for (const stats of statsArray) {
			if (stats.status === 'error') {
				suggestions.push(`Agent "${stats.agentId}" is in error state — review recent failures and consider adjusting config.`);
			} else if (stats.status === 'degraded') {
				suggestions.push(`Agent "${stats.agentId}" is degraded (${(stats.successRate * 100).toFixed(1)}% success) — check error breakdown for patterns.`);
			}
			if (stats.p95LatencyMs !== undefined && stats.p95LatencyMs > 5000) {
				suggestions.push(`Agent "${stats.agentId}" has high P95 latency (${Math.round(stats.p95LatencyMs)}ms) — consider model or prompt optimization.`);
			}
		}

		if (suggestions.length === 0) {
			append(summaryContent, $('p.agent-perf-run-summary-ok')).textContent =
				'All agents are performing within expected parameters. No issues detected.';
		} else {
			const suggestionsList = append(summaryContent, $('ul.agent-perf-run-suggestions'));
			for (const s of suggestions) {
				append(suggestionsList, $('li')).textContent = s;
			}
		}
	}

	// ─── Error State ────────────────────────────────────────────

	private renderError(message: string): void {
		const error = append(this.container, $('.agent-perf-error'));
		append(error, $('span.codicon.codicon-error'));
		append(error, $('p')).textContent = `Error loading performance data: ${message}`;
		const retryBtn = append(error, $('button.agent-perf-retry-btn'));
		retryBtn.textContent = 'Retry';
		this._register(addDisposableListener(retryBtn, 'click', () => this.render()));
	}

	// ─── Utility ────────────────────────────────────────────────

	private formatTokens(n: number): string {
		if (n >= 1000000) { return `${(n / 1000000).toFixed(1)}M`; }
		if (n >= 1000) { return `${(n / 1000).toFixed(1)}K`; }
		return String(n);
	}
}