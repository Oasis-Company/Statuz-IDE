/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './agentManagement.css';

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';
import * as nls from '../../../../nls.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
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
import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { append, $, clearNode, addDisposableListener } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { IAgentManagementService, AgentManagementService } from './agentManagementService.js';
import { IAgentSkillItem, IAgentSkillFilter, AgentSkillType, ItemState, AGENT_MGMT_LIST_ELEMENT_HEIGHT, IAgentSkillTemplateData } from './agentManagement.types.js';
import { List } from '../../../../base/browser/ui/list/listWidget.js';
import { IListVirtualDelegate, IListRenderer } from '../../../../base/browser/ui/list/list.js';

// ===== List Delegate =====

class AgentListDelegate implements IListVirtualDelegate<IAgentSkillItem> {
	getHeight(element: IAgentSkillItem): number {
		return AGENT_MGMT_LIST_ELEMENT_HEIGHT;
	}
	getTemplateId(element: IAgentSkillItem): string {
		return 'agent-item';
	}
}

// ===== List Renderer =====

class AgentListRenderer implements IListRenderer<IAgentSkillItem, IAgentSkillTemplateData> {
	readonly templateId = 'agent-item';

	renderTemplate(container: HTMLElement): IAgentSkillTemplateData {
		const root = append(container, $('.agent-mgmt-item'));

		const icon = append(root, $('.agent-mgmt-item-icon.codicon'));

		const details = append(root, $('.agent-mgmt-item-details'));
		const header = append(details, $('.agent-mgmt-item-header'));
		const name = append(header, $('.agent-mgmt-item-name'));
		const typeLabel = append(header, $('.agent-mgmt-item-type-badge'));
		const description = append(details, $('.agent-mgmt-item-description'));
		const footer = append(details, $('.agent-mgmt-item-footer'));
		const stateIndicator = append(footer, $('.agent-mgmt-state-indicator'));
		const toggle = append(footer, $('button.agent-mgmt-item-toggle'));

		return {
			root, element: root, icon, name, description, typeLabel,
			stateIndicator, actionContainer: toggle, item: null,
		};
	}

	renderElement(element: IAgentSkillItem, index: number, templateData: IAgentSkillTemplateData): void {
		templateData.item = element;

		// Icon
		templateData.icon.className = `agent-mgmt-item-icon codicon ${element.iconCodicon}`;

		// Name
		templateData.name.textContent = element.name;

		// Type badge
		templateData.typeLabel.textContent = element.type;

		// Description
		templateData.description.textContent = element.description;

		// State indicator
		this.renderStateIndicator(templateData.stateIndicator, element);

		// Toggle button
		templateData.actionContainer.textContent = element.state === 'enabled' ? 'Disable' : 'Enable';
		templateData.actionContainer.className = `agent-mgmt-item-toggle${element.state === 'enabled' ? ' enabled' : ''}`;

		// Root state
		templateData.root.className = `agent-mgmt-item${element.state === 'disabled' ? ' disabled' : ''}${element.state === 'error' ? ' error' : ''}`;
	}

	private renderStateIndicator(container: HTMLElement, item: IAgentSkillItem): void {
		clearNode(container);
		const dot = $('span.agent-mgmt-state-dot');
		dot.classList.add(item.state);
		append(container, dot);
		const label = append(container, $('span.agent-mgmt-state-label'));
		label.textContent = item.state.charAt(0).toUpperCase() + item.state.slice(1);
	}

	disposeTemplate(templateData: IAgentSkillTemplateData): void {
		templateData.item = null;
	}
}

// ===== ViewPane =====

export class AgentManagementViewPane extends ViewPane {
	private searchInput!: HTMLInputElement;
	private searchClearBtn!: HTMLElement;
	private filterTabs!: HTMLElement;
	private listContainer!: HTMLElement;
	private detailContainer!: HTMLElement;
	private messageContainer!: HTMLElement;
	private statusBar!: HTMLElement;
	private list: List<IAgentSkillItem> | null = null;
	private currentFilter: IAgentSkillFilter = {
		query: '', type: 'all', state: 'all',
		sortBy: 'name', sortAsc: true,
	};
	private isShowingDetail = false;
	private configEditMode = false;

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
		@IAgentManagementService private readonly agentMgmtService: IAgentManagementService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(agentMgmtService.onDidChangeItems(() => {
			if (!this.isShowingDetail) {
				this.refreshList();
			}
		}));
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);

		// Search bar
		const searchContainer = append(parent, $('.agent-mgmt-search-container'));
		this.renderSearchBar(searchContainer);

		// Filter bar
		this.filterTabs = append(parent, $('.agent-mgmt-filter-bar'));
		this.renderFilterTabs();

		// List container
		this.listContainer = append(parent, $('.agent-mgmt-list'));

		// Detail container (hidden initially)
		this.detailContainer = append(parent, $('.agent-mgmt-detail'));
		this.detailContainer.style.display = 'none';

		// Message container
		this.messageContainer = append(parent, $('.agent-mgmt-message-container'));

		// Status bar
		this.statusBar = append(parent, $('.agent-mgmt-status-bar'));

		// Initialize list
		this.initializeList();
		this.refreshList();
	}

	private renderSearchBar(container: HTMLElement): void {
		const searchBox = append(container, $('.agent-mgmt-search-box'));
		append(searchBox, $('span.agent-mgmt-search-icon.codicon.codicon-search'));
		this.searchInput = append(searchBox, $('input.agent-mgmt-search-input'));
		this.searchInput.placeholder = 'Search agents & skills...';
		this.searchClearBtn = append(searchBox, $('span.agent-mgmt-search-clear.codicon.codicon-close'));

		this._register(addDisposableListener(this.searchInput, 'input', () => {
			this.currentFilter.query = this.searchInput.value;
			this.searchClearBtn.classList.toggle('visible', this.searchInput.value.length > 0);
			this.refreshList();
		}));

		this._register(addDisposableListener(this.searchInput, 'keydown', (e) => {
			const event = new StandardKeyboardEvent(e);
			if (event.keyCode === KeyCode.Escape) {
				this.searchInput.value = '';
				this.currentFilter.query = '';
				this.searchClearBtn.classList.remove('visible');
				this.refreshList();
				this.searchInput.blur();
			}
		}));

		this._register(addDisposableListener(this.searchClearBtn, 'click', () => {
			this.searchInput.value = '';
			this.currentFilter.query = '';
			this.searchClearBtn.classList.remove('visible');
			this.refreshList();
			this.searchInput.focus();
		}));
	}

	private renderFilterTabs(): void {
		const tabs: { id: AgentSkillType | 'all'; label: string }[] = [
			{ id: 'all', label: 'All' },
			{ id: 'agent', label: 'Agents' },
			{ id: 'skill', label: 'Skills' },
			{ id: 'command', label: 'Commands' },
			{ id: 'rule', label: 'Rules' },
		];

		tabs.forEach(tab => {
			const btn = append(this.filterTabs, $('button.agent-mgmt-filter-tab'));
			btn.textContent = tab.label;
			btn.dataset.type = tab.id;
			if (tab.id === this.currentFilter.type) {
				btn.classList.add('active');
			}
			this._register(addDisposableListener(btn, 'click', () => {
				this.currentFilter.type = tab.id;
				this.filterTabs.querySelectorAll('.agent-mgmt-filter-tab').forEach(t => t.classList.remove('active'));
				btn.classList.add('active');
				this.refreshList();
			}));
		});
	}

	private initializeList(): void {
		const delegate = new AgentListDelegate();
		const renderer = new AgentListRenderer();

		this.list = new List<IAgentSkillItem>('AgentManagement', this.listContainer, delegate, [renderer], {
			multipleSelectionSupport: false,
			setRowLineHeight: false,
			horizontalScrolling: false,
			mouseSupport: true,
			keyboardSupport: true,
			accessibilityProvider: {
				getAriaLabel(element: IAgentSkillItem) { return element.name; },
				getWidgetAriaLabel() { return 'Agent and Skill list'; },
			},
		});

		// Click to select and show detail
		this._register(this.list.onDidChangeSelection(e => {
			if (e.elements.length > 0) {
				this.showDetail(e.elements[0]);
			}
		}));

		// Toggle enable/disable on item buttons
		this._register(this.list.onMouseClick(e => {
			const target = e.browserEvent.target as HTMLElement;
			if (target.classList.contains('agent-mgmt-item-toggle')) {
				e.browserEvent.stopPropagation();
				const item = e.element;
				if (item) {
					const newState: ItemState = item.state === 'enabled' ? 'disabled' : 'enabled';
					this.agentMgmtService.setItemState(item.id, newState);
				}
			}
		}));

		this._register(this.list);
	}

	private refreshList(): void {
		if (!this.list) return;
		const items = this.agentMgmtService.getFilteredItems(this.currentFilter);
		this.list.splice(0, this.list.length, items);
		this.updateStatusBar(items.length);

		// Show/hide message
		if (items.length === 0) {
			this.listContainer.style.display = 'none';
			this.messageContainer.style.display = 'flex';
			clearNode(this.messageContainer);
			append(this.messageContainer, $('span.agent-mgmt-message-icon.codicon.codicon-search'));
			const text = append(this.messageContainer, $('span.agent-mgmt-message-text'));
			text.textContent = this.currentFilter.query
				? `No results for "${this.currentFilter.query}"`
				: 'No agents or skills installed';
		} else {
			this.listContainer.style.display = '';
			this.messageContainer.style.display = 'none';
		}
	}

	private updateStatusBar(count: number): void {
		clearNode(this.statusBar);
		const countSpan = append(this.statusBar, $('span.agent-mgmt-status-count'));
		const icon = append(countSpan, $('span.codicon.codicon-package'));
		icon.style.marginRight = '4px';
		append(countSpan, $('span')).textContent = `${count} items`;
		const totalSpan = append(this.statusBar, $('span'));
		totalSpan.textContent = `${this.agentMgmtService.getItems().length} total`;
	}

	private showDetail(item: IAgentSkillItem): void {
		this.isShowingDetail = true;
		this.listContainer.style.display = 'none';
		this.messageContainer.style.display = 'none';
		this.detailContainer.style.display = 'flex';
		clearNode(this.detailContainer);
		this.renderDetailView(this.detailContainer, item);
	}

	private showList(): void {
		this.isShowingDetail = false;
		this.configEditMode = false;
		this.detailContainer.style.display = 'none';
		this.listContainer.style.display = '';
		this.refreshList();
	}

	private renderDetailView(container: HTMLElement, item: IAgentSkillItem): void {
		// Header with back button
		const header = append(container, $('.agent-mgmt-detail-header'));
		const backBtn = append(header, $('span.agent-mgmt-detail-back.codicon.codicon-arrow-left'));
		this._register(addDisposableListener(backBtn, 'click', () => this.showList()));
		const title = append(header, $('.agent-mgmt-detail-title'));
		title.textContent = item.name;

		// Body
		const body = append(container, $('.agent-mgmt-detail-body'));

		// Description section
		const descSection = append(body, $('.agent-mgmt-detail-section'));
		append(descSection, $('.agent-mgmt-detail-section-title')).textContent = 'Description';
		const desc = append(descSection, $('.agent-mgmt-detail-description'));
		desc.textContent = item.description;

		// Info section
		const infoSection = append(body, $('.agent-mgmt-detail-section'));
		append(infoSection, $('.agent-mgmt-detail-section-title')).textContent = 'Information';
		const infoRows: { label: string; value: string }[] = [
			{ label: 'Type', value: item.type },
			{ label: 'Version', value: item.version },
			{ label: 'Author', value: item.author },
			{ label: 'State', value: item.state },
			{ label: 'Path', value: item.installPath },
			{ label: 'Usage', value: `${item.usageCount} times` },
			{ label: 'Last Used', value: item.lastUsed ? new Date(item.lastUsed).toLocaleDateString() : 'Never' },
		];
		infoRows.forEach(row => {
			const rowEl = append(infoSection, $('.agent-mgmt-detail-info-row'));
			append(rowEl, $('.agent-mgmt-detail-info-label')).textContent = row.label;
			append(rowEl, $('.agent-mgmt-detail-info-value')).textContent = row.value;
		});

		// Tags section
		if (item.tags.length > 0) {
			const tagSection = append(body, $('.agent-mgmt-detail-section'));
			append(tagSection, $('.agent-mgmt-detail-section-title')).textContent = 'Tags';
			const tagContainer = append(tagSection, $('.agent-mgmt-detail-tags'));
			item.tags.forEach(tag => {
				append(tagContainer, $('.agent-mgmt-detail-tag')).textContent = tag;
			});
		}

		// Actions
		const actionSection = append(body, $('.agent-mgmt-detail-section'));
		append(actionSection, $('.agent-mgmt-detail-section-title')).textContent = 'Actions';
		const toggleBtn = append(actionSection, $('button.agent-mgmt-item-toggle'));
		toggleBtn.textContent = item.state === 'enabled' ? 'Disable' : 'Enable';
		if (item.state === 'enabled') toggleBtn.classList.add('enabled');
		this._register(addDisposableListener(toggleBtn, 'click', () => {
			const newState: ItemState = item.state === 'enabled' ? 'disabled' : 'enabled';
			this.agentMgmtService.setItemState(item.id, newState);
			item.state = newState;
			this.renderDetailView(container, item);
		}));

		// Config section
		this.renderConfigSection(body, item);
	}

	private renderConfigSection(container: HTMLElement, item: IAgentSkillItem): void {
		const configSection = append(container, $('.agent-mgmt-config-section.agent-mgmt-detail-section'));
		append(configSection, $('.agent-mgmt-detail-section-title')).textContent = 'Configuration';

		const textarea = append(configSection, $('textarea.agent-mgmt-config-textarea')) as HTMLTextAreaElement;
		textarea.value = JSON.stringify(item.config, null, 2);
		textarea.readOnly = !this.configEditMode;

		const actions = append(configSection, $('.agent-mgmt-config-actions'));

		if (!this.configEditMode) {
			const editBtn = append(actions, $('button.agent-mgmt-item-toggle'));
			editBtn.textContent = 'Edit Config';
			this._register(addDisposableListener(editBtn, 'click', () => {
				this.configEditMode = true;
				this.renderDetailView(this.detailContainer, item);
			}));
		} else {
			const saveBtn = append(actions, $('button.agent-mgmt-config-save'));
			saveBtn.textContent = 'Save';
			this._register(addDisposableListener(saveBtn, 'click', () => {
				try {
					const parsed = JSON.parse(textarea.value);
					this.agentMgmtService.updateConfig(item.id, parsed);
					this.configEditMode = false;
					this.renderDetailView(this.detailContainer, item);
				} catch (e) {
					textarea.style.borderColor = 'var(--vscode-errorForeground)';
					setTimeout(() => textarea.style.borderColor = '', 2000);
				}
			}));
			const cancelBtn = append(actions, $('button.agent-mgmt-config-cancel'));
			cancelBtn.textContent = 'Cancel';
			this._register(addDisposableListener(cancelBtn, 'click', () => {
				this.configEditMode = false;
				this.renderDetailView(this.detailContainer, item);
			}));
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;

		// Layout child elements
		const searchContainer = this.element.querySelector('.agent-mgmt-search-container') as HTMLElement;
		const filterBar = this.element.querySelector('.agent-mgmt-filter-bar') as HTMLElement;
		const listEl = this.element.querySelector('.agent-mgmt-list') as HTMLElement;
		const detailEl = this.element.querySelector('.agent-mgmt-detail') as HTMLElement;
		const messageEl = this.element.querySelector('.agent-mgmt-message-container') as HTMLElement;
		const statusBarEl = this.element.querySelector('.agent-mgmt-status-bar') as HTMLElement;

		const searchH = searchContainer?.offsetHeight || 0;
		const filterH = filterBar?.offsetHeight || 0;
		const statusH = statusBarEl?.offsetHeight || 0;
		const bodyH = height - searchH - filterH - statusH;

		if (listEl) listEl.style.height = `${bodyH}px`;
		if (detailEl) detailEl.style.height = `${bodyH}px`;
		if (messageEl) messageEl.style.height = `${bodyH}px`;

		// Relayout the list if visible
		if (this.list && !this.isShowingDetail) {
			this.list.layout(bodyH, width);
		}
	}
}

// ===== Register the service =====

import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
registerSingleton(IAgentManagementService, AgentManagementService, 0 /* InstantiationType.Delayed */);

// ===== Register view container =====

export const STATUZ_AGENT_MGMT_VIEW_CONTAINER_ID = 'workbench.view.statuzAgentMgmt';
export const STATUZ_AGENT_MGMT_VIEW_ID = 'workbench.view.statuzAgentMgmt.agentMgmt';

const agentMgmtViewIcon = registerIcon('statuz-agent-mgmt-view-icon', Codicon.symbolMethod, localize('statuzAgentMgmtViewIcon', 'View icon of the Agent Management view.'));

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const agentMgmtContainer = viewContainerRegistry.registerViewContainer({
	id: STATUZ_AGENT_MGMT_VIEW_CONTAINER_ID,
	title: nls.localize2('statuzAgentMgmt', 'Agent Management'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [STATUZ_AGENT_MGMT_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 2.7,
	rejectAddedViews: true,
	icon: agentMgmtViewIcon,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true, isDefault: false });

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: STATUZ_AGENT_MGMT_VIEW_ID,
	name: nls.localize2('statuzAgentMgmt', 'Agent Management'),
	ctorDescriptor: new SyncDescriptor(AgentManagementViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 80,
	order: 1,
}], agentMgmtContainer);

export const STATUZ_OPEN_AGENT_MGMT_ACTION_ID = 'statuz.openAgentMgmt';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: STATUZ_OPEN_AGENT_MGMT_ACTION_ID,
			title: nls.localize2('openStatuzAgentMgmt', 'Open Agent Management'),
		});
	}
	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService);
		viewsService.openViewContainer(STATUZ_AGENT_MGMT_VIEW_CONTAINER_ID);
	}
});