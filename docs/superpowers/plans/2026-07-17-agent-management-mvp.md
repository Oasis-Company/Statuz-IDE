# Agent Management Panel MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Statuz IDE Activity Bar 的第5位实现一个完整的 Agent/Skill 管理面板（MVP），支持搜索、分类筛选、启用/禁用、详情查看、配置编辑。

**Architecture:** 采用 VS Code 原生 ViewPane + List 虚拟列表模式，数据层使用 VS Code DI 服务，渲染层使用原生 DOM（不引入 React），样式完全匹配 VS Code 扩展面板设计语言。所有文件位于 `src/vs/workbench/contrib/statuz/browser/` 目录下。

**Tech Stack:** TypeScript, VS Code ViewPane, VS Code List Widget, VS Code DI (@IInstantiationService), 原生 DOM 渲染

**参考来源:**
- VS Code 扩展面板模式: `extensionsViews.ts` + `extensionsList.ts`
- Statuz 现有面板: `dashboardPane.ts` + `boardPane.ts`
- VS Code List 组件: `src/vs/base/browser/ui/list/listWidget.ts`
- 业界参考: Cline MCP 面板、Claude Code Skills 生态

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `browser/agentManagementPane.ts` | **重写** | 主面板：搜索栏 + 筛选标签 + List 集成 + 详情视图切换 |
| `browser/agentManagementService.ts` | **新建** | 数据层：Agent/Skill 数据模型、CRUD 操作、搜索/筛选逻辑 |
| `browser/agentManagement.types.ts` | **新建** | 类型定义：`IAgentSkillItem` 接口、`AgentSkillType` 枚举、`ItemState` 枚举 |
| `browser/agentManagement.css` | **新建** | 样式：完全匹配 VS Code 扩展面板设计语言 |
| `browser/statuz.contribution.ts` | **已有** | 确保 `agentManagementPane.js` 被 import（已验证存在） |

---

## 任务 1：创建类型定义文件

**文件:** `src/vs/workbench/contrib/statuz/browser/agentManagement.types.ts` (CREATE)

- [ ] **Step 1: 定义数据模型接口和枚举**

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const AGENT_MGMT_LIST_ELEMENT_HEIGHT = 72;

export type AgentSkillType = 'agent' | 'skill' | 'command' | 'rule';

export type ItemState = 'enabled' | 'disabled' | 'error' | 'installing';

export interface IAgentSkillItem {
	id: string;
	name: string;
	type: AgentSkillType;
	description: string;
	version: string;
	author: string;
	state: ItemState;
	iconCodicon: string;       // Codicon 类名，如 'codicon-star'
	installPath: string;
	config: Record<string, any>;
	lastUsed: number;          // timestamp
	usageCount: number;
	tags: string[];
	category: string;
}

export interface IAgentSkillFilter {
	query: string;
	type: AgentSkillType | 'all';
	state: ItemState | 'all';
	sortBy: 'name' | 'lastUsed' | 'usageCount' | 'state';
	sortAsc: boolean;
}

// 用于 List 模板渲染的数据结构
export interface IAgentSkillTemplateData {
	root: HTMLElement;
	element: HTMLElement;
	icon: HTMLElement;         // codicon span
	name: HTMLElement;
	description: HTMLElement;
	typeLabel: HTMLElement;
	stateIndicator: HTMLElement;
	actionContainer: HTMLElement;
	item: IAgentSkillItem | null;
}
```

- [ ] **Step 2: 验证编译通过**

Run: `npm run compile 2>&1 | findstr /V "ms"` — 应无错误

- [ ] **Step 3: Commit**

```bash
git add src/vs/workbench/contrib/statuz/browser/agentManagement.types.ts
git commit -m "feat(agent-mgmt): add type definitions for Agent Management panel"
```

---

## 任务 2：创建数据服务层

**文件:** `src/vs/workbench/contrib/statuz/browser/agentManagementService.ts` (CREATE)

- [ ] **Step 1: 创建服务类**

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentSkillItem, IAgentSkillFilter, AgentSkillType, ItemState } from './agentManagement.types.js';
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
	refresh(): void;
}

// 注意：此处不实现，实现在 Service 类中
```

- [ ] **Step 2: 实现服务类**

```typescript
import { IAgentSkillItem, IAgentSkillFilter, AgentSkillType, ItemState } from './agentManagement.types.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';

export class AgentManagementService implements IAgentManagementService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeItems = new Emitter<void>();
	readonly onDidChangeItems: Event<void> = this._onDidChangeItems.event;

	private items: IAgentSkillItem[] = [];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
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
		if (filter.type !== 'all') {
			result = result.filter(item => item.type === filter.type);
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

	refresh(): void {
		this._onDidChangeItems.fire();
	}
}
```

- [ ] **Step 2: 验证编译通过**

Run: `npm run compile 2>&1 | findstr /V "ms"` — 应无错误

- [ ] **Step 3: Commit**

```bash
git add src/vs/workbench/contrib/statuz/browser/agentManagementService.ts
git commit -m "feat(agent-mgmt): add data service layer with sample data"
```

---

## 任务 3：创建样式文件

**文件:** `src/vs/workbench/contrib/statuz/browser/agentManagement.css` (CREATE)

- [ ] **Step 1: 创建 CSS 文件，完全匹配 VS Code 扩展面板设计语言**

```css
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* ===== Search Container ===== */
.agent-mgmt-search-container {
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	padding: 8px 12px 0;
}

.agent-mgmt-search-box {
	box-sizing: border-box;
	display: flex;
	align-items: center;
	flex: 1;
	background-color: var(--vscode-input-background);
	color: var(--vscode-input-foreground);
	border: 1px solid var(--vscode-input-border, transparent);
	border-radius: 4px;
	padding: 3px 4px;
	gap: 4px;
}

.agent-mgmt-search-box:focus-within {
	border-color: var(--vscode-focusBorder);
}

.agent-mgmt-search-icon {
	font-size: 14px;
	padding: 0 4px;
	color: var(--vscode-input-placeholderForeground);
	display: flex;
	align-items: center;
}

.agent-mgmt-search-input {
	flex: 1;
	background: none;
	border: none;
	outline: none;
	color: var(--vscode-input-foreground);
	font-family: var(--vscode-font-family);
	font-size: 13px;
	padding: 2px 0;
	min-width: 0;
}

.agent-mgmt-search-input::placeholder {
	color: var(--vscode-input-placeholderForeground);
}

.agent-mgmt-search-clear {
	font-size: 14px;
	padding: 2px 4px;
	cursor: pointer;
	color: var(--vscode-input-placeholderForeground);
	display: none;
	align-items: center;
	border-radius: 4px;
}

.agent-mgmt-search-clear:hover {
	color: var(--vscode-foreground);
	background-color: var(--vscode-toolbar-hoverBackground);
}

.agent-mgmt-search-clear.visible {
	display: flex;
}

/* ===== Filter Bar ===== */
.agent-mgmt-filter-bar {
	display: flex;
	padding: 8px 0 4px;
	gap: 2px;
	border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
	overflow-x: auto;
}

.agent-mgmt-filter-tab {
	background: none;
	border: none;
	color: var(--vscode-foreground);
	font-family: var(--vscode-font-family);
	font-size: 12px;
	padding: 4px 10px;
	cursor: pointer;
	opacity: 0.7;
	border-radius: 4px 4px 0 0;
	position: relative;
	white-space: nowrap;
	transition: opacity 0.1s;
}

.agent-mgmt-filter-tab:hover {
	opacity: 1;
	background-color: var(--vscode-toolbar-hoverBackground);
}

.agent-mgmt-filter-tab.active {
	opacity: 1;
	font-weight: 600;
}

.agent-mgmt-filter-tab.active::after {
	content: '';
	position: absolute;
	bottom: -1px;
	left: 4px;
	right: 4px;
	height: 2px;
	background-color: var(--vscode-activityBar-activeBorder);
	border-radius: 1px;
}

/* ===== List Container ===== */
.agent-mgmt-list {
	height: 100%;
	overflow: hidden;
}

/* ===== List Item ===== */
.agent-mgmt-item {
	display: flex;
	align-items: flex-start;
	padding: 8px 12px;
	gap: 10px;
	cursor: pointer;
	box-sizing: border-box;
	height: 72px;
	user-select: none;
}

.agent-mgmt-item:hover {
	background-color: var(--vscode-list-hoverBackground);
}

.agent-mgmt-item.selected {
	background-color: var(--vscode-list-activeSelectionBackground);
	color: var(--vscode-list-activeSelectionForeground);
}

.agent-mgmt-item.disabled {
	opacity: 0.6;
}

.agent-mgmt-item.error {
	border-left: 3px solid var(--vscode-errorForeground);
	padding-left: 9px;
}

/* ===== Item Icon ===== */
.agent-mgmt-item-icon {
	width: 42px;
	height: 42px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24px;
	border-radius: 6px;
	background-color: var(--vscode-sideBar-background);
	border: 1px solid var(--vscode-sideBarSectionHeader-border);
}

/* ===== Item Details ===== */
.agent-mgmt-item-details {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
	overflow: hidden;
}

.agent-mgmt-item-header {
	display: flex;
	align-items: center;
	gap: 6px;
}

.agent-mgmt-item-name {
	font-size: 13px;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.agent-mgmt-item-type-badge {
	font-size: 10px;
	padding: 1px 5px;
	border-radius: 3px;
	background-color: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
	white-space: nowrap;
	flex-shrink: 0;
	text-transform: uppercase;
	letter-spacing: 0.3px;
}

.agent-mgmt-item-description {
	font-size: 12px;
	color: var(--vscode-descriptionForeground);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.agent-mgmt-item-footer {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 11px;
}

/* ===== State Indicator ===== */
.agent-mgmt-state-indicator {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 11px;
}

.agent-mgmt-state-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.agent-mgmt-state-dot.enabled {
	background-color: var(--vscode-testing-iconPassed);
}

.agent-mgmt-state-dot.disabled {
	background-color: var(--vscode-disabledForeground);
}

.agent-mgmt-state-dot.error {
	background-color: var(--vscode-errorForeground);
}

.agent-mgmt-state-dot.installing {
	background-color: var(--vscode-editorInfo-foreground);
	animation: agent-mgmt-pulse 1.5s ease-in-out infinite;
}

@keyframes agent-mgmt-pulse {
	0%, 100% { opacity: 0.4; }
	50% { opacity: 1; }
}

.agent-mgmt-state-label {
	color: var(--vscode-descriptionForeground);
}

/* ===== Item Action Button ===== */
.agent-mgmt-item-toggle {
	background: none;
	border: 1px solid var(--vscode-sideBarSectionHeader-border);
	color: var(--vscode-foreground);
	font-size: 11px;
	padding: 2px 8px;
	border-radius: 4px;
	cursor: pointer;
	white-space: nowrap;
	flex-shrink: 0;
	transition: background-color 0.1s;
}

.agent-mgmt-item-toggle:hover {
	background-color: var(--vscode-toolbar-hoverBackground);
}

.agent-mgmt-item-toggle.enabled {
	background-color: var(--vscode-testing-iconPassed);
	color: var(--vscode-editor-background);
	border-color: var(--vscode-testing-iconPassed);
}

/* ===== Empty / Message State ===== */
.agent-mgmt-message-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	padding: 24px;
	text-align: center;
}

.agent-mgmt-message-icon {
	font-size: 48px;
	opacity: 0.3;
	margin-bottom: 12px;
}

.agent-mgmt-message-text {
	font-size: 13px;
	color: var(--vscode-descriptionForeground);
	max-width: 240px;
	line-height: 1.4;
}

/* ===== Detail View ===== */
.agent-mgmt-detail {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.agent-mgmt-detail-header {
	display: flex;
	align-items: center;
	padding: 12px;
	gap: 8px;
	border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
}

.agent-mgmt-detail-back {
	background: none;
	border: none;
	color: var(--vscode-foreground);
	font-size: 18px;
	cursor: pointer;
	padding: 4px;
	border-radius: 4px;
	display: flex;
	align-items: center;
}

.agent-mgmt-detail-back:hover {
	background-color: var(--vscode-toolbar-hoverBackground);
}

.agent-mgmt-detail-title {
	font-size: 15px;
	font-weight: 600;
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.agent-mgmt-detail-body {
	flex: 1;
	overflow-y: auto;
	padding: 12px;
}

.agent-mgmt-detail-section {
	margin-bottom: 16px;
}

.agent-mgmt-detail-section-title {
	font-size: 12px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--vscode-descriptionForeground);
	margin-bottom: 8px;
}

.agent-mgmt-detail-info-row {
	display: flex;
	justify-content: space-between;
	padding: 4px 0;
	font-size: 13px;
}

.agent-mgmt-detail-info-label {
	color: var(--vscode-descriptionForeground);
}

.agent-mgmt-detail-info-value {
	font-weight: 500;
	text-align: right;
	max-width: 60%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.agent-mgmt-detail-description {
	font-size: 13px;
	line-height: 1.5;
	color: var(--vscode-foreground);
}

.agent-mgmt-detail-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}

.agent-mgmt-detail-tag {
	font-size: 11px;
	padding: 2px 8px;
	border-radius: 3px;
	background-color: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
}

/* ===== Config Editor ===== */
.agent-mgmt-config-section {
	margin-top: 16px;
}

.agent-mgmt-config-textarea {
	width: 100%;
	min-height: 120px;
	box-sizing: border-box;
	background-color: var(--vscode-input-background);
	color: var(--vscode-input-foreground);
	border: 1px solid var(--vscode-input-border, transparent);
	border-radius: 4px;
	padding: 8px;
	font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
	font-size: 12px;
	resize: vertical;
	outline: none;
	tab-size: 2;
}

.agent-mgmt-config-textarea:focus {
	border-color: var(--vscode-focusBorder);
}

.agent-mgmt-config-actions {
	display: flex;
	gap: 8px;
	margin-top: 8px;
}

.agent-mgmt-config-save {
	background-color: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	border: none;
	padding: 4px 14px;
	border-radius: 4px;
	cursor: pointer;
	font-size: 12px;
	font-family: var(--vscode-font-family);
	transition: background-color 0.1s;
}

.agent-mgmt-config-save:hover {
	background-color: var(--vscode-button-hoverBackground);
}

.agent-mgmt-config-cancel {
	background-color: var(--vscode-button-secondaryBackground);
	color: var(--vscode-button-secondaryForeground);
	border: none;
	padding: 4px 14px;
	border-radius: 4px;
	cursor: pointer;
	font-size: 12px;
	font-family: var(--vscode-font-family);
	transition: background-color 0.1s;
}

.agent-mgmt-config-cancel:hover {
	background-color: var(--vscode-button-secondaryHoverBackground);
}

/* ===== Status Bar ===== */
.agent-mgmt-status-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 4px 12px;
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
	background-color: var(--vscode-sideBar-background);
}

.agent-mgmt-status-count {
	display: flex;
	align-items: center;
	gap: 4px;
}
```

- [ ] **Step 2: 验证 CSS 无语法错误（无操作，VS Code 编译时会检查）**

- [ ] **Step 3: Commit**

```bash
git add src/vs/workbench/contrib/statuz/browser/agentManagement.css
git commit -m "feat(agent-mgmt): add VS Code native style sheet"
```

---

## 任务 4：重写 agentManagementPane.ts — 主面板

**文件:** `src/vs/workbench/contrib/statuz/browser/agentManagementPane.ts` (REWRITE)

- [ ] **Step 1: 导入依赖和 CSS**

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

import './agentManagement.css';
import './media/statuz-activity-icon.svg';

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';
import * as nls from '../../../../nls.js';
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
import { append, $, clearNode, addDisposableListener, h } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { IAgentManagementService, AgentManagementService } from './agentManagementService.js';
import { IAgentSkillItem, IAgentSkillFilter, AgentSkillType, ItemState, AGENT_MGMT_LIST_ELEMENT_HEIGHT, IAgentSkillTemplateData } from './agentManagement.types.js';
import { List } from '../../../../base/browser/ui/list/listWidget.js';
import { IListVirtualDelegate, IListRenderer } from '../../../../base/browser/ui/list/list.js';
```

- [ ] **Step 2: 实现 List 虚拟化 Delegate**

```typescript
class AgentListDelegate implements IListVirtualDelegate<IAgentSkillItem> {
	getHeight(element: IAgentSkillItem): number {
		return AGENT_MGMT_LIST_ELEMENT_HEIGHT;
	}
	getTemplateId(element: IAgentSkillItem): string {
		return 'agent-item';
	}
}
```

- [ ] **Step 3: 实现 List Renderer**

```typescript
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
```

- [ ] **Step 4: 实现 ViewPane 主类**

```typescript
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
	private currentDetailItem: IAgentSkillItem | null = null;
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
		const searchIcon = append(searchBox, $('span.agent-mgmt-search-icon.codicon.codicon-search'));
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
				const item = this.list?.getElementAt(e.index);
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
			const icon = append(clearNode(this.messageContainer), $('span.agent-mgmt-message-icon.codicon.codicon-search'));
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
		this.currentDetailItem = item;
		this.listContainer.style.display = 'none';
		this.messageContainer.style.display = 'none';
		this.detailContainer.style.display = 'flex';
		this.detailContainer.innerHTML = '';
		this.renderDetailView(this.detailContainer, item);
	}

	private showList(): void {
		this.isShowingDetail = false;
		this.currentDetailItem = null;
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
					// Show error in textarea border
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
```

- [ ] **Step 5: 保留注册代码（与现有代码一致）**

```typescript
// ---------- Register view container ----------

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
```

- [ ] **Step 6: 更新注册代码中注入的依赖——添加 `IAgentManagementService`**

在 `AgentManagementViewPane` 构造函数中注入 `@IAgentManagementService`，需要在模块级别注册该服务。在文件末尾（注册代码之前）添加：

```typescript
// Register the service
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
registerSingleton(IAgentManagementService, AgentManagementService, 0 /* InstantiationType.Delayed */);
```

- [ ] **Step 7: 验证编译通过**

Run: `npm run compile 2>&1 | findstr /V "ms"` — 应无错误

- [ ] **Step 8: Commit**

```bash
git add src/vs/workbench/contrib/statuz/browser/agentManagementPane.ts
git commit -m "feat(agent-mgmt): implement full Agent Management MVP panel"
```

---

## 任务 5：更新 contribution 文件中图标路径

**文件:** `src/vs/workbench/contrib/statuz/browser/statuz.contribution.ts` (VERIFY)

- [ ] **Step 1: 确认 import 已存在**

```typescript
// register Agent Management pane (Activity Bar)
import './agentManagementPane.js'
```

- [ ] **Step 2: 验证无改动需要（已在上次会话中注册）**

---

## 任务 6：编译验证

- [ ] **Step 1: 执行完整编译**

Run: `cd 'd:\github projects\Statuz-IDE' ; npm run compile 2>&1`

Expected: `Finished compilation with 0 errors`

- [ ] **Step 2: 如果编译报错，修复问题**

常见错误：
1. `AgentManagementService` 未导出或注册 → 检查 `registerSingleton` 调用
2. `IAgentManagementService` 未正确注入 → 检查 `createDecorator` 和 `@IAgentManagementService` 参数名
3. List 类型参数不匹配 → 检查 `IAgentSkillItem` 和 `List<IAgentSkillItem>` 一致性
4. 导入路径错误 → 检查 `../../../../` 相对路径是否正确

- [ ] **Step 3: 验证成功后 Commit**

```bash
git add -A
git commit -m "chore: verify Agent Management MVP compilation"
```

---

## 任务 7：启动验证

- [ ] **Step 1: 启动应用**

Run: `Start-Process '.build\electron\Statuz.exe' -ArgumentList '--no-cached-data'`

- [ ] **Step 2: 验证功能**

1. 点击 Activity Bar 中 Agent Management 图标（第5位，菱形符号）
2. 确认面板显示搜索栏 + 5个筛选标签（All / Agents / Skills / Commands / Rules）
3. 确认列表显示 8 个示例项，每个包含图标、名称、类型徽章、描述、状态指示器
4. 点击列表项，确认进入详情视图
5. 在详情视图中点击 Enable/Disable 按钮，确认状态切换
6. 点击 Edit Config，编辑 JSON，点击 Save，确认配置保存
7. 点击返回箭头，确认回到列表
8. 搜索框输入关键词，确认列表实时过滤
9. 点击筛选标签，确认分类过滤生效
10. 状态栏显示 "X items" 和 "Y total"

---

## 计划自审

### Spec 覆盖检查

- [x] 搜索列表 → 任务 4 (search bar + list)
- [x] 状态指示 → 任务 4 (state indicator with colored dots)
- [x] 启用/禁用 → 任务 4 (toggle button in list + detail)
- [x] 查看详情 → 任务 4 (detail view)
- [x] 配置编辑 → 任务 4 (config editor with JSON)
- [x] 分类筛选 → 任务 4 (filter tabs)
- [x] VS Code 原生风格 → 任务 3 (CSS matching VS Code design language)
- [x] 数据层 → 任务 2 (service with sample data)

### 占位符检查

- [ ] 无 "TBD", "TODO", "implement later" 占位符
- [ ] 每步代码完整
- [ ] 所有文件路径精确

### 类型一致性检查

- [x] `IAgentSkillItem` 在 types.ts 中定义，在 service.ts 和 pane.ts 中使用，类型一致
- [x] `IAgentSkillFilter` 在 types.ts 中定义，在 service.ts 中使用，类型一致
- [x] `AGENT_MGMT_LIST_ELEMENT_HEIGHT = 72` 与 `AgentListDelegate.getHeight()` 一致
- [x] `IAgentSkillTemplateData` 与 `AgentListRenderer.renderTemplate()` 返回类型一致