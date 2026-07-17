/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentSkillItem, IAgentSkillFilter, ItemState } from './agentManagement.types.js';
import { Emitter, Event } from '../../../../base/common/event.js';

export const IAgentManagementService = createDecorator<IAgentManagementService>('agentManagementService');

export interface IAgentManagementService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeItems: Event<void>;
	getItems(): IAgentSkillItem[];
	getFilteredItems(filter: IAgentSkillFilter): IAgentSkillItem[];
	getItem(id: string): IAgentSkillItem | undefined;
	setItemState(id: string, state: ItemState): void;
	updateConfig(id: string, config: Record<string, any>): void;
	installItem(id: string): Promise<void>;
	uninstallItem(id: string): Promise<void>;
	refresh(): void;
}

export class AgentManagementService implements IAgentManagementService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeItems = new Emitter<void>();
	readonly onDidChangeItems: Event<void> = this._onDidChangeItems.event;

	private items: IAgentSkillItem[] = [];

	constructor() {
		this.initializeSampleData();
	}

	private initializeSampleData(): void {
		this.items = [
			{
				id: 'agent-sort',
				name: 'Agent Sort',
				type: 'skill',
				description: 'Build evidence-backed ECC install plans by sorting skills, commands, rules, and hooks into DAILY vs LIBRARY buckets.',
				version: '1.2.0',
				author: 'ECC Team',
				state: 'enabled',
				iconCodicon: 'codicon-list-filter',
				installPath: '~/.claude/skills/agent-sort/',
				config: { defaultMode: 'quick-scan', autoCommit: true },
				lastUsed: Date.now() - 86400000,
				usageCount: 47,
				tags: ['install', 'planning', 'audit'],
				category: 'Development'
			},
			{
				id: 'skill-scout',
				name: 'Skill Scout',
				type: 'skill',
				description: 'Search existing local, marketplace, GitHub, and web skill sources before creating a new skill.',
				version: '2.0.1',
				author: 'ECC Team',
				state: 'enabled',
				iconCodicon: 'codicon-search',
				installPath: '~/.claude/skills/skill-scout/',
				config: { maxResults: 10, includeMarketplace: true },
				lastUsed: Date.now() - 3600000,
				usageCount: 128,
				tags: ['discovery', 'search'],
				category: 'Development'
			},
			{
				id: 'harness-construction',
				name: 'Harness Construction',
				type: 'agent',
				description: 'Design and optimize AI agent action spaces, tool definitions, and observation formatting for higher completion rates.',
				version: '1.0.0',
				author: 'Statuz Core',
				state: 'enabled',
				iconCodicon: 'codicon-symbol-struct',
				installPath: '~/.claude/agents/harness-construction/',
				config: { architecture: 'react', toolGranularity: 'medium' },
				lastUsed: Date.now() - 7200000,
				usageCount: 23,
				tags: ['agent', 'optimization', 'design'],
				category: 'Agent'
			},
			{
				id: 'agentic-os',
				name: 'Agentic OS',
				type: 'agent',
				description: 'Build persistent multi-agent operating systems. Kernel architecture, specialist agents, slash commands, file-based memory.',
				version: '2.3.0',
				author: 'Statuz Core',
				state: 'enabled',
				iconCodicon: 'codicon-symbol-array',
				installPath: '~/.claude/agents/agentic-os/',
				config: { maxAgents: 5, memoryType: 'file' },
				lastUsed: Date.now() - 43200000,
				usageCount: 15,
				tags: ['orchestration', 'multi-agent'],
				category: 'Agent'
			},
			{
				id: 'code-reviewer',
				name: 'Code Reviewer',
				type: 'command',
				description: 'Review pull requests and code changes with configurable strictness levels and automated feedback.',
				version: '0.5.0',
				author: 'Community',
				state: 'disabled',
				iconCodicon: 'codicon-review',
				installPath: '~/.claude/commands/code-reviewer/',
				config: { strictness: 'moderate', autoComment: false },
				lastUsed: 0,
				usageCount: 0,
				tags: ['review', 'code-quality'],
				category: 'Development'
			},
			{
				id: 'docs-generator',
				name: 'Docs Generator',
				type: 'skill',
				description: 'Auto-generate documentation from code comments, JSDoc, and TypeScript type definitions.',
				version: '1.1.0',
				author: 'Community',
				state: 'disabled',
				iconCodicon: 'codicon-file-code',
				installPath: '~/.claude/skills/docs-generator/',
				config: { format: 'markdown', includeExamples: true },
				lastUsed: Date.now() - 604800000,
				usageCount: 8,
				tags: ['documentation', 'generation'],
				category: 'Documentation'
			},
			{
				id: 'security-scanner',
				name: 'Security Scanner',
				type: 'skill',
				description: 'Scan Claude Code configuration for security vulnerabilities, misconfigurations, and injection risks.',
				version: '0.8.0',
				author: 'Security Team',
				state: 'error',
				iconCodicon: 'codicon-shield',
				installPath: '~/.claude/skills/security-scanner/',
				config: { scanDepth: 'deep', autoFix: false },
				lastUsed: Date.now() - 120000,
				usageCount: 34,
				tags: ['security', 'audit'],
				category: 'Security'
			},
			{
				id: 'perf-analyzer',
				name: 'Performance Analyzer',
				type: 'rule',
				description: 'Performance optimization rules for React, TypeScript, and Node.js — catch common anti-patterns before they ship.',
				version: '1.0.0',
				author: 'Statuz Core',
				state: 'enabled',
				iconCodicon: 'codicon-dashboard',
				installPath: '~/.claude/rules/perf-analyzer/',
				config: { severity: 'warning', autoFix: true },
				lastUsed: Date.now() - 1800000,
				usageCount: 56,
				tags: ['performance', 'linting', 'react'],
				category: 'Development'
			},
		];
	}

	getItems(): IAgentSkillItem[] {
		return [...this.items];
	}

	getFilteredItems(filter: IAgentSkillFilter): IAgentSkillItem[] {
		let result = [...this.items];

		// Filter by type
		if (filter.types.length > 0) {
			result = result.filter(item => filter.types.includes(item.type));
		}

		// Filter by state
		if (filter.state !== 'all') {
			result = result.filter(item => item.state === filter.state);
		}

		// Search by query
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

	getItem(id: string): IAgentSkillItem | undefined {
		return this.items.find(item => item.id === id);
	}

	setItemState(id: string, state: ItemState): void {
		const item = this.items.find(i => i.id === id);
		if (item) {
			item.state = state;
			this._onDidChangeItems.fire();
		}
	}

	updateConfig(id: string, config: Record<string, any>): void {
		const item = this.items.find(i => i.id === id);
		if (item) {
			item.config = { ...item.config, ...config };
			this._onDidChangeItems.fire();
		}
	}

	async installItem(id: string): Promise<void> {
		// TODO: Phase 3 — real install via EccInstallService
		const item = this.items.find(i => i.id === id);
		if (item) {
			item.state = 'enabled';
			this._onDidChangeItems.fire();
		}
	}

	async uninstallItem(id: string): Promise<void> {
		// TODO: Phase 3 — real uninstall via EccInstallService
		const item = this.items.find(i => i.id === id);
		if (item) {
			item.state = 'disabled';
			this._onDidChangeItems.fire();
		}
	}

	refresh(): void {
		this._onDidChangeItems.fire();
	}
}