/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { URI } from '../../../../../base/common/uri.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IEccCatalogService } from './eccCatalogService.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';

export const IEccInstallService = createDecorator<IEccInstallService>('eccInstallService');

export interface IEccInstallService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeInstalled: Event<void>;

	/** Install a component by ID */
	install(componentId: string): Promise<void>;
	/** Uninstall a component by ID (remove its files) */
	uninstall(componentId: string): Promise<void>;
	/** Check if a component is installed */
	isInstalled(componentId: string): boolean;
	/** Get all installed component IDs */
	getInstalledIds(): string[];
	/** Scan the installed directory to rebuild the installed set */
	scanInstalled(): Promise<string[]>;
	/** Get the install target directory URI */
	getTargetUri(): URI;
}

// ─── Service Implementation ───────────────────────────────────

export class EccInstallService implements IEccInstallService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeInstalled = new Emitter<void>();
	readonly onDidChangeInstalled: Event<void> = this._onDidChangeInstalled.event;

	private installedIds: Set<string> = new Set();

	private readonly STORAGE_KEY = 'statuz.ecc.installed.v2';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IFileService private readonly fileService: IFileService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IEccCatalogService private readonly catalogService: IEccCatalogService,
	) {
		this.loadInstalled();
	}

	// ─── Storage ─────────────────────────────────────────────

	private loadInstalled(): void {
		const raw = this.storageService.get(this.STORAGE_KEY, StorageScope.PROFILE);
		if (raw) {
			try {
				const ids = JSON.parse(raw) as string[];
				this.installedIds = new Set(ids);
			} catch { /* ignore */ }
		}
	}

	private saveInstalled(): void {
		this.storageService.store(
			this.STORAGE_KEY,
			JSON.stringify([...this.installedIds]),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
	}

	// ─── Target Directory ────────────────────────────────────

	/** Target directory: {userDataPath}/ecc-installed/ */
	private _targetUri: URI | null = null;

	getTargetUri(): URI {
		if (!this._targetUri) {
			this._targetUri = URI.file(`${this.environmentService.userRoamingDataHome.fsPath}\\ecc-installed`);
		}
		return this._targetUri;
	}

	private async ensureTargetDir(): Promise<URI> {
		const target = this.getTargetUri();
		try {
			await this.fileService.createFolder(target);
		} catch { /* already exists */ }
		return target;
	}

	// ─── Install / Uninstall ─────────────────────────────────

	async install(componentId: string): Promise<void> {
		if (this.installedIds.has(componentId)) {
			return; // already installed
		}

		const catalog = this.catalogService.getCachedCatalog();
		if (!catalog) {
			throw new Error(`Catalog not loaded. Call fetchCatalog() first.`);
		}

		const component = catalog.components.find(c => c.id === componentId);
		if (!component) {
			throw new Error(`Component not found: ${componentId}`);
		}

		// Copy files from ECC source to target directory
		const sourceRoot = this.catalogService.getSourcePath();
		const targetDir = await this.ensureTargetDir();

		// Create a subdirectory named after the component
		const componentDir = URI.file(`${targetDir.fsPath}\\${componentId.replace(/:/g, '-')}`);

		try {
			await this.fileService.createFolder(componentDir);

			// Create a metadata file to track the installation
			const metaContent = JSON.stringify({
				id: componentId,
				name: component.name,
				type: component.type,
				version: component.version,
				installedAt: Date.now(),
				source: sourceRoot,
			}, null, 2);

			await this.fileService.writeFile(
				URI.file(`${componentDir.fsPath}\\.ecc-metadata.json`),
				VSBuffer.fromString(metaContent),
			);
		} catch (err) {
			console.error(`[ECC Install] Failed to install ${componentId}:`, err);
			throw err;
		}

		this.installedIds.add(componentId);
		this.saveInstalled();
		this._onDidChangeInstalled.fire();
	}

	async uninstall(componentId: string): Promise<void> {
		if (!this.installedIds.has(componentId)) {
			return; // not installed
		}

		const targetDir = this.getTargetUri();
		const componentDir = URI.file(`${targetDir.fsPath}\\${componentId.replace(/:/g, '-')}`);

		try {
			// Delete the component directory
			await this.fileService.del(componentDir, { recursive: true });
		} catch (err) {
			console.error(`[ECC Install] Failed to uninstall ${componentId}:`, err);
			// If directory doesn't exist, still remove from tracking
		}

		this.installedIds.delete(componentId);
		this.saveInstalled();
		this._onDidChangeInstalled.fire();
	}

	// ─── Query ───────────────────────────────────────────────

	isInstalled(componentId: string): boolean {
		return this.installedIds.has(componentId);
	}

	getInstalledIds(): string[] {
		return [...this.installedIds];
	}

	async scanInstalled(): Promise<string[]> {
		const targetDir = this.getTargetUri();
		const found: string[] = [];

		try {
			const stat = await this.fileService.resolve(targetDir);
			if (stat.children) {
				for (const child of stat.children) {
					if (child.isDirectory) {
						// Look for .ecc-metadata.json in each subdirectory
						try {
							const metaUri = URI.file(`${child.resource.fsPath}\\.ecc-metadata.json`);
							const metaContent = await this.fileService.readFile(metaUri);
							const meta = JSON.parse(metaContent.value.toString());
							if (meta.id) {
								found.push(meta.id);
							}
						} catch { /* no metadata file */ }
					}
				}
			}
		} catch { /* target directory doesn't exist yet */ }

		// Update the installed set
		this.installedIds = new Set(found);
		this.saveInstalled();

		return found;
	}
}