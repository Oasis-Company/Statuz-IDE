/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';

import * as nls from '../../../../nls.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';

import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';

import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';

import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { FileAccess } from '../../../../base/common/network.js';
import { IStatuzService } from './statuz/statuzService.js';
import { buildDashboardViewModel, type DashboardViewModel } from './statuz/statuzViewModel.js';


// ─── CSS (injected once) ───────────────────────────────────────

const DASHBOARD_CSS = `
.statuz-dashboard {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
	font-family: var(--vscode-font-family);
	font-size: 13px;
	color: var(--vscode-foreground);
}
.statuz-dashboard-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px 8px;
	border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
	flex-shrink: 0;
}
.statuz-dashboard-header h3 {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	color: var(--vscode-foreground);
}
.statuz-dashboard-refresh {
	background: none;
	border: 1px solid var(--vscode-button-border);
	color: var(--vscode-foreground);
	border-radius: 3px;
	padding: 2px 10px;
	font-size: 12px;
	cursor: pointer;
	font-family: var(--vscode-font-family);
}
.statuz-dashboard-refresh:hover {
	background: var(--vscode-toolbar-hoverBackground);
}
.statuz-dashboard-scroll {
	flex: 1;
	overflow-y: auto;
	padding: 12px 16px 16px;
}
.statuz-dashboard-footer {
	padding: 6px 16px;
	border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	flex-shrink: 0;
	display: flex;
	justify-content: space-between;
}

/* Cards */
.statuz-card {
	background: var(--vscode-editor-background);
	border: 1px solid var(--vscode-sideBarSectionHeader-border);
	border-radius: 6px;
	margin-bottom: 12px;
	overflow: hidden;
}
.statuz-card-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 12px;
	background: var(--vscode-sideBar-background);
	border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--vscode-descriptionForeground);
}
.statuz-card-body {
	padding: 10px 12px;
}

/* Identity Card */
.statuz-identity-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 6px 16px;
}
.statuz-identity-item {
	display: flex;
	flex-direction: column;
	gap: 1px;
}
.statuz-identity-label {
	font-size: 10px;
	color: var(--vscode-descriptionForeground);
	text-transform: uppercase;
	letter-spacing: 0.3px;
}
.statuz-identity-value {
	font-size: 13px;
	font-weight: 500;
}

/* State Card */
.statuz-state-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px 16px;
}
.statuz-state-item {
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.statuz-state-label {
	font-size: 10px;
	color: var(--vscode-descriptionForeground);
	text-transform: uppercase;
}
.statuz-state-value {
	font-size: 13px;
}
.statuz-status-badge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: 500;
}
.statuz-status-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex-shrink: 0;
}

/* Progress Card */
.statuz-progress-bar-container {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 10px;
}
.statuz-progress-bar {
	flex: 1;
	height: 6px;
	background: var(--vscode-progressBar-background);
	border-radius: 3px;
	overflow: hidden;
}
.statuz-progress-fill {
	height: 100%;
	background: var(--vscode-charts-green);
	border-radius: 3px;
	transition: width 0.3s ease;
}
.statuz-progress-text {
	font-size: 12px;
	font-weight: 600;
	color: var(--vscode-charts-green);
	white-space: nowrap;
}
.statuz-progress-lists {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px 16px;
}
.statuz-progress-section h4 {
	margin: 0 0 4px;
	font-size: 11px;
	text-transform: uppercase;
	color: var(--vscode-descriptionForeground);
}
.statuz-progress-section ul {
	margin: 0;
	padding-left: 16px;
	font-size: 12px;
	line-height: 1.6;
}
.statuz-progress-section.completed ul { color: var(--vscode-charts-green); }
.statuz-progress-section.blocked ul { color: var(--vscode-errorForeground); }
.statuz-progress-section.questions ul { color: var(--vscode-charts-yellow); }

/* Timeline */
.statuz-timeline {
	position: relative;
	padding-left: 16px;
}
.statuz-timeline::before {
	content: '';
	position: absolute;
	left: 5px;
	top: 0;
	bottom: 0;
	width: 1px;
	background: var(--vscode-sideBarSectionHeader-border);
}
.statuz-timeline-item {
	position: relative;
	padding: 0 0 12px 14px;
}
.statuz-timeline-item:last-child {
	padding-bottom: 0;
}
.statuz-timeline-dot {
	position: absolute;
	left: -17px;
	top: 4px;
	width: 9px;
	height: 9px;
	border-radius: 50%;
	border: 2px solid var(--vscode-descriptionForeground);
	background: var(--vscode-editor-background);
}
.statuz-timeline-dot.latest {
	border-color: var(--vscode-charts-blue);
	background: var(--vscode-charts-blue);
}
.statuz-timeline-time {
	font-size: 10px;
	color: var(--vscode-descriptionForeground);
}
.statuz-timeline-summary {
	font-size: 13px;
	font-weight: 500;
	margin-top: 2px;
}
.statuz-timeline-next {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	margin-top: 2px;
}

/* Relations */
.statuz-relations-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px 16px;
}
.statuz-relations-section h4 {
	margin: 0 0 4px;
	font-size: 11px;
	text-transform: uppercase;
	color: var(--vscode-descriptionForeground);
}
.statuz-tag-list {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}
.statuz-tag {
	font-size: 11px;
	padding: 1px 6px;
	border-radius: 3px;
	background: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
}

/* Empty State */
.statuz-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	padding: 24px;
	text-align: center;
	color: var(--vscode-descriptionForeground);
}
.statuz-empty-icon {
	font-size: 40px;
	margin-bottom: 12px;
	opacity: 0.4;
}
.statuz-empty-title {
	font-size: 15px;
	font-weight: 600;
	color: var(--vscode-foreground);
	margin: 0 0 6px;
}
.statuz-empty-desc {
	font-size: 12px;
	line-height: 1.5;
	max-width: 260px;
	margin: 0 0 16px;
}
.statuz-empty-action {
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	border: none;
	border-radius: 3px;
	padding: 6px 14px;
	font-size: 12px;
	cursor: pointer;
	font-family: var(--vscode-font-family);
}
.statuz-empty-action:hover {
	background: var(--vscode-button-hoverBackground);
}

/* Error State */
.statuz-error {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	padding: 24px;
	text-align: center;
}
.statuz-error-icon {
	font-size: 40px;
	margin-bottom: 12px;
	opacity: 0.4;
	color: var(--vscode-errorForeground);
}
.statuz-error-title {
	font-size: 15px;
	font-weight: 600;
	color: var(--vscode-errorForeground);
	margin: 0 0 6px;
}
.statuz-error-desc {
	font-size: 12px;
	line-height: 1.5;
	max-width: 280px;
	margin: 0 0 16px;
	color: var(--vscode-descriptionForeground);
}

/* Loading */
.statuz-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: var(--vscode-descriptionForeground);
	font-size: 13px;
}
`;


// ─── ViewPane ──────────────────────────────────────────────────

class DashboardViewPane extends ViewPane {

	private dashboardEl: HTMLElement | null = null;
	private scrollEl: HTMLElement | null = null;
	private footerEl: HTMLElement | null = null;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
		@IStatuzService private readonly statuzService: IStatuzService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService)
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);

		// Inject CSS once
		const styleId = 'statuz-dashboard-styles';
		if (!document.getElementById(styleId)) {
			const style = document.createElement('style');
			style.id = styleId;
			style.textContent = DASHBOARD_CSS;
			document.head.appendChild(style);
		}

		// Create dashboard structure
		this.dashboardEl = document.createElement('div');
		this.dashboardEl.className = 'statuz-dashboard';
		parent.appendChild(this.dashboardEl);

		// Load data
		this.loadDashboard();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

	private async loadDashboard(): Promise<void> {
		if (!this.dashboardEl) return;
		this.showLoading();

		const result = await this.statuzService.readStatuz();

		if (!result.ok || !result.document) {
			this.showError(result.error || 'Unknown error');
			return;
		}

		const vm = buildDashboardViewModel(result.document, result.filePath);
		this.renderDashboard(vm);
	}

	private showLoading(): void {
		if (!this.dashboardEl) return;
		this.dashboardEl.innerHTML = '';
		const loading = document.createElement('div');
		loading.className = 'statuz-loading';
		loading.textContent = 'Loading statuz.yaml...';
		this.dashboardEl.appendChild(loading);
	}

	private showError(message: string): void {
		if (!this.dashboardEl) return;
		this.dashboardEl.innerHTML = '';

		const isNotFound = message.includes('No .statuz/statuz.yaml found');

		if (isNotFound) {
			this.renderEmptyState();
			return;
		}

		const container = document.createElement('div');
		container.className = 'statuz-error';

		const icon = document.createElement('div');
		icon.className = 'statuz-error-icon codicon codicon-warning';

		const title = document.createElement('h3');
		title.className = 'statuz-error-title';
		title.textContent = 'Parse Error';

		const desc = document.createElement('p');
		desc.className = 'statuz-error-desc';
		desc.textContent = message;

		const retryBtn = document.createElement('button');
		retryBtn.className = 'statuz-empty-action';
		retryBtn.textContent = 'Retry';
		retryBtn.addEventListener('click', () => this.loadDashboard());

		container.appendChild(icon);
		container.appendChild(title);
		container.appendChild(desc);
		container.appendChild(retryBtn);
		this.dashboardEl.appendChild(container);
	}

	private renderEmptyState(): void {
		if (!this.dashboardEl) return;

		const container = document.createElement('div');
		container.className = 'statuz-empty';

		const icon = document.createElement('div');
		icon.className = 'statuz-empty-icon codicon codicon-file-code';

		const title = document.createElement('h3');
		title.className = 'statuz-empty-title';
		title.textContent = 'No statuz.yaml Found';

		const desc = document.createElement('p');
		desc.className = 'statuz-empty-desc';
		desc.textContent = 'Create a .statuz/statuz.yaml file in your workspace root to power this dashboard with agent status data.';

		const actionBtn = document.createElement('button');
		actionBtn.className = 'statuz-empty-action';
		actionBtn.textContent = 'Retry';
		actionBtn.addEventListener('click', () => this.loadDashboard());

		container.appendChild(icon);
		container.appendChild(title);
		container.appendChild(desc);
		container.appendChild(actionBtn);
		this.dashboardEl.appendChild(container);
	}

	private renderDashboard(vm: DashboardViewModel): void {
		if (!this.dashboardEl) return;
		this.dashboardEl.innerHTML = '';

		// Header
		const header = document.createElement('div');
		header.className = 'statuz-dashboard-header';

		const title = document.createElement('h3');
		title.textContent = 'Statuz Dashboard';

		const refreshBtn = document.createElement('button');
		refreshBtn.className = 'statuz-dashboard-refresh';
		refreshBtn.textContent = '\u21bb Refresh';
		refreshBtn.addEventListener('click', () => this.loadDashboard());

		header.appendChild(title);
		header.appendChild(refreshBtn);
		this.dashboardEl.appendChild(header);

		// Scrollable content
		this.scrollEl = document.createElement('div');
		this.scrollEl.className = 'statuz-dashboard-scroll';
		this.dashboardEl.appendChild(this.scrollEl);

		// Cards
		this.renderIdentityCard(vm);
		this.renderStateCard(vm);
		this.renderProgressCard(vm);
		this.renderTimelineCard(vm);
		this.renderRelationsCard(vm);
		this.renderRulesCard(vm);

		// Footer
		this.footerEl = document.createElement('div');
		this.footerEl.className = 'statuz-dashboard-footer';

		const fileInfo = document.createElement('span');
		fileInfo.textContent = vm.filePath ? `Source: ${vm.filePath}` : '';

		const updateInfo = document.createElement('span');
		updateInfo.textContent = vm.updatedAt ? `Updated: ${new Date(vm.updatedAt).toLocaleString()}` : '';

		this.footerEl.appendChild(fileInfo);
		this.footerEl.appendChild(updateInfo);
		this.dashboardEl.appendChild(this.footerEl);
	}

	private renderIdentityCard(vm: DashboardViewModel): void {
		const card = this.createCard('Identity');
		const grid = document.createElement('div');
		grid.className = 'statuz-identity-grid';

		const items: [string, string][] = [
			['Agent', vm.identity.agentName],
			['Project', vm.identity.projectName],
			['Role', vm.identity.roleName],
			['Organization', vm.identity.organization],
			['Environment', vm.identity.environment],
		];

		for (const [label, value] of items) {
			const item = document.createElement('div');
			item.className = 'statuz-identity-item';
			const lbl = document.createElement('span');
			lbl.className = 'statuz-identity-label';
			lbl.textContent = label;
			const val = document.createElement('span');
			val.className = 'statuz-identity-value';
			val.textContent = value;
			item.appendChild(lbl);
			item.appendChild(val);
			grid.appendChild(item);
		}

		card.querySelector('.statuz-card-body')!.appendChild(grid);
		this.scrollEl!.appendChild(card);
	}

	private renderStateCard(vm: DashboardViewModel): void {
		const card = this.createCard('Current State');

		// Status badge
		const badgeRow = document.createElement('div');
		badgeRow.style.cssText = 'margin-bottom:10px;';

		const badge = document.createElement('span');
		badge.className = 'statuz-status-badge';
		badge.style.cssText = `background:${vm.state.statusColor}22;color:${vm.state.statusColor};`;

		const dot = document.createElement('span');
		dot.className = 'statuz-status-dot';
		dot.style.backgroundColor = vm.state.statusColor;

		const badgeText = document.createElement('span');
		badgeText.textContent = vm.state.statusLabel;

		badge.appendChild(dot);
		badge.appendChild(badgeText);
		badgeRow.appendChild(badge);

		// Grid
		const grid = document.createElement('div');
		grid.className = 'statuz-state-row';

		const stateItems: [string, string][] = [
			['Stage', vm.state.stageLabel],
			['Task', vm.state.task],
			['Last Checkpoint', vm.state.lastCheckpoint],
			['Next Action', vm.state.nextAction],
		];

		for (const [label, value] of stateItems) {
			const item = document.createElement('div');
			item.className = 'statuz-state-item';
			const lbl = document.createElement('span');
			lbl.className = 'statuz-state-label';
			lbl.textContent = label;
			const val = document.createElement('span');
			val.className = 'statuz-state-value';
			val.textContent = value;
			item.appendChild(lbl);
			item.appendChild(val);
			grid.appendChild(item);
		}

		const body = card.querySelector('.statuz-card-body')!;
		body.appendChild(badgeRow);
		body.appendChild(grid);
		this.scrollEl!.appendChild(card);
	}

	private renderProgressCard(vm: DashboardViewModel): void {
		const card = this.createCard('Progress');
		const body = card.querySelector('.statuz-card-body')!;

		// Progress bar
		const barContainer = document.createElement('div');
		barContainer.className = 'statuz-progress-bar-container';

		const bar = document.createElement('div');
		bar.className = 'statuz-progress-bar';

		const fill = document.createElement('div');
		fill.className = 'statuz-progress-fill';
		fill.style.width = `${vm.progress.percentComplete}%`;

		const text = document.createElement('span');
		text.className = 'statuz-progress-text';
		text.textContent = `${vm.progress.percentComplete}%`;

		bar.appendChild(fill);
		barContainer.appendChild(bar);
		barContainer.appendChild(text);
		body.appendChild(barContainer);

		// Lists
		const lists = document.createElement('div');
		lists.className = 'statuz-progress-lists';

		// Completed
		if (vm.progress.completedItems.length > 0) {
			const section = document.createElement('div');
			section.className = 'statuz-progress-section completed';
			const h4 = document.createElement('h4');
			h4.textContent = `\u2713 Completed (${vm.progress.completedCount})`;
			const ul = document.createElement('ul');
			for (const item of vm.progress.completedItems) {
				const li = document.createElement('li');
				li.textContent = item;
				ul.appendChild(li);
			}
			section.appendChild(h4);
			section.appendChild(ul);
			lists.appendChild(section);
		}

		// Blocked
		if (vm.progress.blockedItems.length > 0) {
			const section = document.createElement('div');
			section.className = 'statuz-progress-section blocked';
			const h4 = document.createElement('h4');
			h4.textContent = `\u2298 Blocked (${vm.progress.blockedCount})`;
			const ul = document.createElement('ul');
			for (const item of vm.progress.blockedItems) {
				const li = document.createElement('li');
				li.textContent = item;
				ul.appendChild(li);
			}
			section.appendChild(h4);
			section.appendChild(ul);
			lists.appendChild(section);
		}

		// Open questions
		if (vm.progress.openQuestions.length > 0) {
			const section = document.createElement('div');
			section.className = 'statuz-progress-section questions';
			const h4 = document.createElement('h4');
			h4.textContent = `? Questions (${vm.progress.openQuestionsCount})`;
			const ul = document.createElement('ul');
			for (const item of vm.progress.openQuestions) {
				const li = document.createElement('li');
				li.textContent = item;
				ul.appendChild(li);
			}
			section.appendChild(h4);
			section.appendChild(ul);
			lists.appendChild(section);
		}

		if (lists.children.length > 0) {
			body.appendChild(lists);
		} else {
			const empty = document.createElement('div');
			empty.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground);';
			empty.textContent = 'No progress items tracked yet.';
			body.appendChild(empty);
		}

		this.scrollEl!.appendChild(card);
	}

	private renderTimelineCard(vm: DashboardViewModel): void {
		const card = this.createCard('Checkpoint Timeline');
		const body = card.querySelector('.statuz-card-body')!;

		if (vm.checkpoints.length === 0) {
			const empty = document.createElement('div');
			empty.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground);';
			empty.textContent = 'No checkpoints recorded yet.';
			body.appendChild(empty);
			this.scrollEl!.appendChild(card);
			return;
		}

		const timeline = document.createElement('div');
		timeline.className = 'statuz-timeline';

		for (const cp of vm.checkpoints) {
			const item = document.createElement('div');
			item.className = 'statuz-timeline-item';

			const dot = document.createElement('div');
			dot.className = 'statuz-timeline-dot' + (cp.isLatest ? ' latest' : '');
			item.appendChild(dot);

			const time = document.createElement('div');
			time.className = 'statuz-timeline-time';
			time.textContent = cp.timeFormatted;

			const summary = document.createElement('div');
			summary.className = 'statuz-timeline-summary';
			summary.textContent = cp.summary;

			item.appendChild(time);
			item.appendChild(summary);

			if (cp.nextAction) {
				const next = document.createElement('div');
				next.className = 'statuz-timeline-next';
				next.textContent = `\u2192 ${cp.nextAction}`;
				item.appendChild(next);
			}

			timeline.appendChild(item);
		}

		body.appendChild(timeline);
		this.scrollEl!.appendChild(card);
	}

	private renderRelationsCard(vm: DashboardViewModel): void {
		const card = this.createCard('Relations');
		const body = card.querySelector('.statuz-card-body')!;

		if (!vm.relations.hasAny) {
			const empty = document.createElement('div');
			empty.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground);';
			empty.textContent = 'No relations defined.';
			body.appendChild(empty);
			this.scrollEl!.appendChild(card);
			return;
		}

		const grid = document.createElement('div');
		grid.className = 'statuz-relations-grid';

		const sections: [string, string[]][] = [
			['Agents', vm.relations.agents],
			['Projects', vm.relations.projects],
			['Files', vm.relations.files],
			['Tools', vm.relations.tools],
		];

		for (const [label, items] of sections) {
			if (items.length === 0) continue;
			const section = document.createElement('div');
			section.className = 'statuz-relations-section';
			const h4 = document.createElement('h4');
			h4.textContent = label;
			section.appendChild(h4);

			const tagList = document.createElement('div');
			tagList.className = 'statuz-tag-list';
			for (const item of items) {
				const tag = document.createElement('span');
				tag.className = 'statuz-tag';
				tag.textContent = item;
				tagList.appendChild(tag);
			}
			section.appendChild(tagList);
			grid.appendChild(section);
		}

		body.appendChild(grid);
		this.scrollEl!.appendChild(card);
	}

	private renderRulesCard(vm: DashboardViewModel): void {
		const card = this.createCard('Rules');
		const body = card.querySelector('.statuz-card-body')!;

		if (!vm.rules.hasAny) {
			const empty = document.createElement('div');
			empty.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground);';
			empty.textContent = 'No rules defined.';
			body.appendChild(empty);
			this.scrollEl!.appendChild(card);
			return;
		}

		if (vm.rules.shoulds.length > 0) {
			const section = document.createElement('div');
			section.style.cssText = 'margin-bottom:8px;';
			const h4 = document.createElement('h4');
			h4.style.cssText = 'margin:0 0 4px;font-size:11px;text-transform:uppercase;color:var(--vscode-charts-green);';
			h4.textContent = 'Should';
			section.appendChild(h4);
			const ul = document.createElement('ul');
			ul.style.cssText = 'margin:0;padding-left:16px;font-size:12px;line-height:1.6;';
			for (const rule of vm.rules.shoulds) {
				const li = document.createElement('li');
				li.textContent = rule;
				ul.appendChild(li);
			}
			section.appendChild(ul);
			body.appendChild(section);
		}

		if (vm.rules.shouldNots.length > 0) {
			const section = document.createElement('div');
			const h4 = document.createElement('h4');
			h4.style.cssText = 'margin:0 0 4px;font-size:11px;text-transform:uppercase;color:var(--vscode-errorForeground);';
			h4.textContent = 'Should Not';
			section.appendChild(h4);
			const ul = document.createElement('ul');
			ul.style.cssText = 'margin:0;padding-left:16px;font-size:12px;line-height:1.6;';
			for (const rule of vm.rules.shouldNots) {
				const li = document.createElement('li');
				li.textContent = rule;
				ul.appendChild(li);
			}
			section.appendChild(ul);
			body.appendChild(section);
		}

		this.scrollEl!.appendChild(card);
	}

	private createCard(title: string): HTMLElement {
		const card = document.createElement('div');
		card.className = 'statuz-card';

		const header = document.createElement('div');
		header.className = 'statuz-card-header';
		header.textContent = title;

		const body = document.createElement('div');
		body.className = 'statuz-card-body';

		card.appendChild(header);
		card.appendChild(body);
		return card;
	}
}


// ---------- Register view container ----------

export const STATUZ_DASHBOARD_VIEW_CONTAINER_ID = 'workbench.view.statuzDashboard'
export const STATUZ_DASHBOARD_VIEW_ID = 'workbench.view.statuzDashboard.dashboard'

const dashboardViewIcon = FileAccess.asFileUri('vs/workbench/contrib/statuz/browser/media/statuz-activity-icon.svg');

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const dashboardContainer = viewContainerRegistry.registerViewContainer({
	id: STATUZ_DASHBOARD_VIEW_CONTAINER_ID,
	title: nls.localize2('statuzDashboard', 'Dashboard'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [STATUZ_DASHBOARD_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 2.5,
	rejectAddedViews: true,
	icon: dashboardViewIcon,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true, isDefault: false });


// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: STATUZ_DASHBOARD_VIEW_ID,
	name: nls.localize2('statuzDashboard', 'Dashboard'),
	ctorDescriptor: new SyncDescriptor(DashboardViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 80,
	order: 1,
}], dashboardContainer);


// Open action
export const STATUZ_OPEN_DASHBOARD_ACTION_ID = 'statuz.openDashboard'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: STATUZ_OPEN_DASHBOARD_ACTION_ID,
			title: nls.localize2('openStatuzDashboard', 'Open Statuz Dashboard'),
		})
	}
	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService)
		viewsService.openViewContainer(STATUZ_DASHBOARD_VIEW_CONTAINER_ID);
	}
});
