/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { EccCatalog, EccComponentMeta } from './eccCatalogTypes.js';
import { IAgentSkillItem, IAgentSkillFilter } from '../agentManagement.types.js';

export const IEccCatalogService = createDecorator<IEccCatalogService>('eccCatalogService');

export interface IEccCatalogService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeCatalog: Event<void>;
	fetchCatalog(): Promise<EccCatalog>;
	getCachedCatalog(): EccCatalog | null;
	getFilteredCatalog(filter: IAgentSkillFilter): IAgentSkillItem[];
	toAgentSkillItem(meta: EccComponentMeta): IAgentSkillItem;
	refresh(): Promise<void>;
}

export class EccCatalogService implements IEccCatalogService {
	readonly _serviceBrand: undefined;
	private readonly _onDidChangeCatalog = new Emitter<void>();
	readonly onDidChangeCatalog: Event<void> = this._onDidChangeCatalog.event;
	private catalog: EccCatalog | null = null;
	private readonly STORAGE_KEY = 'statuz.ecc.catalog';

	constructor(@IStorageService private readonly storageService: IStorageService) {
		this.loadFromStorage();
	}

	private loadFromStorage(): void {
		const raw = this.storageService.get(this.STORAGE_KEY, StorageScope.PROFILE);
		if (raw) {
			try { this.catalog = JSON.parse(raw); } catch { /* ignore */ }
		}
	}

	private saveToStorage(): void {
		if (this.catalog) {
			this.storageService.store(this.STORAGE_KEY, JSON.stringify(this.catalog), StorageScope.PROFILE, StorageTarget.MACHINE);
		}
	}

	async fetchCatalog(): Promise<EccCatalog> {
		// TODO: Phase 3 — real GitHub API fetch
		this.catalog = {
			version: '0.0.1',
			lastFetched: Date.now(),
			components: [],
			source: 'https://github.com/Anthropic/ecc-universal',
		};
		this.saveToStorage();
		return this.catalog;
	}

	getCachedCatalog(): EccCatalog | null {
		return this.catalog;
	}

	getFilteredCatalog(filter: IAgentSkillFilter): IAgentSkillItem[] {
		if (!this.catalog) {
			return [];
		}
		let result = [...this.catalog.components];

		if (filter.types.length > 0) {
			result = result.filter(c => filter.types.includes(c.type));
		}

		if (filter.query.trim()) {
			const q = filter.query.toLowerCase();
			result = result.filter(c =>
				c.name.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				c.tags.some(t => t.toLowerCase().includes(q))
			);
		}

		result.sort((a, b) => {
			let cmp = 0;
			switch (filter.sortBy) {
				case 'name': cmp = a.name.localeCompare(b.name); break;
				case 'lastUsed': cmp = (a.lastUpdated || 0) - (b.lastUpdated || 0); break;
				default: break;
			}
			return filter.sortAsc ? cmp : -cmp;
		});

		return result.map(c => this.toAgentSkillItem(c));
	}

	toAgentSkillItem(meta: EccComponentMeta): IAgentSkillItem {
		return {
			id: meta.id,
			name: meta.name,
			type: meta.type,
			description: meta.description,
			version: meta.version,
			author: meta.author,
			state: 'disabled',
			iconCodicon: meta.iconCodicon,
			installPath: meta.installPath,
			config: {},
			lastUsed: 0,
			usageCount: 0,
			tags: meta.tags,
			category: meta.category,
		};
	}

	async refresh(): Promise<void> {
		await this.fetchCatalog();
		this._onDidChangeCatalog.fire();
	}
}