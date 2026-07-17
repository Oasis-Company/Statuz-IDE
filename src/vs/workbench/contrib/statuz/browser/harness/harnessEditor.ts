/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './harness.css';

import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../../workbench/browser/editor.js';
import { EditorExtensions } from '../../../../../workbench/common/editor.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import * as nls from '../../../../../nls.js';
import { localize } from '../../../../../nls.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';

import { EditorPane } from '../../../../../workbench/browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../../../workbench/services/editor/common/editorGroupsService.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IEditorOpenContext } from '../../../../../workbench/common/editor.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Dimension } from '../../../../../base/browser/dom.js';

import { append, $ } from '../../../../../base/browser/dom.js';
import { IViewPaneOptions, ViewPane } from '../../../../../workbench/browser/parts/views/viewPane.js';
import { ViewPaneContainer } from '../../../../../workbench/browser/parts/views/viewPaneContainer.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../../../workbench/common/views.js';
import { Orientation } from '../../../../../base/browser/ui/sash/sash.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';

import { HarnessEditorInput } from './harnessEditorInput.js';
import { HarnessNavBar } from './harnessNavBar.js';
import { HarnessStatusBar } from './harnessStatusBar.js';
import { HarnessSidebar } from './harnessSidebar.js';
import { HarnessCardGrid } from './harnessCardGrid.js';
import { HarnessDetailPanel } from './harnessDetailPanel.js';
import { IAgentManagementService } from '../agentManagementService.js';
import { IAgentSkillItem, IAgentSkillFilter } from '../agentManagement.types.js';

/* ─── Sample Data ────────────────────────────────────────── */

const SAMPLE_ITEMS: IAgentSkillItem[] = [
	{
		id: 'typescript-reviewer', name: 'TypeScript Reviewer', type: 'agent',
		description: 'Expert TypeScript/JavaScript code reviewer specializing in type safety, async correctness, and idiomatic patterns.',
		version: '2.1.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-review', installPath: '~/.trae/agents/typescript-reviewer/',
		config: { strictness: 'high' }, lastUsed: Date.now() - 3600000, usageCount: 128,
		tags: ['typescript', 'review', 'code-quality'], category: 'Agent Engineering'
	},
	{
		id: 'react-reviewer', name: 'React Reviewer', type: 'agent',
		description: 'Specialized React code reviewer covering hooks, component patterns, performance, and accessibility.',
		version: '1.8.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-review', installPath: '~/.trae/agents/react-reviewer/',
		config: { strictness: 'moderate' }, lastUsed: Date.now() - 7200000, usageCount: 95,
		tags: ['react', 'review', 'frontend'], category: 'Agent Engineering'
	},
	{
		id: 'agent-arch-audit', name: 'Agent Architecture Audit', type: 'skill',
		description: 'Full-stack diagnostic for agent and LLM applications. Audits the 12-layer agent stack for wrapper regression and memory pollution.',
		version: '1.0.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-symbol-struct', installPath: '~/.trae/skills/agent-arch-audit/',
		config: { depth: 'full' }, lastUsed: Date.now() - 86400000, usageCount: 47,
		tags: ['agent', 'diagnostic', 'audit'], category: 'Agent Engineering'
	},
	{
		id: 'harness-construction', name: 'Harness Construction', type: 'skill',
		description: 'Design and optimize AI agent action spaces, tool definitions, and observation formatting for higher completion rates.',
		version: '1.2.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-tools', installPath: '~/.trae/skills/harness-construction/',
		config: { architecture: 'react', toolGranularity: 'medium' }, lastUsed: Date.now() - 43200000, usageCount: 23,
		tags: ['agent', 'optimization', 'design'], category: 'Agent Engineering'
	},
	{
		id: 'api-design', name: 'API Design', type: 'skill',
		description: 'REST API design patterns including resource naming, status codes, pagination, error responses, and versioning.',
		version: '2.0.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-link', installPath: '~/.trae/skills/api-design/',
		config: { format: 'openapi' }, lastUsed: Date.now() - 172800000, usageCount: 156,
		tags: ['api', 'rest', 'design'], category: 'Development Foundations'
	},
	{
		id: 'coding-standards', name: 'Coding Standards', type: 'rule',
		description: 'Baseline cross-project coding conventions for naming, readability, immutability, and code-quality review.',
		version: '1.5.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-checklist', installPath: '~/.trae/rules/coding-standards/',
		config: { strictness: 'high' }, lastUsed: Date.now() - 259200000, usageCount: 203,
		tags: ['standards', 'linting'], category: 'Development Foundations'
	},
	{
		id: 'react-patterns', name: 'React Patterns', type: 'skill',
		description: 'React 18/19 patterns including hooks discipline, server/client component boundaries, Suspense, and state management.',
		version: '3.0.0', author: 'ECC Team', state: 'disabled',
		iconCodicon: 'codicon-symbol-namespace', installPath: '~/.trae/skills/react-patterns/',
		config: { version: '19' }, lastUsed: Date.now() - 604800000, usageCount: 67,
		tags: ['react', 'frontend', 'patterns'], category: 'Frontend & UI'
	},
	{
		id: 'e2e-testing', name: 'E2E Testing', type: 'skill',
		description: 'Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, and flaky test strategies.',
		version: '1.3.0', author: 'ECC Team', state: 'disabled',
		iconCodicon: 'codicon-beaker', installPath: '~/.trae/skills/e2e-testing/',
		config: { framework: 'playwright' }, lastUsed: Date.now() - 1209600000, usageCount: 34,
		tags: ['testing', 'e2e', 'playwright'], category: 'Testing & Quality'
	},
	{
		id: 'security-review', name: 'Security Review', type: 'skill',
		description: 'Comprehensive security checklist for authentication, input validation, secrets, API endpoints, and payment features.',
		version: '1.1.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-shield', installPath: '~/.trae/skills/security-review/',
		config: { scanDepth: 'deep' }, lastUsed: Date.now() - 1800000, usageCount: 89,
		tags: ['security', 'audit', 'best-practices'], category: 'Testing & Quality'
	},
	{
		id: 'blueprint', name: 'Blueprint', type: 'skill',
		description: 'Turn a one-line objective into a step-by-step construction plan for multi-session, multi-agent engineering projects.',
		version: '1.0.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-map', installPath: '~/.trae/skills/blueprint/',
		config: { format: 'detailed' }, lastUsed: Date.now() - 86400000, usageCount: 42,
		tags: ['planning', 'architecture', 'multi-agent'], category: 'Planning & Architecture'
	},
	{
		id: 'ecc-catalog', name: 'ECC Catalog', type: 'command',
		description: 'Browse and manage the full ECC (Everything Claude Code) catalog of agents, skills, commands, and rules.',
		version: '1.0.0', author: 'ECC Team', state: 'enabled',
		iconCodicon: 'codicon-package', installPath: '~/.trae/commands/ecc-catalog/',
		config: { autoRefresh: true }, lastUsed: Date.now() - 14400000, usageCount: 12,
		tags: ['ecc', 'catalog', 'management'], category: 'Operations'
	},
	{
		id: 'cost-tracking', name: 'Cost Tracking', type: 'skill',
		description: 'Track and report token usage, spending, and budgets. Views cost breakdowns by project, tool, session, or date.',
		version: '0.9.0', author: 'ECC Team', state: 'disabled',
		iconCodicon: 'codicon-credit-card', installPath: '~/.trae/skills/cost-tracking/',
		config: { budget: 50 }, lastUsed: Date.now() - 604800000, usageCount: 18,
		tags: ['cost', 'tracking', 'analytics'], category: 'Operations'
	},
];

/* ─── HarnessEditor ──────────────────────────────────────── */

export class HarnessEditor extends EditorPane {

	static readonly ID: string = 'workbench.editor.statuzHarness';

	private rootElement!: HTMLElement;
	private navBar!: HarnessNavBar;
	private sidebar!: HarnessSidebar;
	private cardGrid!: HarnessCardGrid;
	private detailPanel!: HarnessDetailPanel;
	private statusBar!: HarnessStatusBar;
	private sidebarContainer!: HTMLElement;
	private cardGridContainer!: HTMLElement;
	private detailPanelContainer!: HTMLElement;

	private items: IAgentSkillItem[] = SAMPLE_ITEMS;
	private currentTab: 'catalog' | 'installed' | 'harness' | 'config' = 'catalog';
	private currentFilter: IAgentSkillFilter = {
		query: '', type: 'all', state: 'all',
		sortBy: 'name', sortAsc: true,
	};

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IAgentManagementService private readonly agentMgmtService: IAgentManagementService,
	) {
		super(HarnessEditor.ID, group, telemetryService, themeService, storageService);
	}

	override getId(): string {
		return HarnessEditor.ID;
	}

	// ─── createEditor ───────────────────────────────────────

	protected createEditor(parent: HTMLElement): void {
		parent.setAttribute('tabindex', '-1');
		this.rootElement = document.createElement('div');
		this.rootElement.className = 'harness-editor';
		parent.appendChild(this.rootElement);

		// Nav bar
		this.navBar = new HarnessNavBar(this.rootElement, (tab) => this.onTabSwitch(tab));

		// Main content area (sidebar + card grid + detail panel)
		const mainArea = document.createElement('div');
		mainArea.className = 'harness-main-area';
		this.rootElement.appendChild(mainArea);

		this.sidebarContainer = document.createElement('div');
		this.sidebarContainer.className = 'harness-sidebar';
		mainArea.appendChild(this.sidebarContainer);

		this.cardGridContainer = document.createElement('div');
		this.cardGridContainer.className = 'harness-card-grid-container';
		mainArea.appendChild(this.cardGridContainer);

		this.detailPanelContainer = document.createElement('div');
		this.detailPanelContainer.className = 'harness-detail-panel';
		mainArea.appendChild(this.detailPanelContainer);

		// Status bar
		this.statusBar = new HarnessStatusBar(this.rootElement);

		// Create child components
		this.sidebar = new HarnessSidebar(this.sidebarContainer, (filter) => this.onFilterChange(filter));
		this.cardGrid = new HarnessCardGrid(this.cardGridContainer, (item) => this.onCardSelect(item));
		this.detailPanel = new HarnessDetailPanel(this.detailPanelContainer);

		// Initial render
		this.renderCurrentTab();
	}

	// ─── setInput ───────────────────────────────────────────

	override async setInput(
		input: HarnessEditorInput,
		options: IEditorOptions | undefined,
		context: IEditorOpenContext,
		token: CancellationToken
	): Promise<void> {
		await super.setInput(input, options, context, token);
		if (token.isCancellationRequested) {
			return;
		}
		this.renderCurrentTab();
	}

	// ─── layout ─────────────────────────────────────────────

	override layout(dimension: Dimension): void {
		if (!this.rootElement) {
			return;
		}
		this.rootElement.style.height = `${dimension.height}px`;
		this.rootElement.style.width = `${dimension.width}px`;
	}

	// ─── Tab Switching ──────────────────────────────────────

	private onTabSwitch(tab: 'catalog' | 'installed' | 'harness' | 'config'): void {
		this.currentTab = tab;
		this.renderCurrentTab();
	}

	private renderCurrentTab(): void {
		switch (this.currentTab) {
			case 'catalog':
				this.renderCatalogView();
				break;
			case 'installed':
				this.renderInstalledView();
				break;
			case 'harness':
				this.renderHarnessDashboard();
				break;
			case 'config':
				this.renderConfigView();
				break;
		}
	}

	// ─── Catalog View ───────────────────────────────────────

	private renderCatalogView(): void {
		this.sidebarContainer.style.display = '';
		this.detailPanelContainer.style.display = '';
		this.sidebar.show(this.items);
		this.cardGrid.render(this.items, this.currentFilter);
		this.statusBar.update(this.items.length, 12, 8);
	}

	// ─── Installed View ─────────────────────────────────────

	private renderInstalledView(): void {
		this.sidebarContainer.style.display = '';
		this.detailPanelContainer.style.display = '';
		const installed = this.items.filter(i => i.state === 'enabled' || i.state === 'error');
		this.sidebar.show(installed);
		this.cardGrid.render(installed, this.currentFilter);
		this.statusBar.update(this.items.length, installed.length, installed.filter(i => i.state === 'enabled').length);
	}

	// ─── Harness Dashboard ──────────────────────────────────

	private renderHarnessDashboard(): void {
		this.sidebarContainer.style.display = 'none';
		this.detailPanelContainer.style.display = 'none';
		this.cardGrid.renderDashboard(this.items);
		this.statusBar.update(this.items.length, 12, 8);
	}

	// ─── Config View ────────────────────────────────────────

	private renderConfigView(): void {
		this.sidebarContainer.style.display = 'none';
		this.detailPanelContainer.style.display = 'none';
		this.cardGrid.renderConfigView();
		this.statusBar.update(this.items.length, 12, 8);
	}

	// ─── Filter & Select ────────────────────────────────────

	private onFilterChange(filter: IAgentSkillFilter): void {
		this.currentFilter = filter;
		this.cardGrid.render(this.items, this.currentFilter);
	}

	private onCardSelect(item: IAgentSkillItem): void {
		this.detailPanel.show(item, {
			onInstall: (id) => this.handleInstall(id),
			onUninstall: (id) => this.handleUninstall(id),
			onToggle: (id, state) => this.handleToggle(id, state),
			onConfigSave: (id, config) => this.handleConfigSave(id, config),
		});
	}

	// ─── Actions ────────────────────────────────────────────

	private handleInstall(_id: string): void {
		// TODO: Phase 3 — actual install to .trae/
		console.log('[Harness] Install:', _id);
	}

	private handleUninstall(_id: string): void {
		// TODO: Phase 3 — actual uninstall from .trae/
		console.log('[Harness] Uninstall:', _id);
	}

	private handleToggle(id: string, state: 'enabled' | 'disabled'): void {
		this.agentMgmtService.setItemState(id, state);
		const item = this.items.find(i => i.id === id);
		if (item) {
			item.state = state;
			this.cardGrid.render(this.items, this.currentFilter);
			this.detailPanel.show(item, {
				onInstall: (i) => this.handleInstall(i),
				onUninstall: (i) => this.handleUninstall(i),
				onToggle: (i, s) => this.handleToggle(i, s),
				onConfigSave: (i, c) => this.handleConfigSave(i, c),
			});
		}
	}

	private handleConfigSave(id: string, config: Record<string, any>): void {
		this.agentMgmtService.updateConfig(id, config);
		const item = this.items.find(i => i.id === id);
		if (item) {
			item.config = { ...item.config, ...config };
		}
	}

	// ─── Dispose ────────────────────────────────────────────

	override dispose(): void {
		this.navBar?.dispose();
		this.sidebar?.dispose();
		this.cardGrid?.dispose();
		this.detailPanel?.dispose();
		this.statusBar?.dispose();
		super.dispose();
	}
}

// ===== Registration =====

registerIcon(
	'statuz-harness-view-icon',
	Codicon.symbolMethod,
	localize('statuzHarnessViewIcon', 'View icon of the Agent Management harness view.')
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		HarnessEditor,
		HarnessEditor.ID,
		nls.localize('harnessEditor', 'Agent Management')
	),
	[
		new SyncDescriptor(HarnessEditorInput)
	]
);

// ===== Open action =====

export const STATUZ_OPEN_HARNESS_ACTION_ID = 'statuz.openHarness';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: STATUZ_OPEN_HARNESS_ACTION_ID,
			title: nls.localize2('openStatuzHarness', 'Open Agent Management'),
			f1: true,
		});
	}
	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		editorService.openEditor(new HarnessEditorInput());
	}
});

// ===== Activity Bar — Redirect ViewPane =====

export const STATUZ_HARNESS_REDIRECT_VIEW_CONTAINER_ID = 'workbench.view.statuzHarness';
export const STATUZ_HARNESS_REDIRECT_VIEW_ID = 'workbench.view.statuzHarness.redirect';

class HarnessRedirectViewPane extends ViewPane {

	private container!: HTMLElement;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		this.container = append(parent, $('.harness-sidebar-redirect'));
		this.container.style.display = 'flex';
		this.container.style.flexDirection = 'column';
		this.container.style.alignItems = 'center';
		this.container.style.justifyContent = 'center';
		this.container.style.height = '100%';
		this.container.style.padding = '24px';
		this.container.style.gap = '16px';
		this.container.style.textAlign = 'center';

		const icon = append(this.container, $('span.codicon.codicon.symbol-method'));
		icon.style.fontSize = '48px';
		icon.style.opacity = '0.3';

		const title = append(this.container, $('h3'));
		title.textContent = 'Agent Management';
		title.style.margin = '0';
		title.style.fontSize = '16px';

		const desc = append(this.container, $('p'));
		desc.textContent = 'The Agent Management panel has moved to the full-page editor.';
		desc.style.fontSize = '12px';
		desc.style.color = 'var(--vscode-descriptionForeground)';
		desc.style.margin = '0';
		desc.style.maxWidth = '200px';

		const btn = append(this.container, $('button'));
		btn.textContent = 'Open Full Editor';
		btn.style.padding = '8px 16px';
		btn.style.border = '1px solid var(--vscode-button-border, transparent)';
		btn.style.borderRadius = '4px';
		btn.style.backgroundColor = 'var(--vscode-button-background)';
		btn.style.color = 'var(--vscode-button-foreground)';
		btn.style.cursor = 'pointer';
		btn.style.fontSize = '12px';

		btn.addEventListener('click', () => {
			this.editorService.openEditor(new HarnessEditorInput());
		});
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		if (this.container) {
			this.container.style.height = `${height}px`;
		}
	}
}

// Register the view container for the activity bar icon
const harnessRedirectViewIcon = registerIcon(
	'statuz-harness-redirect-icon',
	Codicon.symbolMethod,
	localize('statuzHarnessRedirectIcon', 'View icon of the Agent Management harness redirect view.')
);

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const harnessContainer = viewContainerRegistry.registerViewContainer({
	id: STATUZ_HARNESS_REDIRECT_VIEW_CONTAINER_ID,
	title: nls.localize2('statuzHarnessRedirect', 'Agent Management'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [STATUZ_HARNESS_REDIRECT_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 2.7,
	rejectAddedViews: true,
	icon: harnessRedirectViewIcon,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true, isDefault: false });

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: STATUZ_HARNESS_REDIRECT_VIEW_ID,
	name: nls.localize2('statuzHarnessRedirect', 'Agent Management'),
	ctorDescriptor: new SyncDescriptor(HarnessRedirectViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 80,
	order: 1,
}], harnessContainer);