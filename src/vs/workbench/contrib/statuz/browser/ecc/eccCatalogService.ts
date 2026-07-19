/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { URI } from '../../../../../base/common/uri.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { EccCatalog, EccComponentMeta, EccInstallComponent, EccInstallModule, mapFamilyToType, mapFamilyToCategory, mapFamilyToIcon } from './eccCatalogTypes.js';
import { parseYamlFrontmatter } from './eccMetadataParser.js';
import { IAgentSkillItem, IAgentSkillFilter } from '../agentManagement.types.js';
import { AgentDefinition } from '../agentdef/agentDefinitionTypes.js';
import { eccComponentToAgentDefinition, eccCatalogToAgentDefinitions } from '../agentdef/eccAdapter.js';

export const IEccCatalogService = createDecorator<IEccCatalogService>('eccCatalogService');

export interface IEccCatalogService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeCatalog: Event<void>;
	fetchCatalog(): Promise<EccCatalog>;
	getCachedCatalog(): EccCatalog | null;
	getFilteredCatalog(filter: IAgentSkillFilter): IAgentSkillItem[];
	toAgentSkillItem(meta: EccComponentMeta): IAgentSkillItem;
	refresh(): Promise<void>;
	/** Get the ECC source root path */
	getSourcePath(): string;
	/** Convert a single component to generic AgentDefinition (new model) */
	toAgentDefinition(meta: EccComponentMeta): AgentDefinition;
	/** Convert all catalog components to AgentDefinitions */
	getAgentDefinitions(): AgentDefinition[];
}

// ─── ECC Source Root ──────────────────────────────────────────

/** Path to the local ECC source package */
const ECC_SOURCE_ROOT = 'D:\\github downloads\\ecc-universal-2.0.0\\package';

// ─── Service Implementation ───────────────────────────────────

export class EccCatalogService implements IEccCatalogService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeCatalog = new Emitter<void>();
	readonly onDidChangeCatalog: Event<void> = this._onDidChangeCatalog.event;

	private catalog: EccCatalog | null = null;
	private modules: Map<string, EccInstallModule> = new Map();

	private readonly STORAGE_KEY = 'statuz.ecc.catalog.v2';
	private readonly MODULES_KEY = 'statuz.ecc.modules';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IFileService private readonly fileService: IFileService,
	) {
		this.loadFromStorage();
	}

	getSourcePath(): string {
		return ECC_SOURCE_ROOT;
	}

	// ─── Storage Persistence ─────────────────────────────────

	private loadFromStorage(): void {
		const raw = this.storageService.get(this.STORAGE_KEY, StorageScope.PROFILE);
		if (raw) {
			try { this.catalog = JSON.parse(raw); } catch { /* ignore */ }
		}
		const modRaw = this.storageService.get(this.MODULES_KEY, StorageScope.PROFILE);
		if (modRaw) {
			try {
				const arr = JSON.parse(modRaw) as EccInstallModule[];
				this.modules = new Map(arr.map(m => [m.id, m]));
			} catch { /* ignore */ }
		}
	}

	private saveToStorage(): void {
		if (this.catalog) {
			this.storageService.store(this.STORAGE_KEY, JSON.stringify(this.catalog), StorageScope.PROFILE, StorageTarget.MACHINE);
		}
		if (this.modules.size > 0) {
			this.storageService.store(this.MODULES_KEY, JSON.stringify([...this.modules.values()]), StorageScope.PROFILE, StorageTarget.MACHINE);
		}
	}

	// ─── Catalog Loading ─────────────────────────────────────

	async fetchCatalog(): Promise<EccCatalog> {
		try {
			await this.loadFromDisk();
		} catch (err) {
			console.error('[ECC Catalog] Failed to load from disk:', err);
			// Fall back to cached or empty
			if (!this.catalog) {
				this.catalog = {
					version: '0.0.0',
					lastFetched: Date.now(),
					components: [],
					source: ECC_SOURCE_ROOT,
				};
			}
		}
		this.saveToStorage();
		return this.catalog!;
	}

	private async loadFromDisk(): Promise<void> {
		const manifestsUri = URI.file(`${ECC_SOURCE_ROOT}\\manifests`);
		const agentsUri = URI.file(`${ECC_SOURCE_ROOT}\\agents`);
		const commandsUri = URI.file(`${ECC_SOURCE_ROOT}\\commands`);

		// Read version
		let version = '2.0.0';
		try {
			const versionContent = await this.fileService.readFile(URI.file(`${ECC_SOURCE_ROOT}\\VERSION`));
			version = versionContent.value.toString().trim();
		} catch { /* use default */ }

		// Read install-components.json
		let components: EccInstallComponent[] = [];
		try {
			const compContent = await this.fileService.readFile(URI.file(`${manifestsUri.path}\\install-components.json`));
			const compData = JSON.parse(compContent.value.toString());
			components = compData.components as EccInstallComponent[];
		} catch (err) {
			console.error('[ECC Catalog] Failed to read install-components.json:', err);
		}

		// Read install-modules.json
		const modulesList: EccInstallModule[] = [];
		try {
			const modContent = await this.fileService.readFile(URI.file(`${manifestsUri.path}\\install-modules.json`));
			const modData = JSON.parse(modContent.value.toString());
			modulesList.push(...(modData.modules as EccInstallModule[]));
			this.modules = new Map(modulesList.map(m => [m.id, m]));
		} catch (err) {
			console.error('[ECC Catalog] Failed to read install-modules.json:', err);
		}

		// Scan agents/ directory for frontmatter metadata
		const agentMeta = new Map<string, { name: string; description: string; tools: string[]; model: string }>();
		try {
			const agentStat = await this.fileService.resolve(agentsUri);
			if (agentStat.children) {
				for (const child of agentStat.children) {
					if (child.name.endsWith('.md') && child.isFile) {
						try {
							const content = await this.fileService.readFile(child.resource);
							const fm = parseYamlFrontmatter(content.value.toString());
							if (fm && fm.name) {
								const agentId = `agent:${fm.name}`;
								agentMeta.set(agentId, {
									name: fm.name,
									description: fm.description || '',
									tools: Array.isArray(fm.tools) ? fm.tools : [],
									model: fm.model || '',
								});
							}
						} catch { /* skip unreadable files */ }
					}
				}
			}
		} catch { /* agents directory may not exist */ }

		// Scan commands/ directory for frontmatter metadata
		const commandMeta = new Map<string, { description: string; argumentHint?: string }>();
		try {
			const cmdStat = await this.fileService.resolve(commandsUri);
			if (cmdStat.children) {
				for (const child of cmdStat.children) {
					if (child.name.endsWith('.md') && child.isFile) {
						try {
							const content = await this.fileService.readFile(child.resource);
							const fm = parseYamlFrontmatter(content.value.toString());
							if (fm && fm.description) {
								const cmdId = child.name.replace(/\.md$/, '');
								commandMeta.set(cmdId, {
									description: fm.description,
									argumentHint: fm['argument-hint'] || undefined,
								});
							}
						} catch { /* skip unreadable files */ }
					}
				}
			}
		} catch { /* commands directory may not exist */ }

		// Build the component catalog
		const componentList: EccComponentMeta[] = [];

		// Add components from install-components.json (skip baseline)
		for (const comp of components) {
			if (comp.family === 'baseline') {
				continue; // baseline components are infrastructure, not shown
			}

			const type = mapFamilyToType(comp.family);
			if (type === null) {
				continue;
			}

			// Try to enrich with agent metadata
			let displayName = comp.id;
			let description = comp.description;
			let tags: string[] = [];

			// For agent components, check if we have enriched metadata
			if (comp.family === 'agent') {
				const agentId = comp.id; // e.g., "agent:architect"
				const meta = agentMeta.get(agentId);
				if (meta) {
					displayName = meta.name;
					description = meta.description;
					tags = meta.tools || [];
				} else {
					// Extract name from component id
					displayName = comp.id.replace(/^agent:/, '');
				}
			}

			// Resolve module details for tags
			const moduleDetails = comp.modules
				.map(mid => this.modules.get(mid))
				.filter((m): m is EccInstallModule => !!m);

			if (moduleDetails.length > 0) {
				tags.push(...moduleDetails.map(m => m.kind));
			}

			// Add family as a tag
			tags.push(comp.family);

			componentList.push({
				id: comp.id,
				name: toTitleCase(displayName),
				type,
				description,
				version,
				author: 'ECC Team',
				iconCodicon: mapFamilyToIcon(comp.family),
				category: mapFamilyToCategory(comp.family),
				tags: [...new Set(tags)],
				sourceUrl: `https://github.com/affaan-m/ECC/tree/main/package`,
				installPath: `.trae/ecc/${comp.id}/`,
				dependencies: moduleDetails.flatMap(m => m.dependencies),
				lastUpdated: Date.now(),
				fileSize: 0,
			});
		}

		// Add individual commands as separate catalog entries
		for (const [cmdId, meta] of commandMeta) {
			componentList.push({
				id: `command:${cmdId}`,
				name: toTitleCase(cmdId.replace(/-/g, ' ')),
				type: 'command',
				description: meta.description,
				version,
				author: 'ECC Team',
				iconCodicon: 'codicon-terminal',
				category: 'Development Foundations',
				tags: ['command', 'ecc'],
				sourceUrl: `https://github.com/affaan-m/ECC/tree/main/package/commands`,
				installPath: `.trae/ecc/commands/${cmdId}/`,
				lastUpdated: Date.now(),
				fileSize: 0,
			});
		}

		this.catalog = {
			version,
			lastFetched: Date.now(),
			components: componentList,
			source: ECC_SOURCE_ROOT,
		};

		console.log(`[ECC Catalog] Loaded ${componentList.length} components (v${version})`);
	}

	// ─── Query ───────────────────────────────────────────────

	getCachedCatalog(): EccCatalog | null {
		return this.catalog;
	}

	getFilteredCatalog(filter: IAgentSkillFilter): IAgentSkillItem[] {
		if (!this.catalog) {
			return [];
		}
		let result = [...this.catalog.components];

		// Filter by type
		if (filter.types.length > 0) {
			result = result.filter(c => filter.types.includes(c.type));
		}

		// Search by query
		if (filter.query.trim()) {
			const q = filter.query.toLowerCase();
			result = result.filter(c =>
				c.name.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				c.tags.some(t => t.toLowerCase().includes(q))
			);
		}

		// Sort
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

	toAgentDefinition(meta: EccComponentMeta): AgentDefinition {
		if (!this.catalog) {
			throw new Error('Catalog not loaded. Call fetchCatalog() first.');
		}
		return eccComponentToAgentDefinition(meta, this.catalog);
	}

	getAgentDefinitions(): AgentDefinition[] {
		if (!this.catalog) {
			return [];
		}
		return eccCatalogToAgentDefinitions(this.catalog);
	}

	async refresh(): Promise<void> {
		this.catalog = null;
		await this.fetchCatalog();
		this._onDidChangeCatalog.fire();
	}
}

// ─── Helpers ──────────────────────────────────────────────────

function toTitleCase(str: string): string {
	return str
		.split(/[-_\s]+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}