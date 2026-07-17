/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentSkillItem, IAgentSkillFilter } from '../agentManagement.types.js';

const TYPE_LABELS: Record<string, string> = {
	agent: 'Agent',
	skill: 'Skill',
	command: 'Cmd',
	rule: 'Rule',
};

const CATEGORY_ORDER: string[] = [
	'Agent Engineering',
	'Development Foundations',
	'Frontend & UI',
	'Testing & Quality',
	'Planning & Architecture',
	'Operations',
];

export class HarnessCardGrid extends Disposable {

	private readonly container: HTMLElement;
	private readonly onCardSelect: (item: IAgentSkillItem) => void;
	private selectedId: string | null = null;

	constructor(
		parent: HTMLElement,
		onCardSelect: (item: IAgentSkillItem) => void,
	) {
		super();
		this.onCardSelect = onCardSelect;
		this.container = parent;
		this.container.className = 'harness-card-grid-container';
	}

	render(items: IAgentSkillItem[], filter: IAgentSkillFilter): void {
		clearNode(this.container);

		// Apply filter
		let filtered = this.applyFilter(items, filter);

		if (filtered.length === 0) {
			this.renderEmpty(filter);
			return;
		}

		// Group by category
		const grouped = this.groupByCategory(filtered);

		const grid = append(this.container, $('.harness-card-grid'));

		// Render each category group
		CATEGORY_ORDER.forEach(category => {
			const catItems = grouped.get(category);
			if (!catItems || catItems.length === 0) {
				return;
			}

			// Category header
			append(grid, $('.harness-category-header')).textContent = category;

			// Card grid
			const cardsContainer = append(grid, $('.harness-category-grid'));
			catItems.forEach(item => {
				this.renderCard(cardsContainer, item);
			});
		});
	}

	private applyFilter(items: IAgentSkillItem[], filter: IAgentSkillFilter): IAgentSkillItem[] {
		let result = [...items];

		// Type filter
		if (filter.type !== 'all') {
			result = result.filter(item => item.type === filter.type);
		}

		// State filter
		if (filter.state !== 'all') {
			result = result.filter(item => item.state === filter.state);
		}

		// Search query
		if (filter.query.trim()) {
			const q = filter.query.toLowerCase();
			result = result.filter(item =>
				item.name.toLowerCase().includes(q) ||
				item.description.toLowerCase().includes(q) ||
				item.tags.some(t => t.toLowerCase().includes(q))
			);
		}

		// Sort
		result.sort((a, b) => {
			let cmp = 0;
			switch (filter.sortBy) {
				case 'name': cmp = a.name.localeCompare(b.name); break;
				case 'lastUsed': cmp = a.lastUsed - b.lastUsed; break;
				case 'usageCount': cmp = a.usageCount - b.usageCount; break;
				case 'state': cmp = a.state.localeCompare(b.state); break;
			}
			return filter.sortAsc ? cmp : -cmp;
		});

		return result;
	}

	private groupByCategory(items: IAgentSkillItem[]): Map<string, IAgentSkillItem[]> {
		const grouped = new Map<string, IAgentSkillItem[]>();

		// First, sort by category order
		const sorted = [...items].sort((a, b) => {
			const aIdx = CATEGORY_ORDER.indexOf(a.category);
			const bIdx = CATEGORY_ORDER.indexOf(b.category);
			if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
			if (aIdx >= 0) return -1;
			if (bIdx >= 0) return 1;
			return a.category.localeCompare(b.category);
		});

		sorted.forEach(item => {
			const cat = item.category || 'Other';
			if (!grouped.has(cat)) {
				grouped.set(cat, []);
			}
			grouped.get(cat)!.push(item);
		});

		return grouped;
	}

	private renderCard(container: HTMLElement, item: IAgentSkillItem): void {
		const card = append(container, $('.harness-card'));
		if (item.id === this.selectedId) {
			card.classList.add('selected');
		}

		// Header: icon + name + type badge
		const header = append(card, $('.harness-card-header'));
		const icon = append(header, $('span.harness-card-icon.codicon'));
		icon.className = `harness-card-icon codicon ${item.iconCodicon}`;
		append(header, $('.harness-card-name')).textContent = item.name;
		const badge = append(header, $('.harness-card-type-badge'));
		badge.textContent = TYPE_LABELS[item.type] || item.type;
		badge.classList.add(item.type);

		// Description
		append(card, $('.harness-card-description')).textContent = item.description;

		// Footer: state dot + version + tags
		const footer = append(card, $('.harness-card-footer'));
		const dot = append(footer, $('.harness-card-state-dot'));
		dot.classList.add(item.state);
		append(footer, $('.harness-card-version')).textContent = `v${item.version}`;

		// Tags
		const tags = append(footer, $('.harness-card-tags'));
		item.tags.slice(0, 3).forEach(tag => {
			append(tags, $('.harness-card-tag')).textContent = tag;
		});

		// Click handler
		card.addEventListener('click', () => {
			this.selectedId = item.id;
			this.onCardSelect(item);
			// Update selected state
			container.querySelectorAll('.harness-card').forEach(c => c.classList.remove('selected'));
			card.classList.add('selected');
		});
	}

	private renderEmpty(filter: IAgentSkillFilter): void {
		const empty = append(this.container, $('.harness-empty-state'));
		append(empty, $('span.codicon.codicon.search-empty'));
		const text = append(empty, $('span'));
		text.textContent = filter.query
			? `No results for "${filter.query}"`
			: 'No items found';
	}

	renderDashboard(items: IAgentSkillItem[]): void {
		clearNode(this.container);

		const dashboard = append(this.container, $('.harness-dashboard'));

		// Header
		const header = append(dashboard, $('.harness-dashboard-header'));
		append(header, $('.harness-dashboard-title')).textContent = 'Harness Engineering';
		append(header, $('.harness-dashboard-subtitle')).textContent = 'Visual overview of your agent and skill ecosystem';

		// Metrics
		const metrics = append(dashboard, $('.harness-dashboard-metrics'));
		const totalAgents = items.filter(i => i.type === 'agent').length;
		const totalSkills = items.filter(i => i.type === 'skill').length;
		const totalEnabled = items.filter(i => i.state === 'enabled').length;
		const totalCommands = items.filter(i => i.type === 'command').length;
		const totalRules = items.filter(i => i.type === 'rule').length;

		const metricData = [
			{ value: totalAgents, label: 'Agents' },
			{ value: totalSkills, label: 'Skills' },
			{ value: totalCommands, label: 'Commands' },
			{ value: totalRules, label: 'Rules' },
			{ value: totalEnabled, label: 'Enabled' },
			{ value: items.length, label: 'Total Items' },
		];

		metricData.forEach(m => {
			const metric = append(metrics, $('.harness-dashboard-metric'));
			append(metric, $('.harness-dashboard-metric-value')).textContent = String(m.value);
			append(metric, $('.harness-dashboard-metric-label')).textContent = m.label;
		});

		// Quick actions
		const quickActions = append(dashboard, $('.harness-dashboard-quick-actions'));
		const actions = [
			{ icon: 'codicon-package', label: 'Browse Catalog', action: () => { /* tab switch handled externally */ } },
			{ icon: 'codicon-cloud-download', label: 'Install Recommended', action: () => {} },
			{ icon: 'codicon-sync', label: 'Check for Updates', action: () => {} },
			{ icon: 'codicon-settings-gear', label: 'Configure Settings', action: () => {} },
		];

		actions.forEach(a => {
			const btn = append(quickActions, $('button.harness-dashboard-quick-btn'));
			append(btn, $('span.codicon')).className = `codicon ${a.icon}`;
			append(btn, document.createTextNode(` ${a.label}`));
			btn.addEventListener('click', a.action);
		});
	}

	renderConfigView(): void {
		clearNode(this.container);

		const config = append(this.container, $('.harness-config-view'));
		append(config, $('.harness-config-title')).textContent = 'Settings';

		// ECC Source
		const eccSection = append(config, $('.harness-config-section'));
		append(eccSection, $('.harness-config-section-title')).textContent = 'ECC Source';
		const eccRow = append(eccSection, $('.harness-config-row'));
		append(eccRow, $('.harness-config-row-label')).textContent = 'Repository Path';
		append(eccRow, $('.harness-config-row-value')).textContent = 'D:\\github downloads\\ecc-universal-2.0.0';

		// Install Target
		const installSection = append(config, $('.harness-config-section'));
		append(installSection, $('.harness-config-section-title')).textContent = 'Install Target';
		const installRow = append(installSection, $('.harness-config-row'));
		append(installRow, $('.harness-config-row-label')).textContent = 'Install Path';
		append(installRow, $('.harness-config-row-value')).textContent = '.trae/';

		// Auto-refresh
		const refreshSection = append(config, $('.harness-config-section'));
		append(refreshSection, $('.harness-config-section-title')).textContent = 'Catalog';
		const refreshRow = append(refreshSection, $('.harness-config-row'));
		append(refreshRow, $('.harness-config-row-label')).textContent = 'Auto-refresh Interval';
		append(refreshRow, $('.harness-config-row-value')).textContent = 'Every 24 hours';
	}

	override dispose(): void {
		super.dispose();
	}
}