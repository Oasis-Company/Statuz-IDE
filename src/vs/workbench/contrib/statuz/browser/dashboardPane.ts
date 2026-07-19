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


// ─── CSS ───────────────────────────────────────────────────────

const DASHBOARD_CSS = `
.agent-mgmt-dashboard {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
	font-family: var(--vscode-font-family);
	font-size: 13px;
	color: var(--vscode-foreground);
}
.agent-mgmt-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 16px 12px;
	border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
	flex-shrink: 0;
}
.agent-mgmt-header-left h2 {
	margin: 0;
	font-size: 15px;
	font-weight: 600;
	color: var(--vscode-foreground);
}
.agent-mgmt-header-left p {
	margin: 4px 0 0;
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
}
.agent-mgmt-header-right {
	display: flex;
	gap: 8px;
}
.agent-mgmt-btn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 5px 12px;
	border-radius: 4px;
	font-size: 12px;
	font-family: var(--vscode-font-family);
	cursor: pointer;
	border: 1px solid var(--vscode-button-border);
	background: none;
	color: var(--vscode-foreground);
}
.agent-mgmt-btn:hover {
	background: var(--vscode-toolbar-hoverBackground);
}
.agent-mgmt-btn.primary {
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	border: 1px solid var(--vscode-button-background);
}
.agent-mgmt-btn.primary:hover {
	background: var(--vscode-button-hoverBackground);
}
.agent-mgmt-scroll {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
}

/* Section */
.agent-mgmt-section {
	margin-bottom: 20px;
}
.agent-mgmt-section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10px;
}
.agent-mgmt-section-header h3 {
	margin: 0;
	font-size: 12px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--vscode-descriptionForeground);
}
.agent-mgmt-section-count {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	background: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
	padding: 1px 8px;
	border-radius: 10px;
}

/* Agent Card */
.agent-mgmt-card {
	background: var(--vscode-editor-background);
	border: 1px solid var(--vscode-sideBarSectionHeader-border);
	border-radius: 6px;
	padding: 12px;
	margin-bottom: 8px;
	cursor: pointer;
	transition: background 0.1s ease;
	display: flex;
	align-items: center;
	gap: 12px;
}
.agent-mgmt-card:hover {
	background: var(--vscode-list-hoverBackground);
}
.agent-mgmt-card-icon {
	width: 32px;
	height: 32px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	flex-shrink: 0;
}
.agent-mgmt-card-icon.agent { background: var(--vscode-charts-blue); color: #fff; }
.agent-mgmt-card-icon.skill { background: var(--vscode-charts-purple); color: #fff; }
.agent-mgmt-card-icon.command { background: var(--vscode-charts-orange); color: #fff; }
.agent-mgmt-card-icon.rule { background: var(--vscode-charts-green); color: #fff; }

.agent-mgmt-card-body {
	flex: 1;
	min-width: 0;
}
.agent-mgmt-card-name {
	font-size: 13px;
	font-weight: 500;
	color: var(--vscode-foreground);
}
.agent-mgmt-card-desc {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	margin-top: 2px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.agent-mgmt-card-meta {
	display: flex;
	gap: 8px;
	margin-top: 4px;
	font-size: 10px;
	color: var(--vscode-descriptionForeground);
}
.agent-mgmt-card-actions {
	display: flex;
	gap: 4px;
	flex-shrink: 0;
}
.agent-mgmt-card-action {
	background: none;
	border: 1px solid var(--vscode-button-border);
	color: var(--vscode-foreground);
	border-radius: 3px;
	padding: 2px 8px;
	font-size: 11px;
	cursor: pointer;
	font-family: var(--vscode-font-family);
	white-space: nowrap;
}
.agent-mgmt-card-action:hover {
	background: var(--vscode-toolbar-hoverBackground);
}

/* Vision banner */
.agent-mgmt-vision {
	background: linear-gradient(135deg, var(--vscode-editor-background), var(--vscode-sideBar-background));
	border: 1px solid var(--vscode-sideBarSectionHeader-border);
	border-radius: 8px;
	padding: 16px;
	margin-bottom: 20px;
}
.agent-mgmt-vision h3 {
	margin: 0 0 6px;
	font-size: 14px;
	font-weight: 600;
}
.agent-mgmt-vision p {
	margin: 0;
	font-size: 12px;
	line-height: 1.5;
	color: var(--vscode-descriptionForeground);
	max-width: 320px;
}
.agent-mgmt-vision-pills {
	display: flex;
	gap: 6px;
	margin-top: 10px;
	flex-wrap: wrap;
}
.agent-mgmt-vision-pill {
	font-size: 10px;
	padding: 2px 8px;
	border-radius: 10px;
	border: 1px solid var(--vscode-button-border);
	color: var(--vscode-descriptionForeground);
}

/* Empty state */
.agent-mgmt-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 32px 16px;
	text-align: center;
	color: var(--vscode-descriptionForeground);
}
.agent-mgmt-empty-icon {
	font-size: 36px;
	margin-bottom: 10px;
	opacity: 0.3;
}
.agent-mgmt-empty-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--vscode-foreground);
	margin: 0 0 4px;
}
.agent-mgmt-empty-desc {
	font-size: 12px;
	line-height: 1.5;
	max-width: 240px;
	margin: 0 0 14px;
}
.agent-mgmt-empty-action {
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	border: none;
	border-radius: 4px;
	padding: 6px 16px;
	font-size: 12px;
	cursor: pointer;
	font-family: var(--vscode-font-family);
}
.agent-mgmt-empty-action:hover {
	background: var(--vscode-button-hoverBackground);
}
`;


import { AgentDefinitionWithState } from './agentdef/agentDefinitionTypes.js';


// ─── ViewPane ──────────────────────────────────────────────────

class DashboardViewPane extends ViewPane {

	private dashboardEl: HTMLElement | null = null;
	private scrollEl: HTMLElement | null = null;

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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService)
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);

		const styleId = 'agent-mgmt-dashboard-styles';
		if (!document.getElementById(styleId)) {
			const style = document.createElement('style');
			style.id = styleId;
			style.textContent = DASHBOARD_CSS;
			document.head.appendChild(style);
		}

		this.dashboardEl = document.createElement('div');
		this.dashboardEl.className = 'agent-mgmt-dashboard';
		parent.appendChild(this.dashboardEl);

		this.renderDashboard();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

	private renderDashboard(): void {
		if (!this.dashboardEl) return;
		this.dashboardEl.innerHTML = '';

		// ── Header ──
		const header = document.createElement('div');
		header.className = 'agent-mgmt-header';

		const headerLeft = document.createElement('div');
		headerLeft.className = 'agent-mgmt-header-left';
		const h2 = document.createElement('h2');
		h2.textContent = 'Agent Management';
		const p = document.createElement('p');
		p.textContent = 'Create, customize, and orchestrate your AI agents.';
		headerLeft.appendChild(h2);
		headerLeft.appendChild(p);

		const headerRight = document.createElement('div');
		headerRight.className = 'agent-mgmt-header-right';

		const createBtn = document.createElement('button');
		createBtn.className = 'agent-mgmt-btn primary';
		createBtn.innerHTML = '<span class="codicon codicon-add"></span> New Agent';
		createBtn.addEventListener('click', () => this.showComingSoon('Agent creation wizard will open here.'));

		const importBtn = document.createElement('button');
		importBtn.className = 'agent-mgmt-btn';
		importBtn.innerHTML = '<span class="codicon codicon-cloud-download"></span> Import from ECC';
		importBtn.addEventListener('click', () => this.showComingSoon('ECC import browser will open here.'));

		headerRight.appendChild(createBtn);
		headerRight.appendChild(importBtn);
		header.appendChild(headerLeft);
		header.appendChild(headerRight);
		this.dashboardEl.appendChild(header);

		// ── Scrollable content ──
		this.scrollEl = document.createElement('div');
		this.scrollEl.className = 'agent-mgmt-scroll';
		this.dashboardEl.appendChild(this.scrollEl);

		// ── Vision banner ──
		this.renderVisionBanner();

		// ── My Agents section ──
		this.renderAgentSection('My Agents', 'local', [
			// Placeholder: will be loaded from .statuzide/
		]);

		// ── ECC Catalog section ──
		this.renderAgentSection('ECC Catalog', 'ecc', [
			{
				definition: {
					id: 'ecc:agent:code-reviewer',
					name: 'Code Reviewer',
					kind: 'agent',
					description: 'Automated code review agent with PR analysis',
					source: { type: 'ecc', componentId: 'agent:code-reviewer', eccVersion: '2.0.0' },
					version: '2.0.0',
					author: 'ECC Team',
					icon: 'codicon-symbol-method',
					category: 'Agent Engineering',
					tags: ['code-review', 'pr-analysis', 'ecc'],
					config: {},
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
				state: 'disabled',
				lastUsed: 0,
				usageCount: 0,
			},
			{
				definition: {
					id: 'ecc:skill:test-writer',
					name: 'Test Writer',
					kind: 'skill',
					description: 'Generates unit tests and integration tests',
					source: { type: 'ecc', componentId: 'skill:test-writer', eccVersion: '2.0.0' },
					version: '2.0.0',
					author: 'ECC Team',
					icon: 'codicon-beaker',
					category: 'Agent Engineering',
					tags: ['testing', 'tdd', 'ecc'],
					config: {},
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
				state: 'disabled',
				lastUsed: 0,
				usageCount: 0,
			},
			{
				definition: {
					id: 'ecc:command:refactor',
					name: 'Refactor Assistant',
					kind: 'command',
					description: 'Safe code refactoring with validation',
					source: { type: 'ecc', componentId: 'command:refactor', eccVersion: '2.0.0' },
					version: '2.0.0',
					author: 'ECC Team',
					icon: 'codicon-wrench',
					category: 'Agent Engineering',
					tags: ['refactoring', 'code-quality', 'ecc'],
					config: {},
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
				state: 'disabled',
				lastUsed: 0,
				usageCount: 0,
			},
		]);
	}

	private renderVisionBanner(): void {
		const banner = document.createElement('div');
		banner.className = 'agent-mgmt-vision';

		const h3 = document.createElement('h3');
		h3.textContent = '\u2699 Agent Workbench';

		const p = document.createElement('p');
		p.textContent = 'Design agents with full autonomy. Visual architecture canvas, custom harness engineering, and pipeline orchestration \u2014 all in one workbench.';

		const pills = document.createElement('div');
		pills.className = 'agent-mgmt-vision-pills';
		for (const label of ['Visual Architecture', 'Harness Engineering', 'Pipeline Orchestration', 'ECC Integration', 'Full Autonomy']) {
			const pill = document.createElement('span');
			pill.className = 'agent-mgmt-vision-pill';
			pill.textContent = label;
			pills.appendChild(pill);
		}

		banner.appendChild(h3);
		banner.appendChild(p);
		banner.appendChild(pills);
		this.scrollEl!.appendChild(banner);
	}

	private renderAgentSection(title: string, source: 'local' | 'ecc', agents: AgentDefinitionWithState[]): void {
		const section = document.createElement('div');
		section.className = 'agent-mgmt-section';

		// Section header
		const sectionHeader = document.createElement('div');
		sectionHeader.className = 'agent-mgmt-section-header';
		const h3 = document.createElement('h3');
		h3.textContent = title;
		const count = document.createElement('span');
		count.className = 'agent-mgmt-section-count';
		count.textContent = String(agents.length);
		sectionHeader.appendChild(h3);
		sectionHeader.appendChild(count);
		section.appendChild(sectionHeader);

		if (agents.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'agent-mgmt-empty';
			empty.innerHTML = `
				<div class="agent-mgmt-empty-icon codicon codicon-${source === 'local' ? 'package' : 'library'}"></div>
				<div class="agent-mgmt-empty-title">${source === 'local' ? 'No agents defined yet' : 'Catalog not loaded'}</div>
				<div class="agent-mgmt-empty-desc">${source === 'local' ? 'Create your first custom agent with full control over tools, memory, and context strategy.' : 'Open the ECC catalog to browse and import agent templates.'}</div>
				<button class="agent-mgmt-empty-action">${source === 'local' ? 'Create First Agent' : 'Browse Catalog'}</button>
			`;
			const actionBtn = empty.querySelector('button')!;
			actionBtn.addEventListener('click', () => {
				this.showComingSoon(source === 'local' ? 'Agent creation wizard will open here.' : 'ECC catalog browser will open here.');
			});
			section.appendChild(empty);
		} else {
			for (const agent of agents) {
				section.appendChild(this.renderAgentCard(agent));
			}
		}

		this.scrollEl!.appendChild(section);
	}

	private renderAgentCard(ds: AgentDefinitionWithState): HTMLElement {
		const agent = ds.definition;
		const card = document.createElement('div');
		card.className = 'agent-mgmt-card';
		card.addEventListener('click', () => this.showComingSoon(`Agent editor for "${agent.name}" will open here.`));

		// Icon
		const icon = document.createElement('div');
		icon.className = `agent-mgmt-card-icon ${agent.kind}`;
		const iconMap: Record<string, string> = {
			agent: 'robot',
			skill: 'zap',
			command: 'terminal',
			rule: 'law',
		};
		icon.innerHTML = `<span class="codicon codicon-${iconMap[agent.kind] || 'symbol-misc'}"></span>`;

		// Body
		const body = document.createElement('div');
		body.className = 'agent-mgmt-card-body';

		const name = document.createElement('div');
		name.className = 'agent-mgmt-card-name';
		name.textContent = agent.name;

		const desc = document.createElement('div');
		desc.className = 'agent-mgmt-card-desc';
		desc.textContent = agent.description;

		const meta = document.createElement('div');
		meta.className = 'agent-mgmt-card-meta';
		meta.innerHTML = `<span>${agent.kind}</span><span>v${agent.version}</span><span>${agent.source.type === 'ecc' ? 'ECC' : 'Local'}</span>`;

		body.appendChild(name);
		body.appendChild(desc);
		body.appendChild(meta);

		// Actions
		const actions = document.createElement('div');
		actions.className = 'agent-mgmt-card-actions';

		if (agent.source.type === 'ecc') {
			const installBtn = document.createElement('button');
			installBtn.className = 'agent-mgmt-card-action';
			installBtn.textContent = ds.state === 'enabled' ? 'Uninstall' : 'Install';
			installBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.showComingSoon(`Installing "${agent.name}" from ECC catalog...`);
			});
			actions.appendChild(installBtn);
		} else {
			const editBtn = document.createElement('button');
			editBtn.className = 'agent-mgmt-card-action';
			editBtn.textContent = 'Edit';
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.showComingSoon(`Opening harness editor for "${agent.name}"...`);
			});
			actions.appendChild(editBtn);
		}

		card.appendChild(icon);
		card.appendChild(body);
		card.appendChild(actions);

		return card;
	}

	private showComingSoon(message: string): void {
		// For now, we show a subtle notification. In the future, this will trigger
		// actual editor openings, catalog browsers, and creation wizards.
		console.log('[Agent Management]', message);
	}
}


// ---------- Register view container ----------

export const STATUZ_DASHBOARD_VIEW_CONTAINER_ID = 'workbench.view.statuzDashboard'
export const STATUZ_DASHBOARD_VIEW_ID = 'workbench.view.statuzDashboard.dashboard'

const dashboardViewIcon = FileAccess.asFileUri('vs/workbench/contrib/statuz/browser/media/statuz-activity-icon.svg');

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const dashboardContainer = viewContainerRegistry.registerViewContainer({
	id: STATUZ_DASHBOARD_VIEW_CONTAINER_ID,
	title: nls.localize2('statuzDashboard', 'Agent Management'),
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
	name: nls.localize2('statuzDashboard', 'Agent Management'),
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
			title: nls.localize2('openStatuzDashboard', 'Open Agent Management'),
		})
	}
	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService)
		viewsService.openViewContainer(STATUZ_DASHBOARD_VIEW_CONTAINER_ID);
	}
});