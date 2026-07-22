/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IEccCatalogService } from './ecc/eccCatalogService.js';
import { IEccInstallService } from './ecc/eccInstallService.js';
import { IAgentDefinitionStorage } from './agentdef/agentDefinitionStorage.js';
import {
	AgentDefinitionWithState,
	AgentDefinitionFilter,
	AgentRuntimeState,
} from './agentdef/agentDefinitionTypes.js';
import { extractEccComponentId } from './agentdef/eccAdapter.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { AppendOnlyLog } from './harness/agentAppendOnlyLog.js';

// ─── Deprecated imports (for backward-compatible API) ──────────
import { IAgentSkillItem, IAgentSkillFilter, ItemState, ConfigSnapshot, AgentUsageRecord, AgentUsageStats } from './agentManagement.types.js';

export const IAgentManagementService = createDecorator<IAgentManagementService>('agentManagementService');

export interface IAgentManagementService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeItems: Event<void>;

	// ── New API (preferred) ──────────────────────────────────
	/** Get all definitions with runtime state */
	getDefinitionStates(): AgentDefinitionWithState[];
	/** Get filtered definitions with runtime state */
	getFilteredDefinitionStates(filter: AgentDefinitionFilter): AgentDefinitionWithState[];
	/** Get a single definition's state */
	getDefinitionState(id: string): AgentDefinitionWithState | undefined;
	/** Set runtime state for a definition */
	setDefinitionState(id: string, state: AgentRuntimeState): void;
	/** Update config for a definition */
	updateDefinitionConfig(id: string, config: Record<string, unknown>): Promise<void>;
	/** Create a new definition (write to YAML storage) */
	writeDefinition(definition: import('./agentdef/agentDefinitionTypes.js').AgentDefinition): Promise<void>;
	/** Get a single definition's raw data (for prompt injection) */
	getDefinition(id: string): Promise<import('./agentdef/agentDefinitionTypes.js').AgentDefinition | undefined>;

	// ── Active Agent Management ─────────────────────────────
	/** Set the currently active agent for Chat */
	setActiveAgent(id: string | null): void;
	/** Get the currently active agent ID */
	getActiveAgentId(): string | null;
	/** Fired when the active agent changes */
	readonly onDidChangeActiveAgent: Event<string | null>;

	// ── Config Snapshots ──────────────────────────────────────
	/** Create a snapshot of an agent's current config */
	snapshotConfig(agentId: string, label?: string): Promise<void>;
	/** Get all snapshots for an agent, ordered by timestamp desc */
	getConfigHistory(agentId: string): Promise<import('./agentManagement.types.js').ConfigSnapshot[]>;
	/** Rollback an agent's config to a specific snapshot */
	rollbackConfig(agentId: string, snapshotId: string): Promise<void>;
	/** Export an agent definition as a YAML string */
	exportDefinition(agentId: string): Promise<string>;

	// ── Usage Tracking ────────────────────────────────────────
	/** Record a usage event for an agent */
	recordUsage(agentId: string, record: import('./agentManagement.types.js').AgentUsageRecord): void;
	/** Get usage stats for a specific agent */
	getUsageStats(agentId: string): import('./agentManagement.types.js').AgentUsageStats;
	/** Get usage stats for all agents */
	getAllUsageStats(): import('./agentManagement.types.js').AgentUsageStats[];
	/** Clear usage data, optionally scoped to a specific agent */
	clearUsageData(agentId?: string): void;
	/** Fired when a usage record is successfully persisted */
	readonly onDidRecordUsage: Event<import('./agentManagement.types.js').AgentUsageRecord>;

	// ── Deprecated API (backward-compatible) ──────────────────
	/** @deprecated Use getDefinitionStates() instead */
	getItems(): IAgentSkillItem[];
	/** @deprecated Use getFilteredDefinitionStates() instead */
	getFilteredItems(filter: IAgentSkillFilter): IAgentSkillItem[];
	/** @deprecated Use getDefinitionState() instead */
	getItem(id: string): IAgentSkillItem | undefined;
	/** @deprecated Use setDefinitionState() instead */
	setItemState(id: string, state: ItemState): void;
	updateConfig(id: string, config: Record<string, any>): void;
	installItem(id: string): Promise<void>;
	uninstallItem(id: string): Promise<void>;
	refresh(): void;
}

function calculateQuantile(sorted: number[], q: number): number | undefined {
    if (sorted.length === 0) return undefined;
    const pos = (sorted.length - 1) * q;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    if (lower === upper) return sorted[lower];
    return sorted[lower] * (upper - pos) + sorted[upper] * (pos - lower);
}

export class AgentManagementService implements IAgentManagementService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeItems = new Emitter<void>();
	readonly onDidChangeItems: Event<void> = this._onDidChangeItems.event;

	// ── Active Agent Management ─────────────────────────────
	private activeAgentId: string | null = null;
	private readonly _onDidChangeActiveAgent = new Emitter<string | null>();
	readonly onDidChangeActiveAgent: Event<string | null> = this._onDidChangeActiveAgent.event;

	// ── Usage Tracking Events ───────────────────────────────
	private readonly _onDidRecordUsage = new Emitter<AgentUsageRecord>();
	readonly onDidRecordUsage: Event<AgentUsageRecord> = this._onDidRecordUsage.event;

	/** Runtime state overrides: definitionId → { state, lastUsed, usageCount } */
	private runtimeStates: Map<string, { state: AgentRuntimeState; lastUsed: number; usageCount: number }> = new Map();
	private readonly STATE_KEY = 'statuz.agent.runtimeStates.v3';

	constructor(
		@IEccCatalogService private readonly eccCatalogService: IEccCatalogService,
		@IEccInstallService private readonly eccInstallService: IEccInstallService,
		@IAgentDefinitionStorage private readonly definitionStorage: IAgentDefinitionStorage,
		@IStorageService private readonly storageService: IStorageService,
	) {
		this.loadRuntimeStates();

		// Forward catalog changes
		this.eccCatalogService.onDidChangeCatalog(() => {
			this._onDidChangeItems.fire();
		});

		// Forward install changes
		this.eccInstallService.onDidChangeInstalled(() => {
			this._onDidChangeItems.fire();
		});

		// Forward storage changes
		this.definitionStorage.onDidChangeDefinitions(() => {
			this._onDidChangeItems.fire();
		});

		// Initialize
		this.ensureInitialized();
	}

	private async ensureInitialized(): Promise<void> {
		await Promise.all([
			this.eccCatalogService.fetchCatalog().catch(() => { }),
			this.definitionStorage.ensureStorage().catch(() => { }),
		]);
		this._onDidChangeItems.fire();
	}

	// ─── Runtime State Persistence ─────────────────────────────

	private loadRuntimeStates(): void {
		const raw = this.storageService.get(this.STATE_KEY, StorageScope.PROFILE);
		if (raw) {
			try {
				const entries = JSON.parse(raw) as [string, { state: AgentRuntimeState; lastUsed: number; usageCount: number }][];
				this.runtimeStates = new Map(entries);
			} catch { /* ignore */ }
		}
	}

	private saveRuntimeStates(): void {
		this.storageService.store(
			this.STATE_KEY,
			JSON.stringify([...this.runtimeStates.entries()]),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
	}

	private getRuntimeState(id: string): { state: AgentRuntimeState; lastUsed: number; usageCount: number } {
		return this.runtimeStates.get(id) || { state: 'disabled', lastUsed: 0, usageCount: 0 };
	}

	// ─── Build Merged Definitions ──────────────────────────────

	private buildDefinitionStates(): AgentDefinitionWithState[] {
		const result: AgentDefinitionWithState[] = [];

		// 1. ECC definitions from catalog
		const eccDefs = this.eccCatalogService.getAgentDefinitions();
		for (const def of eccDefs) {
			const rt = this.getRuntimeState(def.id);
			// Override state based on ECC install status
			const eccId = extractEccComponentId(def);
			if (eccId && this.eccInstallService.isInstalled(eccId)) {
				rt.state = 'enabled';
			}
			result.push({
				definition: def,
				state: rt.state,
				lastUsed: rt.lastUsed,
				usageCount: rt.usageCount,
			});
		}

		return result;
	}

	// ─── New API ───────────────────────────────────────────────

	getDefinitionStates(): AgentDefinitionWithState[] {
		return this.buildDefinitionStates();
	}

	getFilteredDefinitionStates(filter: AgentDefinitionFilter): AgentDefinitionWithState[] {
		let result = this.buildDefinitionStates();

		// Filter by kind
		if (filter.kinds.length > 0) {
			result = result.filter(ds => filter.kinds.includes(ds.definition.kind));
		}

		// Filter by source type
		if (filter.sourceTypes.length > 0) {
			result = result.filter(ds => filter.sourceTypes.includes(ds.definition.source.type));
		}

		// Filter by state
		if (filter.state !== 'all') {
			result = result.filter(ds => ds.state === filter.state);
		}

		// Search
		if (filter.query.trim()) {
			const q = filter.query.toLowerCase();
			result = result.filter(ds =>
				ds.definition.name.toLowerCase().includes(q) ||
				ds.definition.description.toLowerCase().includes(q) ||
				ds.definition.tags.some(t => t.toLowerCase().includes(q))
			);
		}

		// Sort
		result.sort((a, b) => {
			let cmp = 0;
			switch (filter.sortBy) {
				case 'name': cmp = a.definition.name.localeCompare(b.definition.name); break;
				case 'kind': cmp = a.definition.kind.localeCompare(b.definition.kind); break;
				case 'lastUsed': cmp = a.lastUsed - b.lastUsed; break;
				case 'usageCount': cmp = a.usageCount - b.usageCount; break;
			}
			return filter.sortAsc ? cmp : -cmp;
		});

		return result;
	}

	getDefinitionState(id: string): AgentDefinitionWithState | undefined {
		return this.buildDefinitionStates().find(ds => ds.definition.id === id);
	}

	setDefinitionState(id: string, state: AgentRuntimeState): void {
		const current = this.getRuntimeState(id);
		this.runtimeStates.set(id, { ...current, state });
		this.saveRuntimeStates();
		this._onDidChangeItems.fire();
	}

	async writeDefinition(definition: import('./agentdef/agentDefinitionTypes.js').AgentDefinition): Promise<void> {
		await this.definitionStorage.writeDefinition(definition);
		this._onDidChangeItems.fire();
	}

	async updateDefinitionConfig(id: string, config: Record<string, unknown>): Promise<void> {
		const existingDef = await this.definitionStorage.readDefinition(id);
		if (!existingDef) {
			console.error(`[AgentMgmt] updateDefinitionConfig: definition not found for id="${id}"`);
			return;
		}
		// Construct new definition object (config is readonly, must replace entire object)
		const updatedDef = {
			...existingDef,
			config,
			updatedAt: Date.now(),
		};
		await this.definitionStorage.writeDefinition(updatedDef);
		this._onDidChangeItems.fire();
	}

	async getDefinition(id: string): Promise<import('./agentdef/agentDefinitionTypes.js').AgentDefinition | undefined> {
		const result = await this.definitionStorage.readDefinition(id);
		return result ?? undefined;
	}

	setActiveAgent(id: string | null): void {
		this.activeAgentId = id;
		this._onDidChangeActiveAgent.fire(id);
	}

	getActiveAgentId(): string | null {
		return this.activeAgentId;
	}

	// ─── Config Snapshots ──────────────────────────────────────

	private readonly SNAPSHOT_KEY_PREFIX = 'statuz.agent.snapshots.';

	private getSnapshotKey(agentId: string): string {
		return this.SNAPSHOT_KEY_PREFIX + agentId;
	}

	async snapshotConfig(agentId: string, label?: string): Promise<void> {
		const def = await this.definitionStorage.readDefinition(agentId);
		if (!def) { return; }
		const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const snapshot: ConfigSnapshot = {
			id: snapshotId,
			agentId,
			config: JSON.parse(JSON.stringify(def.config)),
			label: label || `Snapshot ${new Date().toLocaleString()}`,
			timestamp: Date.now(),
		};
		const key = this.getSnapshotKey(agentId);
		const raw = this.storageService.get(key, StorageScope.PROFILE);
		const snapshots: ConfigSnapshot[] = raw ? JSON.parse(raw) : [];
		snapshots.unshift(snapshot);
		if (snapshots.length > 50) { snapshots.length = 50; }
		this.storageService.store(key, JSON.stringify(snapshots), StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	async getConfigHistory(agentId: string): Promise<ConfigSnapshot[]> {
		const key = this.getSnapshotKey(agentId);
		const raw = this.storageService.get(key, StorageScope.PROFILE);
		if (!raw) { return []; }
		try { return JSON.parse(raw) as ConfigSnapshot[]; } catch { return []; }
	}

	async rollbackConfig(agentId: string, snapshotId: string): Promise<void> {
		const snapshots = await this.getConfigHistory(agentId);
		const target = snapshots.find(s => s.id === snapshotId);
		if (!target) { return; }
		await this.updateDefinitionConfig(agentId, target.config);
	}

	async exportDefinition(agentId: string): Promise<string> {
		const def = await this.definitionStorage.readDefinition(agentId);
		if (!def) { throw new Error(`Definition not found: ${agentId}`); }
		const lines: string[] = [
			`# Statuz Agent Definition`,
			`# Exported: ${new Date().toISOString()}`,
			``,
			`id: "${def.id}"`,
			`name: "${def.name}"`,
			`kind: "${def.kind}"`,
			`description: "${def.description}"`,
			`version: "${def.version}"`,
			`author: "${def.author}"`,
			`icon: "${def.icon}"`,
			`category: "${def.category}"`,
			`tags:`,
			...def.tags.map(t => `  - "${t}"`),
			`config:`,
		];
		for (const [k, v] of Object.entries(def.config)) {
			if (typeof v === 'string') {
				lines.push(`  ${k}: "${v}"`);
			} else if (Array.isArray(v)) {
				lines.push(`  ${k}:`);
				v.forEach(item => lines.push(`    - "${item}"`));
			} else {
				lines.push(`  ${k}: ${JSON.stringify(v)}`);
			}
		}
		return lines.join('\n');
	}

	// ─── Usage Tracking ────────────────────────────────────────

	private readonly USAGE_KEY = 'statuz.agent.usageRecords';
	private readonly usageLog = new AppendOnlyLog<AgentUsageRecord>(
		this.USAGE_KEY,
		this.storageService,
		5000, // maxEntries
	);

	recordUsage(agentId: string, record: AgentUsageRecord): void {
		// Immutable append via AppendOnlyLog (agentic-os pattern)
		// On overflow: AppendOnlyLog keeps the most recent 5000 entries automatically
		this.usageLog.append(record);
		// Layer 12 (agent-architecture-audit): fire event AFTER storage write succeeds
		this._onDidRecordUsage.fire(record);
	}

	getUsageStats(agentId: string): AgentUsageStats {
		const allRecords = this.usageLog.replay();
		const records = allRecords.filter(r => r.agentId === agentId);
		if (records.length === 0) {
			return {
				agentId,
				totalCalls: 0,
				totalTokensIn: 0,
				totalTokensOut: 0,
				avgLatencyMs: 0,
				successRate: 0,
				lastUsed: 0,
				recentRecords: [],
				status: 'inactive',
				summary: 'No usage data recorded for this agent.',
			};
		}
		const successCount = records.filter(r => r.success).length;
		const latencies = records.map(r => r.latencyMs).sort((a, b) => a - b);
		const errorBreakdown = this.buildErrorBreakdown(records);
		const modelDistribution = this.buildModelDistribution(records);
		const tokenTrend = this.buildTokenTrend(records);

		return {
			agentId,
			totalCalls: records.length,
			totalTokensIn: records.reduce((s, r) => s + r.tokensIn, 0),
			totalTokensOut: records.reduce((s, r) => s + r.tokensOut, 0),
			avgLatencyMs: Math.round(records.reduce((s, r) => s + r.latencyMs, 0) / records.length),
			successRate: records.length > 0 ? successCount / records.length : 0,
			lastUsed: records.length > 0 ? records[records.length - 1].timestamp : 0,
			recentRecords: records.slice(-10).reverse(),
			p50LatencyMs: calculateQuantile(latencies, 0.50),
			p95LatencyMs: calculateQuantile(latencies, 0.95),
			p99LatencyMs: calculateQuantile(latencies, 0.99),
			totalErrors: records.length - successCount,
			errorBreakdown: Object.keys(errorBreakdown).length > 0 ? errorBreakdown : undefined,
			totalToolCalls: records.reduce((s, r) => s + (r.toolCalls ?? 0), 0),
			modelDistribution: Object.keys(modelDistribution).length > 0 ? modelDistribution : undefined,
			tokenTrend: tokenTrend.length > 0 ? tokenTrend : undefined,
			status: this.computeStatus(records, successCount),
			summary: this.computeSummary(records, successCount, latencies),
		};
	}

	getAllUsageStats(): AgentUsageStats[] {
		const allRecords = this.usageLog.replay();
		const agentIds = new Set(allRecords.map(r => r.agentId));
		return Array.from(agentIds).map(id => this.getUsageStats(id));
	}

	clearUsageData(agentId?: string): void {
		if (agentId) {
			// Remove only records for the specified agent
			const allRecords = this.usageLog.replay();
			const filtered = allRecords.filter(r => r.agentId !== agentId);
			this.usageLog.clear();
			for (const record of filtered) {
				this.usageLog.append(record);
			}
		} else {
			// Clear all usage data
			this.usageLog.clear();
		}
	}

	// ─── Private helpers for usage stats ──────────────────────

	private buildErrorBreakdown(records: AgentUsageRecord[]): Record<string, number> {
		const breakdown: Record<string, number> = {};
		for (const r of records) {
			if (!r.success) {
				const category = r.errorCategory ?? 'unknown';
				breakdown[category] = (breakdown[category] || 0) + 1;
			}
		}
		return breakdown;
	}

	private buildModelDistribution(records: AgentUsageRecord[]): Record<string, number> {
		const distribution: Record<string, number> = {};
		for (const r of records) {
			const model = r.modelId ?? 'unknown';
			distribution[model] = (distribution[model] || 0) + 1;
		}
		return distribution;
	}

	private buildTokenTrend(records: AgentUsageRecord[]): { timestamp: number; tokensIn: number; tokensOut: number }[] {
		// Sample at most 50 data points for trend visualization
		const sampleSize = Math.min(records.length, 50);
		if (sampleSize === 0) {
			return [];
		}
		const step = Math.max(1, Math.floor(records.length / sampleSize));
		const trend: { timestamp: number; tokensIn: number; tokensOut: number }[] = [];
		for (let i = 0; i < records.length; i += step) {
			trend.push({
				timestamp: records[i].timestamp,
				tokensIn: records[i].tokensIn,
				tokensOut: records[i].tokensOut,
			});
		}
		// Ensure the last record is always included
		const lastRecord = records[records.length - 1];
		if (trend.length > 0 && trend[trend.length - 1].timestamp !== lastRecord.timestamp) {
			trend.push({
				timestamp: lastRecord.timestamp,
				tokensIn: lastRecord.tokensIn,
				tokensOut: lastRecord.tokensOut,
			});
		}
		return trend;
	}

	private computeStatus(records: AgentUsageRecord[], successCount: number): 'healthy' | 'degraded' | 'error' | 'inactive' {
		if (records.length === 0) {
			return 'inactive';
		}
		const successRate = successCount / records.length;
		if (successRate < 0.5) {
			return 'error';
		}
		if (successRate < 0.9) {
			return 'degraded';
		}
		return 'healthy';
	}

	private computeSummary(records: AgentUsageRecord[], successCount: number, sortedLatencies: number[]): string {
		if (records.length === 0) {
			return 'No usage data.';
		}
		const successRate = ((successCount / records.length) * 100).toFixed(1);
		const p50 = calculateQuantile(sortedLatencies, 0.50);
		const p95 = calculateQuantile(sortedLatencies, 0.95);
		const totalTokens = records.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
		return `${records.length} calls, ${successRate}% success, P50=${p50 ?? 'N/A'}ms, P95=${p95 ?? 'N/A'}ms, ${totalTokens.toLocaleString()} total tokens.`;
	}

	// ─── Deprecated API (backward-compatible) ──────────────────

	/** @deprecated Converts new model to old IAgentSkillItem for backward compatibility */
	private toLegacyItem(ds: AgentDefinitionWithState): IAgentSkillItem {
		return {
			id: ds.definition.id,
			name: ds.definition.name,
			type: ds.definition.kind as IAgentSkillItem['type'],
			description: ds.definition.description,
			version: ds.definition.version,
			author: ds.definition.author,
			state: ds.state as IAgentSkillItem['state'],
			iconCodicon: ds.definition.icon,
			installPath: ds.definition.source.type === 'ecc' ? `.trae/ecc/${ds.definition.source.componentId}/` : '',
			config: ds.definition.config as Record<string, any>,
			lastUsed: ds.lastUsed,
			usageCount: ds.usageCount,
			tags: [...ds.definition.tags],
			category: ds.definition.category,
		};
	}

	getItems(): IAgentSkillItem[] {
		return this.buildDefinitionStates().map(ds => this.toLegacyItem(ds));
	}

	getFilteredItems(filter: IAgentSkillFilter): IAgentSkillItem[] {
		const newFilter: AgentDefinitionFilter = {
			query: filter.query,
			kinds: filter.types,
			sourceTypes: [],
			state: filter.state as AgentRuntimeState | 'all',
			sortBy: filter.sortBy as 'name' | 'kind' | 'lastUsed' | 'usageCount',
			sortAsc: filter.sortAsc,
		};
		return this.getFilteredDefinitionStates(newFilter).map(ds => this.toLegacyItem(ds));
	}

	getItem(id: string): IAgentSkillItem | undefined {
		const ds = this.getDefinitionState(id);
		return ds ? this.toLegacyItem(ds) : undefined;
	}

	setItemState(id: string, state: ItemState): void {
		this.setDefinitionState(id, state as AgentRuntimeState);
	}

	updateConfig(id: string, config: Record<string, any>): Promise<void> {
		return this.updateDefinitionConfig(id, config);
	}

	async installItem(id: string): Promise<void> {
		const ds = this.getDefinitionState(id);
		if (!ds) { return; }

		const eccId = extractEccComponentId(ds.definition);
		if (eccId) {
			// ECC-sourced definition: use ECC install pipeline
			await this.eccInstallService.install(eccId);
			this.setDefinitionState(id, 'enabled');
		} else {
			// Local definition: just enable it
			this.setDefinitionState(id, 'enabled');
		}
	}

	async uninstallItem(id: string): Promise<void> {
		const ds = this.getDefinitionState(id);
		if (!ds) { return; }

		const eccId = extractEccComponentId(ds.definition);
		if (eccId) {
			await this.eccInstallService.uninstall(eccId);
		}
		this.setDefinitionState(id, 'disabled');
	}

	refresh(): void {
		this._onDidChangeItems.fire();
	}
}