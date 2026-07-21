/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentTemplate } from '../agentManagement.types.js';

// ─── Built-in Templates ─────────────────────────────────────

const BUILTIN_TEMPLATES: AgentTemplate[] = [
	{
		id: 'tmpl-code-reviewer',
		name: 'Code Reviewer',
		description: 'Reviews code for bugs, style issues, and architectural problems',
		category: 'Code Review',
		tags: ['code-review', 'quality', 'security'],
		icon: 'codicon-check-all',
		kind: 'agent',
		defaults: {
			description: 'A thorough code reviewer that checks for bugs, style, and architecture',
			config: {
				role: 'Senior code reviewer with expertise in multiple languages',
				constraints: [
					'Focus on correctness and security first, style second',
					'Suggest concrete improvements, not vague observations',
					'Reference specific line numbers when possible',
				],
				tools: ['read_file', 'search_code', 'run_tests'],
				style: 'constructive',
				domain: 'Software Engineering',
			},
			author: 'Statuz',
			version: '1.0.0',
		},
	},
	{
		id: 'tmpl-architect',
		name: 'Software Architect',
		description: 'Designs system architecture and evaluates trade-offs',
		category: 'Architecture',
		tags: ['architecture', 'design', 'system'],
		icon: 'codicon-project',
		kind: 'agent',
		defaults: {
			description: 'A system architect that helps design scalable, maintainable systems',
			config: {
				role: 'Senior software architect specializing in distributed systems',
				constraints: [
					'Always present trade-offs for each decision',
					'Consider scalability, maintainability, and cost',
					'Use diagrams and concrete examples',
				],
				tools: ['read_file', 'search_code', 'web_search'],
				style: 'analytical',
				domain: 'System Architecture',
			},
			author: 'Statuz',
			version: '1.0.0',
		},
	},
	{
		id: 'tmpl-test-writer',
		name: 'Test Engineer',
		description: 'Writes comprehensive unit tests and integration tests',
		category: 'Testing',
		tags: ['testing', 'quality', 'tdd'],
		icon: 'codicon-beaker',
		kind: 'agent',
		defaults: {
			description: 'A test engineer that writes thorough, maintainable tests',
			config: {
				role: 'Senior test engineer practicing TDD',
				constraints: [
					'Write tests that are readable and maintainable',
					'Cover edge cases and error paths',
					'Follow existing test patterns in the codebase',
				],
				tools: ['read_file', 'search_code', 'run_tests'],
				style: 'thorough',
				domain: 'Software Testing',
			},
			author: 'Statuz',
			version: '1.0.0',
		},
	},
	{
		id: 'tmpl-doc-writer',
		name: 'Documentation Writer',
		description: 'Generates clear, concise technical documentation',
		category: 'Documentation',
		tags: ['docs', 'writing', 'api'],
		icon: 'codicon-book',
		kind: 'agent',
		defaults: {
			description: 'A technical writer that produces clear, structured documentation',
			config: {
				role: 'Technical writer specializing in developer documentation',
				constraints: [
					'Use clear, concise language',
					'Include code examples where relevant',
					'Structure content with clear headings',
				],
				tools: ['read_file', 'search_code'],
				style: 'clear',
				domain: 'Technical Writing',
			},
			author: 'Statuz',
			version: '1.0.0',
		},
	},
	{
		id: 'tmpl-debugger',
		name: 'Debugger',
		description: 'Diagnoses bugs and suggests fixes with root cause analysis',
		category: 'Debugging',
		tags: ['debugging', 'troubleshooting', 'fixes'],
		icon: 'codicon-debug',
		kind: 'agent',
		defaults: {
			description: 'A debugging specialist that finds root causes and proposes fixes',
			config: {
				role: 'Senior debugger specializing in root cause analysis',
				constraints: [
					'Always identify the root cause, not just the symptom',
					'Propose minimal, targeted fixes',
					'Explain the reasoning behind each fix',
				],
				tools: ['read_file', 'search_code', 'run_tests', 'execute_command'],
				style: 'diagnostic',
				domain: 'Software Debugging',
			},
			author: 'Statuz',
			version: '1.0.0',
		},
	},
	{
		id: 'tmpl-custom',
		name: 'Blank Agent',
		description: 'Start from scratch with an empty configuration',
		category: 'Custom',
		tags: ['custom', 'blank'],
		icon: 'codicon-add',
		kind: 'agent',
		defaults: {
			description: 'A custom agent',
			config: {
				role: '',
				constraints: [],
				tools: [],
				style: '',
				domain: '',
			},
			author: 'You',
			version: '0.1.0',
		},
	},
];

// ─── Template Store ─────────────────────────────────────────

const STORAGE_KEY = 'statuz.agent.templates';

export class AgentTemplateStore {
	private customTemplates: AgentTemplate[] = [];

	constructor() {
		this.loadFromStorage();
	}

	getAllTemplates(): AgentTemplate[] {
		return [...BUILTIN_TEMPLATES, ...this.customTemplates];
	}

	getTemplate(id: string): AgentTemplate | undefined {
		return this.getAllTemplates().find(t => t.id === id);
	}

	getTemplatesByCategory(): Map<string, AgentTemplate[]> {
		const grouped = new Map<string, AgentTemplate[]>();
		for (const t of this.getAllTemplates()) {
			const cat = t.category;
			if (!grouped.has(cat)) { grouped.set(cat, []); }
			grouped.get(cat)!.push(t);
		}
		return grouped;
	}

	addCustomTemplate(template: AgentTemplate): void {
		this.customTemplates.push(template);
		this.saveToStorage();
	}

	removeCustomTemplate(id: string): void {
		this.customTemplates = this.customTemplates.filter(t => t.id !== id);
		this.saveToStorage();
	}

	private loadFromStorage(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				this.customTemplates = JSON.parse(raw) as AgentTemplate[];
			}
		} catch { /* ignore */ }
	}

	private saveToStorage(): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customTemplates));
		} catch { /* ignore */ }
	}
}