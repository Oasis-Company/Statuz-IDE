/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { AgentDefinition, AgentDefinitionIndex } from './agentDefinitionTypes.js';
import { validateAgentDefinition, validateAgentDefinitionIndex } from './agentDefinitionValidation.js';

// Dynamic require for yaml (package is in node_modules)
const yaml: typeof import('yaml') = require('yaml');

export const IAgentDefinitionStorage = createDecorator<IAgentDefinitionStorage>('agentDefinitionStorage');

export interface IAgentDefinitionStorage {
	readonly _serviceBrand: undefined;
	readonly onDidChangeDefinitions: Event<void>;

	/** Get the definitions directory URI */
	getDefinitionsDirUri(): URI;

	/** Ensure the definitions directory and index.yaml exist */
	ensureStorage(): Promise<void>;

	/** List all definition IDs from the index */
	listDefinitionIds(): Promise<string[]>;

	/** Read a single definition by ID */
	readDefinition(id: string): Promise<AgentDefinition | null>;

	/** Read all definitions */
	readAllDefinitions(): Promise<AgentDefinition[]>;

	/** Write (create or update) a definition */
	writeDefinition(definition: AgentDefinition): Promise<void>;

	/** Delete a definition by ID */
	deleteDefinition(id: string): Promise<void>;

	/** Check if a definition exists */
	exists(id: string): Promise<boolean>;
}

export class AgentDefinitionStorage implements IAgentDefinitionStorage {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeDefinitions = new Emitter<void>();
	readonly onDidChangeDefinitions: Event<void> = this._onDidChangeDefinitions.event;

	private definitionsDirUri: URI | null = null;
	private index: AgentDefinitionIndex | null = null;

	constructor(
		@IFileService private readonly fileService: IFileService,
	) { }

	getDefinitionsDirUri(): URI {
		if (!this.definitionsDirUri) {
			const homeDir = process.env.USERPROFILE || process.env.HOME || '.';
			this.definitionsDirUri = URI.file(`${homeDir}\\.statuzide\\definitions`);
		}
		return this.definitionsDirUri;
	}

	async ensureStorage(): Promise<void> {
		const dirUri = this.getDefinitionsDirUri();
		try {
			await this.fileService.createFolder(dirUri);
		} catch { /* already exists */ }

		const indexUri = URI.file(`${dirUri.fsPath}\\index.yaml`);
		try {
			await this.fileService.readFile(indexUri);
		} catch {
			// Create default index
			const defaultIndex: AgentDefinitionIndex = {
				version: 1,
				entries: {},
				updatedAt: Date.now(),
			};
			await this.fileService.writeFile(
				indexUri,
				VSBuffer.fromString(yaml.stringify(defaultIndex)),
			);
		}
		this.index = null; // Force reload on next read
	}

	// ─── Index Operations ──────────────────────────────────────

	private async readIndex(): Promise<AgentDefinitionIndex> {
		if (this.index) { return this.index; }

		const indexUri = URI.file(`${this.getDefinitionsDirUri().fsPath}\\index.yaml`);
		try {
			const content = await this.fileService.readFile(indexUri);
			const parsed = yaml.parse(content.value.toString());
			const result = validateAgentDefinitionIndex(parsed);
			if (result.success && result.data) {
				this.index = result.data;
				return result.data;
			}
			console.error('[AgentDef Storage] Invalid index.yaml:', result.errors);
		} catch (err) {
			console.error('[AgentDef Storage] Failed to read index.yaml:', err);
		}

		// Fallback to empty index
		this.index = { version: 1, entries: {}, updatedAt: Date.now() };
		return this.index;
	}

	private async writeIndex(index: AgentDefinitionIndex): Promise<void> {
		const indexUri = URI.file(`${this.getDefinitionsDirUri().fsPath}\\index.yaml`);
		index = { ...index, updatedAt: Date.now() };
		await this.fileService.writeFile(
			indexUri,
			VSBuffer.fromString(yaml.stringify(index)),
		);
		this.index = index;
	}

	// ─── CRUD Operations ───────────────────────────────────────

	async listDefinitionIds(): Promise<string[]> {
		const index = await this.readIndex();
		return Object.keys(index.entries);
	}

	async readDefinition(id: string): Promise<AgentDefinition | null> {
		const index = await this.readIndex();
		const filename = index.entries[id];
		if (!filename) { return null; }

		const fileUri = URI.file(`${this.getDefinitionsDirUri().fsPath}\\${filename}`);
		try {
			const content = await this.fileService.readFile(fileUri);
			const parsed = yaml.parse(content.value.toString());
			const result = validateAgentDefinition(parsed);
			if (result.success && result.data) {
				return result.data;
			}
			console.error(`[AgentDef Storage] Invalid definition "${id}":`, result.errors);
			return null;
		} catch (err) {
			console.error(`[AgentDef Storage] Failed to read "${id}":`, err);
			return null;
		}
	}

	async readAllDefinitions(): Promise<AgentDefinition[]> {
		const ids = await this.listDefinitionIds();
		const definitions: AgentDefinition[] = [];
		for (const id of ids) {
			const def = await this.readDefinition(id);
			if (def) {
				definitions.push(def);
			}
		}
		return definitions;
	}

	async writeDefinition(definition: AgentDefinition): Promise<void> {
		// Validate before writing
		const result = validateAgentDefinition(definition);
		if (!result.success) {
			throw new Error(`Invalid AgentDefinition: ${result.errors.join(', ')}`);
		}

		const dirUri = this.getDefinitionsDirUri();
		await this.ensureStorage();

		// Determine filename from ID
		const safeFilename = definition.id.replace(/[^a-zA-Z0-9_-]/g, '-') + '.yaml';
		const fileUri = URI.file(`${dirUri.fsPath}\\${safeFilename}`);

		// Write the YAML file
		const yamlContent = yaml.stringify(definition);
		await this.fileService.writeFile(fileUri, VSBuffer.fromString(yamlContent));

		// Update index
		const index = await this.readIndex();
		index.entries[definition.id] = safeFilename;
		await this.writeIndex(index);

		this._onDidChangeDefinitions.fire();
	}

	async deleteDefinition(id: string): Promise<void> {
		const index = await this.readIndex();
		const filename = index.entries[id];
		if (!filename) { return; } // Not found, nothing to delete

		const fileUri = URI.file(`${this.getDefinitionsDirUri().fsPath}\\${filename}`);
		try {
			await this.fileService.del(fileUri);
		} catch (err) {
			console.error(`[AgentDef Storage] Failed to delete "${id}":`, err);
		}

		// Remove from index
		delete index.entries[id];
		await this.writeIndex(index);

		this._onDidChangeDefinitions.fire();
	}

	async exists(id: string): Promise<boolean> {
		const index = await this.readIndex();
		return id in index.entries;
	}
}