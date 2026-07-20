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

// ─── Deprecated imports (for backward-compatible API) ──────────
import { IAgentSkillItem, IAgentSkillFilter, ItemState } from './agentManagement.types.js';

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

export class AgentManagementService implements IAgentManagementService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeItems = new Emitter<void>();
	readonly onDidChangeItems: Event<void> = this._onDidChangeItems.event;

	// ── Active Agent Management ─────────────────────────────
	private activeAgentId: string | null = null;
	private readonly _onDidChangeActiveAgent = new Emitter<string | null>();
	readonly onDidChangeActiveAgent: Event<string | null> = this._onDidChangeActiveAgent.event;

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