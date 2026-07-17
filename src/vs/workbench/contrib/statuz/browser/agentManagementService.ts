/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentSkillItem, IAgentSkillFilter, ItemState } from './agentManagement.types.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IEccCatalogService } from './ecc/eccCatalogService.js';
import { IEccInstallService } from './ecc/eccInstallService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

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

	/** Tracks per-item state overrides (config, lastUsed, etc.) */
	private stateOverrides: Map<string, Partial<IAgentSkillItem>> = new Map();
	private readonly STATE_KEY = 'statuz.agent.overrides.v2';

	constructor(
		@IEccCatalogService private readonly eccCatalogService: IEccCatalogService,
		@IEccInstallService private readonly eccInstallService: IEccInstallService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		this.loadStateOverrides();

		// Forward catalog changes to UI
		this.eccCatalogService.onDidChangeCatalog(() => {
			this._onDidChangeItems.fire();
		});

		// Forward install changes to UI
		this.eccInstallService.onDidChangeInstalled(() => {
			this._onDidChangeItems.fire();
		});

		// Trigger initial catalog load from disk (not from cache)
		this.ensureCatalogLoaded();
	}

	private async ensureCatalogLoaded(): Promise<void> {
		if (!this.eccCatalogService.getCachedCatalog()) {
			await this.eccCatalogService.fetchCatalog();
			this._onDidChangeItems.fire();
		} else {
			// Try to refresh from disk in background
			this.eccCatalogService.fetchCatalog().then(() => {
				this._onDidChangeItems.fire();
			}).catch(() => {
				// Use cached version if disk load fails
			});
		}
	}

	// ─── State Override Persistence ───────────────────────────

	private loadStateOverrides(): void {
		const raw = this.storageService.get(this.STATE_KEY, StorageScope.PROFILE);
		if (raw) {
			try {
				const entries = JSON.parse(raw) as [string, Partial<IAgentSkillItem>][];
				this.stateOverrides = new Map(entries);
			} catch { /* ignore */ }
		}
	}

	private saveStateOverrides(): void {
		this.storageService.store(
			this.STATE_KEY,
			JSON.stringify([...this.stateOverrides.entries()]),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
	}

	// ─── Build Items from ECC Catalog ─────────────────────────

	private buildItems(): IAgentSkillItem[] {
		const catalog = this.eccCatalogService.getCachedCatalog();
		if (!catalog) {
			return [];
		}

		return catalog.components.map(comp => {
			// Start with the catalog item
			const item: IAgentSkillItem = this.eccCatalogService.toAgentSkillItem(comp);

			// Apply state from install service
			if (this.eccInstallService.isInstalled(comp.id)) {
				item.state = 'enabled';
			}

			// Apply state overrides
			const override = this.stateOverrides.get(comp.id);
			if (override) {
				if (override.state !== undefined) item.state = override.state;
				if (override.config !== undefined) item.config = { ...item.config, ...override.config };
				if (override.lastUsed !== undefined) item.lastUsed = override.lastUsed;
				if (override.usageCount !== undefined) item.usageCount = override.usageCount;
			}

			return item;
		});
	}

	// ─── Public API ───────────────────────────────────────────

	getItems(): IAgentSkillItem[] {
		return this.buildItems();
	}

	getFilteredItems(filter: IAgentSkillFilter): IAgentSkillItem[] {
		// Start with catalog-level filtering (type + search)
		let result = this.eccCatalogService.getFilteredCatalog(filter);

		// Apply state overrides to filtered items
		result = result.map(item => {
			// Apply install state
			if (this.eccInstallService.isInstalled(item.id)) {
				item.state = 'enabled';
			}
			// Apply overrides
			const override = this.stateOverrides.get(item.id);
			if (override) {
				if (override.state !== undefined) item.state = override.state;
				if (override.config !== undefined) item.config = { ...item.config, ...override.config };
				if (override.lastUsed !== undefined) item.lastUsed = override.lastUsed;
				if (override.usageCount !== undefined) item.usageCount = override.usageCount;
			}
			return item;
		});

		// Apply state filter (only for catalog items, since we already filtered)
		if (filter.state !== 'all') {
			result = result.filter(item => item.state === filter.state);
		}

		// Apply sort
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
		const items = this.buildItems();
		return items.find(item => item.id === id);
	}

	setItemState(id: string, state: ItemState): void {
		let override = this.stateOverrides.get(id) || {};
		override.state = state;
		this.stateOverrides.set(id, override);
		this.saveStateOverrides();
		this._onDidChangeItems.fire();
	}

	updateConfig(id: string, config: Record<string, any>): void {
		let override = this.stateOverrides.get(id) || {};
		override.config = { ...(override.config || {}), ...config };
		this.stateOverrides.set(id, override);
		this.saveStateOverrides();
		this._onDidChangeItems.fire();
	}

	async installItem(id: string): Promise<void> {
		// Ensure catalog is loaded before install
		const catalog = this.eccCatalogService.getCachedCatalog();
		if (!catalog) {
			await this.eccCatalogService.fetchCatalog();
		}
		await this.eccInstallService.install(id);
		this._onDidChangeItems.fire();
	}

	async uninstallItem(id: string): Promise<void> {
		await this.eccInstallService.uninstall(id);
		this._onDidChangeItems.fire();
	}

	refresh(): void {
		this._onDidChangeItems.fire();
	}
}