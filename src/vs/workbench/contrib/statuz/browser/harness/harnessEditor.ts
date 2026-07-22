/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

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
import { HarnessNavBar, HarnessTab } from './harnessNavBar.js';
import { HarnessStatusBar } from './harnessStatusBar.js';
import { HarnessSidebar } from './harnessSidebar.js';
import { HarnessCardGrid } from './harnessCardGrid.js';
import { HarnessDetailPanel } from './harnessDetailPanel.js';
import { IAgentManagementService } from '../agentManagementService.js';
import { IAgentLLMService } from './agentLLMService.js';
import { IAgentSkillItem, IAgentSkillFilter, AgentTemplate } from '../agentManagement.types.js';
import { ArchitectureDiagramEngine } from '../diagram/architectureDiagramEngine.js';
import { DiagramStateManager } from '../diagram/diagramStateManager.js';
import { DiagramUndoRedo } from '../diagram/diagramUndoRedo.js';
import { DiagramToolbar } from '../diagram/diagramToolbar.js';
import { agentDiagramDefinition } from '../diagram/agentDiagramDefinition.js';
import { AgentTemplateStore } from './agentTemplateStore.js';
import { AgentSandbox } from './agentSandbox.js';
import { AgentPerformanceDashboard } from './agentPerformanceDashboard.js';
import { AgentRegressionRunner } from './agentRegressionRunner.js';
import { AgentToolCallSimulator } from './agentToolCallSimulator.js';
import { AgentTestSuite, AgentTestCase, AgentTestResult } from './agentRegressionTypes.js';
import { AgentDefinition } from '../agentdef/agentDefinitionTypes.js';
import { clearNode } from '../../../../../base/browser/dom.js';

/* ─── Data ───────────────────────────────────────────────── */

// All data is served by agentManagementService.ts

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
	private agentCanvasContainer!: HTMLElement;
	private engine!: ArchitectureDiagramEngine;
	private diagramStateManager!: DiagramStateManager;
	private diagramUndoRedo!: DiagramUndoRedo;
	private diagramToolbar!: DiagramToolbar;

	private currentTab: HarnessTab = 'catalog';
	private currentFilter: IAgentSkillFilter = {
		query: '', types: [], state: 'all',
		sortBy: 'name', sortAsc: true,
	};
	private templateStore!: AgentTemplateStore;
	private sandbox: AgentSandbox | null = null;
	private regressionRunner!: AgentRegressionRunner;
	private toolSimulator!: AgentToolCallSimulator;
	private regressionSuites: AgentTestSuite[] = [];
	private regressionResults: Map<string, AgentTestResult[]> = new Map();
	private selectedRegressionSuiteId: string | null = null;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService private readonly storageService: IStorageService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IAgentManagementService private readonly agentMgmtService: IAgentManagementService,
		@IAgentLLMService private readonly llmService: IAgentLLMService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
	) {
		super(HarnessEditor.ID, group, telemetryService, themeService, storageService);
		// Reserved for Task 3: openSandbox() passes llmService to AgentSandbox constructor
		if (!this.llmService) {
			// DI injection verified at runtime
		}
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

		// Agent Canvas container (hidden by default, shown for catalog/installed views)
		this.agentCanvasContainer = document.createElement('div');
		this.agentCanvasContainer.className = 'harness-agent-canvas-container';
		this.agentCanvasContainer.style.display = 'none';
		mainArea.appendChild(this.agentCanvasContainer);

		// Status bar
		this.statusBar = new HarnessStatusBar(this.rootElement);

		// Create child components
		this.sidebar = new HarnessSidebar(this.sidebarContainer, (filter) => this.onFilterChange(filter));
		this.cardGrid = new HarnessCardGrid(this.cardGridContainer, (item) => this.onCardSelect(item));
		this.detailPanel = new HarnessDetailPanel(this.detailPanelContainer);
		this.templateStore = new AgentTemplateStore();

		// Initialize unified ArchitectureDiagramEngine with agent definition
		this.diagramStateManager = new DiagramStateManager(agentDiagramDefinition);
		this.diagramUndoRedo = new DiagramUndoRedo();

		// Toolbar container
		const toolbarContainer = document.createElement('div');
		toolbarContainer.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--vscode-panel-border);';
		this.agentCanvasContainer.appendChild(toolbarContainer);

		// Canvas container
		const canvasContainer = document.createElement('div');
		canvasContainer.style.cssText = 'flex:1;position:relative;overflow:hidden;';
		this.agentCanvasContainer.appendChild(canvasContainer);

		// Engine
		this.engine = new ArchitectureDiagramEngine(
			canvasContainer,
			agentDiagramDefinition,
			this.diagramStateManager,
			this.diagramUndoRedo,
			this.contextMenuService,
		);

		// Toolbar
		this.diagramToolbar = new DiagramToolbar(
			toolbarContainer,
			this.engine,
			this.diagramUndoRedo,
			agentDiagramDefinition,
		);

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

	/* ─── Agent Canvas Sync ────────────────────────────────── */

	private syncAgentItems(filteredItems: IAgentSkillItem[]): void {
		const state = this.diagramStateManager.getState();
		const validIds = new Set(filteredItems.map(i => i.id));

		// Remove layouts for items that no longer exist
		for (const layout of state.layouts) {
			if (!validIds.has(layout.id)) {
				this.diagramStateManager.removeNodeLayout(layout.id);
			}
		}

		// Add layouts for new items
		for (const item of filteredItems) {
			const existing = state.layouts.find(l => l.id === item.id);
			if (!existing) {
				this.diagramStateManager.addNodeLayout(item.id, item.type);
			}
		}
	}

	// ─── Tab Switching ──────────────────────────────────────

	private onTabSwitch(tab: HarnessTab): void {
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
			case 'templates':
				this.renderTemplatesView();
				break;
			case 'design':
				this.renderDesignView();
				break;
			case 'harness':
				this.renderHarnessDashboard();
				break;
			case 'sandbox':
				this.renderSandboxView();
				break;
			case 'analytics':
				this.renderAnalyticsView();
				break;
			case 'pipeline':
				this.renderPipelineView();
				break;
			case 'config':
				this.renderConfigView();
				break;
			case 'regression':
				this.renderRegressionView();
				break;
		}
	}

	// ─── Catalog View ───────────────────────────────────────

	private renderCatalogView(): void {
		this.sidebarContainer.style.display = '';
		this.detailPanelContainer.style.display = '';
		this.cardGridContainer.style.display = 'none';
		this.agentCanvasContainer.style.display = '';

		const items = this.agentMgmtService.getItems();
		this.syncAgentItems(items);
		this.engine.updateData(items);
		this.engine.render();
		this.engine.focus();

		const enabled = items.filter(i => i.state === 'enabled').length;
		this.statusBar.update(items.length, enabled, enabled);
	}

	// ─── Installed View ─────────────────────────────────────

	private renderInstalledView(): void {
		this.sidebarContainer.style.display = '';
		this.detailPanelContainer.style.display = '';
		this.cardGridContainer.style.display = 'none';
		this.agentCanvasContainer.style.display = '';

		const items = this.agentMgmtService.getItems();
		const installed = items.filter(i => i.state === 'enabled' || i.state === 'error');
		this.syncAgentItems(installed);
		this.engine.updateData(installed);
		this.engine.render();
		this.engine.focus();

		this.statusBar.update(items.length, installed.length, installed.filter(i => i.state === 'enabled').length);
	}

	// ─── Harness Dashboard ──────────────────────────────────

	private renderHarnessDashboard(): void {
		this.agentCanvasContainer.style.display = 'none';
		this.cardGridContainer.style.display = '';
		this.sidebarContainer.style.display = 'none';
		this.detailPanelContainer.style.display = 'none';
		const items = this.agentMgmtService.getItems();
		this.cardGrid.renderDashboard(items, {
			onInstallRecommended: () => {
				// Install all disabled items
				items.filter(i => i.state === 'disabled').forEach(i => {
					this.handleInstall(i.id);
				});
			},
			onCheckUpdates: () => {
				// Trigger refresh and show status
				this.statusBar.update(items.length, items.filter(i => i.state === 'enabled').length, items.filter(i => i.state === 'enabled').length);
			},
		});
		const enabled = items.filter(i => i.state === 'enabled').length;
		this.statusBar.update(items.length, enabled, enabled);
	}

	// ─── Config View ────────────────────────────────────────

	private renderConfigView(): void {
		this.agentCanvasContainer.style.display = 'none';
		this.cardGridContainer.style.display = '';
		this.sidebarContainer.style.display = 'none';
		this.detailPanelContainer.style.display = 'none';
		this.cardGrid.renderConfigView();
		const items = this.agentMgmtService.getItems();
		const enabled = items.filter(i => i.state === 'enabled').length;
		this.statusBar.update(items.length, enabled, enabled);
	}

	// ─── Regression View ──────────────────────────────────────

	private renderRegressionView(): void {
		this.agentCanvasContainer.style.display = 'none';
		this.cardGridContainer.style.display = '';
		this.sidebarContainer.style.display = '';
		this.detailPanelContainer.style.display = '';

		clearNode(this.cardGridContainer);
		clearNode(this.sidebarContainer);
		clearNode(this.detailPanelContainer);

		// Initialize regression runner on first use
		if (!this.regressionRunner) {
			this.toolSimulator = new AgentToolCallSimulator();
			this.regressionRunner = new AgentRegressionRunner(
				this.llmService,
				this.agentMgmtService,
				this.toolSimulator,
				this.storageService,
			);
		}

		// Load suites from storage
		this.regressionSuites = this.regressionRunner.loadSuites();
		this.regressionResults.clear();
		for (const suite of this.regressionSuites) {
			const results = this.regressionRunner.loadResults(suite.id);
			this.regressionResults.set(suite.id, results);
		}

		// Render left panel: suite list
		this.renderRegressionSuiteList();

		// Render right panel: suite editor + results
		this.renderRegressionMainPanel();
	}

	private renderRegressionSuiteList(): void {
		const sidebar = this.sidebarContainer;

		// Title
		const title = append(sidebar, $('.harness-sidebar-section-title'));
		title.textContent = 'Test Suites';

		// Create new suite button
		const createBtn = append(sidebar, $('button.harness-detail-btn.primary'));
		createBtn.textContent = '+ New Suite';
		createBtn.style.marginBottom = '8px';
		createBtn.style.width = '100%';
		createBtn.addEventListener('click', () => this.createNewRegressionSuite());

		// Suite list
		const list = append(sidebar, $('.agent-regression-suite-list'));

		if (this.regressionSuites.length === 0) {
			const emptyHint = append(list, $('.agent-regression-empty-hint'));
			emptyHint.textContent = 'No suites yet. Click "+ New Suite" to create one.';
			emptyHint.style.fontSize = '11px';
			emptyHint.style.color = 'var(--vscode-descriptionForeground)';
			emptyHint.style.padding = '8px';
			return;
		}

		for (const suite of this.regressionSuites) {
			const entry = append(list, $('.agent-regression-suite-entry'));
			if (suite.id === this.selectedRegressionSuiteId) {
				entry.classList.add('selected');
			}

			const nameSpan = append(entry, $('.agent-regression-suite-name'));
			nameSpan.textContent = suite.name;

			const metaSpan = append(entry, $('.agent-regression-suite-meta'));
			metaSpan.textContent = `${suite.cases.length} case(s)`;

			entry.addEventListener('click', () => {
				this.selectedRegressionSuiteId = suite.id;
				this.renderRegressionSuiteList();
				this.renderRegressionMainPanel();
			});

			// Delete button
			const deleteBtn = append(entry, $('span.codicon.codicon-trash'));
			deleteBtn.style.cursor = 'pointer';
			deleteBtn.style.marginLeft = 'auto';
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.regressionRunner.deleteSuite(suite.id);
				if (this.selectedRegressionSuiteId === suite.id) {
					this.selectedRegressionSuiteId = null;
				}
				this.regressionSuites = this.regressionRunner.loadSuites();
				this.renderRegressionSuiteList();
				this.renderRegressionMainPanel();
			});
		}
	}

	private renderRegressionMainPanel(): void {
		clearNode(this.cardGridContainer);
		clearNode(this.detailPanelContainer);

		const selectedSuite = this.regressionSuites.find(s => s.id === this.selectedRegressionSuiteId);

		if (!selectedSuite) {
			// Empty state
			const emptyState = append(this.cardGridContainer, $('.harness-empty-state'));
			append(emptyState, $('span.codicon.codicon-testing-run-icon'));
			const emptyTitle = append(emptyState, $('h3'));
			emptyTitle.textContent = 'No Test Suites';
			emptyTitle.style.margin = '0';
			const emptyDesc = append(emptyState, $('p'));
			emptyDesc.textContent = 'No test suites yet. Create a regression test suite to validate your agents.';
			emptyDesc.style.margin = '0';
			emptyDesc.style.color = 'var(--vscode-descriptionForeground)';
			return;
		}

		// Main panel: suite form + results
		const mainPanel = append(this.cardGridContainer, $('.agent-regression-main'));
		mainPanel.style.display = 'flex';
		mainPanel.style.flexDirection = 'column';
		mainPanel.style.gap = '16px';
		mainPanel.style.padding = '16px';
		mainPanel.style.overflowY = 'auto';
		mainPanel.style.height = '100%';

		// Suite header
		const header = append(mainPanel, $('.agent-regression-header'));
		header.style.display = 'flex';
		header.style.alignItems = 'center';
		header.style.gap = '12px';

		const suiteNameInput = append(header, $('input.harness-sidebar-search-input')) as HTMLInputElement;
		suiteNameInput.type = 'text';
		suiteNameInput.value = selectedSuite.name;
		suiteNameInput.style.flex = '1';
		suiteNameInput.style.maxWidth = '300px';
		suiteNameInput.placeholder = 'Suite Name';
		suiteNameInput.addEventListener('change', () => {
			const updatedSuite: AgentTestSuite = {
				...selectedSuite,
				name: suiteNameInput.value,
			};
			this.regressionRunner.saveSuite(updatedSuite);
			this.regressionSuites = this.regressionRunner.loadSuites();
		});

		// Agent selector
		const agentSelect = append(header, $('select.harness-sidebar-select')) as HTMLSelectElement;
		agentSelect.style.maxWidth = '200px';
		const agents = this.agentMgmtService.getItems().filter(i => i.state === 'enabled');
		const defaultOption = append(agentSelect, $('option')) as HTMLOptionElement;
		defaultOption.value = '';
		defaultOption.textContent = '-- Select Agent --';
		for (const agent of agents) {
			const opt = append(agentSelect, $('option')) as HTMLOptionElement;
			opt.value = agent.id;
			opt.textContent = agent.name;
			if (agent.id === selectedSuite.agentId) {
				opt.selected = true;
			}
		}
		agentSelect.addEventListener('change', () => {
			const updatedSuite: AgentTestSuite = {
				...selectedSuite,
				agentId: agentSelect.value,
			};
			this.regressionRunner.saveSuite(updatedSuite);
			this.regressionSuites = this.regressionRunner.loadSuites();
		});

		// Run All button
		const runAllBtn = append(header, $('button.agent-sandbox-run-btn')) as HTMLButtonElement;
		runAllBtn.textContent = 'Run All';
		runAllBtn.style.padding = '6px 16px';
		runAllBtn.style.fontSize = '12px';
		runAllBtn.addEventListener('click', async () => {
			runAllBtn.disabled = true;
			runAllBtn.textContent = 'Running...';
			try {
				const results = await this.regressionRunner.runSuite(selectedSuite);
				this.regressionResults.set(selectedSuite.id, results);
				this.renderRegressionMainPanel();
			} catch (err) {
				console.error('[HarnessEditor] Regression run failed:', err);
			} finally {
				runAllBtn.disabled = false;
				runAllBtn.textContent = 'Run All';
			}
		});

		// Add test case button
		const addCaseBtn = append(header, $('button.harness-detail-btn.secondary'));
		addCaseBtn.textContent = '+ Add Case';
		addCaseBtn.style.fontSize = '12px';
		addCaseBtn.addEventListener('click', () => this.addTestCaseToSuite(selectedSuite));

		// Test cases list
		const casesSection = append(mainPanel, $('.agent-regression-cases'));
		casesSection.style.display = 'flex';
		casesSection.style.flexDirection = 'column';
		casesSection.style.gap = '8px';

		const casesTitle = append(casesSection, $('.harness-detail-section-title'));
		casesTitle.textContent = `Test Cases (${selectedSuite.cases.length})`;

		for (const testCase of selectedSuite.cases) {
			const caseRow = append(casesSection, $('.agent-regression-case-row'));
			caseRow.style.display = 'flex';
			caseRow.style.alignItems = 'center';
			caseRow.style.gap = '8px';
			caseRow.style.padding = '8px 12px';
			caseRow.style.border = '1px solid var(--vscode-sideBarSectionHeader-border)';
			caseRow.style.borderRadius = '4px';

			// Case ID
			const caseId = append(caseRow, $('.agent-regression-case-id'));
			caseId.textContent = testCase.id;
			caseId.style.fontSize = '11px';
			caseId.style.fontFamily = 'var(--vscode-editor-font-family)';
			caseId.style.minWidth = '80px';

			// Prompt preview
			const promptPreview = append(caseRow, $('.agent-regression-case-prompt'));
			promptPreview.textContent = testCase.prompt.slice(0, 60) + (testCase.prompt.length > 60 ? '...' : '');
			promptPreview.style.fontSize = '12px';
			promptPreview.style.flex = '1';
			promptPreview.style.overflow = 'hidden';
			promptPreview.style.textOverflow = 'ellipsis';
			promptPreview.style.whiteSpace = 'nowrap';

			// Edit prompt input
			promptPreview.addEventListener('dblclick', () => {
				const input = document.createElement('input') as HTMLInputElement;
				input.type = 'text';
				input.value = testCase.prompt;
				input.style.flex = '1';
				input.style.fontSize = '12px';
				input.style.padding = '4px';
				input.style.border = '1px solid var(--vscode-input-border)';
				input.style.borderRadius = '3px';
				input.style.backgroundColor = 'var(--vscode-input-background)';
				input.style.color = 'var(--vscode-input-foreground)';
				promptPreview.replaceWith(input);
				input.focus();
				input.addEventListener('blur', () => {
					this.updateTestCasePrompt(selectedSuite, testCase.id, input.value);
				});
				input.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') {
						this.updateTestCasePrompt(selectedSuite, testCase.id, input.value);
					}
				});
			});

			// Keywords info
			if (testCase.expectedKeywords && testCase.expectedKeywords.length > 0) {
				const kwBadge = append(caseRow, $('.agent-regression-case-badge'));
				kwBadge.textContent = `${testCase.expectedKeywords.length} kw`;
				kwBadge.style.fontSize = '10px';
				kwBadge.style.padding = '1px 6px';
				kwBadge.style.borderRadius = '3px';
				kwBadge.style.backgroundColor = 'var(--vscode-badge-background)';
				kwBadge.style.color = 'var(--vscode-badge-foreground)';
			}

			// Delete case button
			const deleteCaseBtn = append(caseRow, $('span.codicon.codicon-close'));
			deleteCaseBtn.style.cursor = 'pointer';
			deleteCaseBtn.style.fontSize = '12px';
			deleteCaseBtn.addEventListener('click', () => {
				this.removeTestCaseFromSuite(selectedSuite, testCase.id);
			});
		}

		// Results grid
		const suiteResults = this.regressionResults.get(selectedSuite.id);
		if (suiteResults && suiteResults.length > 0) {
			const resultsSection = append(mainPanel, $('.agent-regression-results'));
			resultsSection.style.display = 'flex';
			resultsSection.style.flexDirection = 'column';
			resultsSection.style.gap = '8px';

			const resultsTitle = append(resultsSection, $('.harness-detail-section-title'));
			resultsTitle.textContent = 'Results';

			const resultGrid = append(resultsSection, $('.agent-regression-result-grid'));

			for (const result of suiteResults) {
				const resultRow = append(resultGrid, $('.agent-regression-result-row'));
				resultRow.classList.add(result.passed ? 'passed' : 'failed');

				// Status indicator
				const statusIcon = append(resultRow, $('span.codicon'));
				statusIcon.className = result.passed ? 'codicon codicon-pass' : 'codicon codicon-error';
				statusIcon.style.fontSize = '14px';

				// Case ID
				const resCaseId = append(resultRow, $('.agent-regression-result-case-id'));
				resCaseId.textContent = result.caseId;
				resCaseId.style.fontSize = '11px';
				resCaseId.style.fontFamily = 'var(--vscode-editor-font-family)';

				// Status text
				const statusText = append(resultRow, $('.agent-regression-result-status'));
				statusText.textContent = result.passed ? 'PASS' : 'FAIL';
				statusText.style.fontSize = '11px';
				statusText.style.fontWeight = '600';

				// Latency
				const latencyText = append(resultRow, $('.agent-regression-result-latency'));
				latencyText.textContent = `${result.metrics.latencyMs}ms`;
				latencyText.style.fontSize = '11px';

				// Failure reason
				if (!result.passed && result.failureReason) {
					const failureText = append(resultRow, $('.agent-regression-result-failure'));
					failureText.textContent = result.failureReason;
					failureText.style.fontSize = '11px';
					failureText.style.color = 'var(--vscode-errorForeground)';
				}

				// Expand button for diff
				if (!result.passed && result.introspection) {
					const expandBtn = append(resultRow, $('span.codicon.codicon-chevron-right'));
					expandBtn.style.cursor = 'pointer';
					expandBtn.style.fontSize = '12px';
					let expanded = false;

					const diffContainer = append(resultsSection, $('.agent-regression-diff'));
					diffContainer.style.display = 'none';

					expandBtn.addEventListener('click', () => {
						expanded = !expanded;
						expandBtn.className = expanded ? 'codicon codicon-chevron-down' : 'codicon codicon-chevron-right';
						if (expanded) {
							diffContainer.style.display = 'block';
							this.renderDiffContent(diffContainer, result);
						} else {
							diffContainer.style.display = 'none';
							clearNode(diffContainer);
						}
					});
				}
			}
		}
	}

	private renderDiffContent(container: HTMLElement, result: AgentTestResult): void {
		clearNode(container);

		if (!result.introspection) {
			return;
		}

		const report = result.introspection;

		// Diff header
		const diffHeader = append(container, $('.agent-regression-diff-header'));
		diffHeader.style.display = 'flex';
		diffHeader.style.flexDirection = 'column';
		diffHeader.style.gap = '4px';
		diffHeader.style.padding = '8px 12px';
		diffHeader.style.borderBottom = '1px solid var(--vscode-sideBarSectionHeader-border)';

		const diffTitle = append(diffHeader, $('span'));
		diffTitle.textContent = 'Introspection Report';
		diffTitle.style.fontWeight = '600';
		diffTitle.style.fontSize = '12px';

		const rootCause = append(diffHeader, $('span'));
		rootCause.textContent = `Root Cause: ${report.rootCause}`;
		rootCause.style.fontSize = '11px';
		rootCause.style.color = 'var(--vscode-descriptionForeground)';

		const suggestion = append(diffHeader, $('span'));
		suggestion.textContent = `Suggestion: ${report.suggestion}`;
		suggestion.style.fontSize = '11px';
		suggestion.style.color = 'var(--vscode-textLink-foreground)';

		// Diff content
		const diffContent = append(container, $('.agent-regression-diff-content'));
		diffContent.style.padding = '8px 12px';
		diffContent.style.fontFamily = 'var(--vscode-editor-font-family)';
		diffContent.style.fontSize = '11px';
		diffContent.style.whiteSpace = 'pre-wrap';
		diffContent.style.lineHeight = '1.5';
		diffContent.textContent = report.diff;
	}

	// ─── Regression Suite Helpers ───────────────────────────────

	private createNewRegressionSuite(): void {
		const id = `suite-${Date.now().toString(36)}`;
		const suite: AgentTestSuite = {
			id,
			name: 'New Test Suite',
			agentId: '',
			cases: [],
			createdAt: Date.now(),
		};
		this.regressionRunner.saveSuite(suite);
		this.regressionSuites = this.regressionRunner.loadSuites();
		this.selectedRegressionSuiteId = id;
		this.renderRegressionSuiteList();
		this.renderRegressionMainPanel();
	}

	private addTestCaseToSuite(suite: AgentTestSuite): void {
		const caseId = `case-${Date.now().toString(36)}`;
		const newCase: AgentTestCase = {
			id: caseId,
			prompt: 'Enter your test prompt here...',
		};
		const updatedSuite: AgentTestSuite = {
			...suite,
			cases: [...suite.cases, newCase],
		};
		this.regressionRunner.saveSuite(updatedSuite);
		this.regressionSuites = this.regressionRunner.loadSuites();
		this.selectedRegressionSuiteId = updatedSuite.id;
		this.renderRegressionSuiteList();
		this.renderRegressionMainPanel();
	}

	private removeTestCaseFromSuite(suite: AgentTestSuite, caseId: string): void {
		const updatedSuite: AgentTestSuite = {
			...suite,
			cases: suite.cases.filter(c => c.id !== caseId),
		};
		this.regressionRunner.saveSuite(updatedSuite);
		this.regressionSuites = this.regressionRunner.loadSuites();
		this.renderRegressionSuiteList();
		this.renderRegressionMainPanel();
	}

	private updateTestCasePrompt(suite: AgentTestSuite, caseId: string, newPrompt: string): void {
		const updatedCases = suite.cases.map(c => {
			if (c.id === caseId) {
				return { ...c, prompt: newPrompt };
			}
			return c;
		});
		const updatedSuite: AgentTestSuite = {
			...suite,
			cases: updatedCases,
		};
		this.regressionRunner.saveSuite(updatedSuite);
		this.regressionSuites = this.regressionRunner.loadSuites();
		this.renderRegressionSuiteList();
		this.renderRegressionMainPanel();
	}

	// ─── Templates View ──────────────────────────────────────

	private renderTemplatesView(): void {
		this.agentCanvasContainer.style.display = 'none';
		this.cardGridContainer.style.display = '';
		this.sidebarContainer.style.display = 'none';
		this.detailPanelContainer.style.display = 'none';

		const templates = this.templateStore.getAllTemplates();
		this.renderTemplateCards(templates);
	}

	private renderTemplateCards(templates: AgentTemplate[]): void {
		const container = this.cardGridContainer;
		clearNode(container);

		const grouped = this.templateStore.getTemplatesByCategory();
		const grid = append(container, $('.harness-template-grid'));

		for (const [category, items] of grouped.entries()) {
			append(grid, $('.harness-category-header')).textContent = category;

			const cardsRow = append(grid, $('.harness-category-grid'));
			for (const tpl of items) {
				const card = append(cardsRow, $('.harness-template-card'));
				card.addEventListener('click', () => this.createAgentFromTemplate(tpl));

				const icon = append(card, $('span.codicon'));
				icon.className = `codicon ${tpl.icon}`;

				const name = append(card, $('.harness-template-card-name'));
				name.textContent = tpl.name;

				const desc = append(card, $('.harness-template-card-desc'));
				desc.textContent = tpl.description;

				const tags = append(card, $('.harness-template-card-tags'));
				tpl.tags.slice(0, 3).forEach(tag => {
					append(tags, $('.harness-template-card-tag')).textContent = tag;
				});
			}
		}
	}

	private async createAgentFromTemplate(template: AgentTemplate): Promise<void> {
		const agentId = `local:${template.id.replace('tmpl-', '')}-${Date.now().toString(36)}`;
		const definition: AgentDefinition = {
			id: agentId,
			name: `${template.name} (from template)`,
			kind: template.kind,
			description: template.defaults.description,
			version: template.defaults.version,
			author: template.defaults.author,
			source: { type: 'local', path: `.statuzide/definitions/${agentId}.yaml` },
			icon: template.icon,
			category: template.category,
			tags: [...template.tags],
			config: template.defaults.config,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		try {
			await this.agentMgmtService.writeDefinition(definition);
			this.currentTab = 'design';
			this.renderCurrentTab();
			const item = this.agentMgmtService.getItem(agentId);
			if (item) {
				this.onCardSelect(item);
			}
		} catch (err) {
			console.error('[HarnessEditor] Failed to create agent from template:', err);
		}
	}

	// ─── Design View ─────────────────────────────────────────

	private renderDesignView(): void {
		this.agentCanvasContainer.style.display = 'none';
		this.cardGridContainer.style.display = '';
		this.sidebarContainer.style.display = 'none';
		this.detailPanelContainer.style.display = '';

		const items = this.agentMgmtService.getItems();
		this.cardGrid.render(items, this.currentFilter);
	}

	// ─── Sandbox View ────────────────────────────────────────

	private renderSandboxView(): void {
		this.agentCanvasContainer.style.display = 'none';
		this.cardGridContainer.style.display = '';
		this.sidebarContainer.style.display = '';
		this.detailPanelContainer.style.display = 'none';

		clearNode(this.cardGridContainer);
		clearNode(this.sidebarContainer);

		// Show agent selector in sidebar
		this.sidebar.renderForSandbox((agentId) => {
			this.openSandbox(agentId);
		});

		// Show placeholder
		const placeholder = append(this.cardGridContainer, $('.agent-sandbox-placeholder'));
		append(placeholder, $('span.codicon.codicon-beaker'));
		append(placeholder, $('h3')).textContent = 'Agent Sandbox';
		append(placeholder, $('p')).textContent = 'Select an agent from the sidebar to test it in the sandbox.';
	}

	private openSandbox(agentId: string): void {
		clearNode(this.cardGridContainer);
		if (this.sandbox) {
			this.sandbox.dispose();
		}
		this.sandbox = this._register(new AgentSandbox(
			this.cardGridContainer,
			agentId,
			this.agentMgmtService,
			this.llmService,
		));
	}

	// ─── Analytics View ──────────────────────────────────────

	private renderAnalyticsView(): void {
		this.agentCanvasContainer.style.display = 'none';
		this.cardGridContainer.style.display = '';
		this.sidebarContainer.style.display = 'none';
		this.detailPanelContainer.style.display = 'none';

		clearNode(this.cardGridContainer);
		new AgentPerformanceDashboard(this.cardGridContainer, this.agentMgmtService);
	}

	// ─── Pipeline View ───────────────────────────────────────

	private renderPipelineView(): void {
		this.sidebarContainer.style.display = '';
		this.detailPanelContainer.style.display = 'none';
		this.cardGridContainer.style.display = 'none';
		this.agentCanvasContainer.style.display = '';

		clearNode(this.sidebarContainer);

		// Agent palette for drag-and-drop
		const palette = append(this.sidebarContainer, $('.pipeline-palette'));
		append(palette, $('.pipeline-palette-title')).textContent = 'Agent Palette';

		const items = this.agentMgmtService.getItems().filter(i => i.state === 'enabled');
		const list = append(palette, $('.pipeline-palette-list'));

		for (const item of items) {
			const entry = append(list, $('.pipeline-palette-entry'));
			entry.draggable = true;
			entry.dataset.agentId = item.id;
			entry.addEventListener('dragstart', (e) => {
				e.dataTransfer?.setData('text/plain', item.id);
				e.dataTransfer!.effectAllowed = 'copy';
			});

			const icon = append(entry, $('span.codicon'));
			icon.className = `codicon ${item.iconCodicon}`;
			append(entry, $('span')).textContent = item.name;
		}

		// Flow control nodes
		const flowTitle = append(palette, $('.pipeline-palette-title'));
		flowTitle.textContent = 'Flow Control';
		flowTitle.style.marginTop = '12px';

		const flowNodes = append(palette, $('.pipeline-palette-list'));
		const flowTypes: { type: string; label: string; icon: string }[] = [
			{ type: 'condition', label: 'Condition', icon: 'codicon-symbol-boolean' },
			{ type: 'parallel', label: 'Parallel', icon: 'codicon-split-horizontal' },
			{ type: 'aggregator', label: 'Aggregator', icon: 'codicon-merge' },
			{ type: 'trigger', label: 'Trigger', icon: 'codicon-zap' },
			{ type: 'output', label: 'Output', icon: 'codicon-output' },
		];

		for (const fn of flowTypes) {
			const entry = append(flowNodes, $('.pipeline-palette-entry'));
			entry.draggable = true;
			entry.dataset.nodeType = fn.type;
			entry.addEventListener('dragstart', (e) => {
				e.dataTransfer?.setData('application/pipeline-node', fn.type);
				e.dataTransfer!.effectAllowed = 'copy';
			});

			const icon = append(entry, $('span.codicon'));
			icon.className = `codicon ${fn.icon}`;
			append(entry, $('span')).textContent = fn.label;
		}

		// Render agent canvas in pipeline mode
		this.engine.enablePipelineMode({
			stages: [{ name: 'default', allowedNodeTypes: ['agent', 'skill', 'command', 'rule'], allowedEdgeTypes: ['depends-on', 'extends'] }],
		});
	}

	// ─── Filter & Select ────────────────────────────────────

	private onFilterChange(filter: IAgentSkillFilter): void {
		this.currentFilter = filter;
		if (this.currentTab === 'catalog' || this.currentTab === 'installed') {
			const items = this.agentMgmtService.getItems();
			const filtered = this.currentTab === 'installed'
				? items.filter(i => i.state === 'enabled' || i.state === 'error')
				: items;
			this.syncAgentItems(filtered);
			this.engine.updateData(filtered);
			this.engine.render();
		} else {
			this.cardGrid.render(this.agentMgmtService.getItems(), this.currentFilter);
		}
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

	private async handleInstall(id: string): Promise<void> {
		await this.agentMgmtService.installItem(id);
		if (this.currentTab === 'catalog' || this.currentTab === 'installed') {
			const items = this.agentMgmtService.getItems();
			const filtered = this.currentTab === 'installed'
				? items.filter(i => i.state === 'enabled' || i.state === 'error')
				: items;
			this.syncAgentItems(filtered);
			this.engine.updateData(filtered);
			this.engine.render();
		}
		this.statusBar.update(this.agentMgmtService.getItems().length,
			this.agentMgmtService.getItems().filter(i => i.state === 'enabled').length,
			this.agentMgmtService.getItems().filter(i => i.state === 'enabled').length);
	}

	private async handleUninstall(id: string): Promise<void> {
		await this.agentMgmtService.uninstallItem(id);
		if (this.currentTab === 'catalog' || this.currentTab === 'installed') {
			const items = this.agentMgmtService.getItems();
			const filtered = this.currentTab === 'installed'
				? items.filter(i => i.state === 'enabled' || i.state === 'error')
				: items;
			this.syncAgentItems(filtered);
			this.engine.updateData(filtered);
			this.engine.render();
		}
		this.statusBar.update(this.agentMgmtService.getItems().length,
			this.agentMgmtService.getItems().filter(i => i.state === 'enabled').length,
			this.agentMgmtService.getItems().filter(i => i.state === 'enabled').length);
	}

	private handleToggle(id: string, state: 'enabled' | 'disabled'): void {
		this.agentMgmtService.setItemState(id, state);
		const item = this.agentMgmtService.getItem(id);
		if (item) {
			this.cardGrid.render(this.agentMgmtService.getItems(), this.currentFilter);
			this.detailPanel.show(item, {
				onInstall: (i) => this.handleInstall(i),
				onUninstall: (i) => this.handleUninstall(i),
				onToggle: (i, s) => this.handleToggle(i, s),
				onConfigSave: (i, c) => this.handleConfigSave(i, c),
			});
		}
	}

	private async handleConfigSave(id: string, config: Record<string, any>): Promise<void> {
		try {
			await this.agentMgmtService.updateConfig(id, config);
			console.log(`[HarnessEditor] Config saved for ${id}`);
		} catch (err) {
			console.error(`[HarnessEditor] Failed to save config for ${id}:`, err);
		}
	}

	// ─── Dispose ────────────────────────────────────────────

	override dispose(): void {
		this.navBar?.dispose();
		this.sidebar?.dispose();
		this.cardGrid?.dispose();
		this.detailPanel?.dispose();
		this.statusBar?.dispose();
		this.engine?.destroy();
		this.diagramToolbar?.destroy();
		this.sandbox?.dispose();
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