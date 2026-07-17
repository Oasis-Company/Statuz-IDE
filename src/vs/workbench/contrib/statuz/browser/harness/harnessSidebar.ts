/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, clearNode, addDisposableListener } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentSkillItem, IAgentSkillFilter, AgentSkillType, ItemState } from '../agentManagement.types.js';

export class HarnessSidebar extends Disposable {

	private readonly container: HTMLElement;
	private readonly onFilterChange: (filter: IAgentSkillFilter) => void;

	private searchInput!: HTMLInputElement;
	private searchClearBtn!: HTMLElement;
	private allCheckbox!: HTMLInputElement;
	private agentCheckbox!: HTMLInputElement;
	private skillCheckbox!: HTMLInputElement;
	private ruleCheckbox!: HTMLInputElement;
	private commandCheckbox!: HTMLInputElement;
	private stateSelect!: HTMLSelectElement;
	private sortSelect!: HTMLSelectElement;

	private currentFilter: IAgentSkillFilter = {
		query: '', type: 'all', state: 'all',
		sortBy: 'name', sortAsc: true,
	};

	constructor(
		parent: HTMLElement,
		onFilterChange: (filter: IAgentSkillFilter) => void,
	) {
		super();
		this.onFilterChange = onFilterChange;
		this.container = parent;
		this.createLayout();
	}

	private createLayout(): void {
		clearNode(this.container);
		this.container.className = 'harness-sidebar';

		// Search
		this.createSearch();

		// Type filter
		this.createTypeFilter();

		// State filter
		this.createStateFilter();

		// Sort
		this.createSort();
	}

	private createSearch(): void {
		const searchContainer = append(this.container, $('.harness-sidebar-search'));
		append(searchContainer, $('span.harness-sidebar-search-icon.codicon.codicon-search'));
		this.searchInput = append(searchContainer, $('input.harness-sidebar-search-input'));
		this.searchInput.placeholder = 'Search agents & skills...';
		this.searchClearBtn = append(searchContainer, $('span.harness-sidebar-clear.codicon.codicon-close'));

		this._register(addDisposableListener(this.searchInput, 'input', () => {
			this.currentFilter.query = this.searchInput.value;
			this.searchClearBtn.classList.toggle('visible', this.searchInput.value.length > 0);
			this.emitFilter();
		}));

		this._register(addDisposableListener(this.searchClearBtn, 'click', () => {
			this.searchInput.value = '';
			this.currentFilter.query = '';
			this.searchClearBtn.classList.remove('visible');
			this.emitFilter();
			this.searchInput.focus();
		}));
	}

	private createTypeFilter(): void {
		const section = append(this.container, $('.harness-sidebar-section'));
		append(section, $('.harness-sidebar-section-title')).textContent = 'Type';

		this.allCheckbox = this.createCheckbox(section, 'All', 'all', true);
		this.agentCheckbox = this.createCheckbox(section, 'Agents', 'agent', false);
		this.skillCheckbox = this.createCheckbox(section, 'Skills', 'skill', false);
		this.ruleCheckbox = this.createCheckbox(section, 'Rules', 'rule', false);
		this.commandCheckbox = this.createCheckbox(section, 'Commands', 'command', false);
	}

	private createCheckbox(parent: HTMLElement, label: string, type: string, checked: boolean): HTMLInputElement {
		const item = append(parent, $('.harness-sidebar-filter-item'));
		const checkbox = append(item, $('input')) as HTMLInputElement;
		checkbox.type = 'checkbox';
		checkbox.checked = checked;
		checkbox.id = `filter-${type}`;
		const labelEl = append(item, $('label'));
		labelEl.textContent = label;
		(labelEl as HTMLLabelElement).htmlFor = `filter-${type}`;

		this._register(addDisposableListener(checkbox, 'change', () => {
			if (type === 'all') {
				this.setAllTypeCheckboxes(checkbox.checked);
			} else if (checkbox.checked) {
				this.allCheckbox.checked = false;
			}
			this.updateTypeFilter();
			this.emitFilter();
		}));

		return checkbox;
	}

	private setAllTypeCheckboxes(checked: boolean): void {
		this.allCheckbox.checked = checked;
		this.agentCheckbox.checked = checked;
		this.skillCheckbox.checked = checked;
		this.ruleCheckbox.checked = checked;
		this.commandCheckbox.checked = checked;
	}

	private updateTypeFilter(): void {
		if (this.allCheckbox.checked) {
			this.currentFilter.type = 'all';
			return;
		}

		const selected: AgentSkillType[] = [];
		if (this.agentCheckbox.checked) selected.push('agent');
		if (this.skillCheckbox.checked) selected.push('skill');
		if (this.ruleCheckbox.checked) selected.push('rule');
		if (this.commandCheckbox.checked) selected.push('command');

		// If none selected, treat as all
		if (selected.length === 0) {
			this.currentFilter.type = 'all';
			this.allCheckbox.checked = true;
			return;
		}

		// If only one type, use it directly
		if (selected.length === 1) {
			this.currentFilter.type = selected[0];
			return;
		}

		// Multiple types selected - handle via filtering in the card grid
		// For now, default to 'all' and let the card grid filter
		this.currentFilter.type = 'all';
	}

	private createStateFilter(): void {
		const section = append(this.container, $('.harness-sidebar-section'));
		append(section, $('.harness-sidebar-section-title')).textContent = 'State';

		this.stateSelect = append(section, $('select.harness-sidebar-select')) as HTMLSelectElement;
		const states: { value: string; label: string }[] = [
			{ value: 'all', label: 'All States' },
			{ value: 'enabled', label: 'Enabled' },
			{ value: 'disabled', label: 'Disabled' },
			{ value: 'error', label: 'Error' },
			{ value: 'installing', label: 'Installing' },
		];
		states.forEach(s => {
			const opt = append(this.stateSelect, $('option')) as HTMLOptionElement;
			opt.value = s.value;
			opt.textContent = s.label;
		});

		this._register(addDisposableListener(this.stateSelect, 'change', () => {
			this.currentFilter.state = this.stateSelect.value as ItemState | 'all';
			this.emitFilter();
		}));
	}

	private createSort(): void {
		const section = append(this.container, $('.harness-sidebar-section'));
		append(section, $('.harness-sidebar-section-title')).textContent = 'Sort By';

		this.sortSelect = append(section, $('select.harness-sidebar-select')) as HTMLSelectElement;
		const sorts: { value: string; label: string }[] = [
			{ value: 'name', label: 'Name' },
			{ value: 'category', label: 'Category' },
			{ value: 'lastUsed', label: 'Last Used' },
			{ value: 'usageCount', label: 'Usage Count' },
		];
		sorts.forEach(s => {
			const opt = append(this.sortSelect, $('option')) as HTMLOptionElement;
			opt.value = s.value;
			opt.textContent = s.label;
		});

		this._register(addDisposableListener(this.sortSelect, 'change', () => {
			this.currentFilter.sortBy = this.sortSelect.value as 'name' | 'lastUsed' | 'usageCount' | 'state';
			this.emitFilter();
		}));
	}

	show(_items: IAgentSkillItem[]): void {
		// items stored for future use
	}

	private emitFilter(): void {
		this.onFilterChange({ ...this.currentFilter });
	}

	override dispose(): void {
		super.dispose();
	}
}