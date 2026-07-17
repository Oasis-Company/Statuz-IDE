/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IAgentSkillItem } from '../agentManagement.types.js';

export const IEccInstallService = createDecorator<IEccInstallService>('eccInstallService');

export interface IEccInstallService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeInstallStatus: Event<void>;
	install(id: string): Promise<void>;
	uninstall(id: string): Promise<void>;
	scanInstalled(): Promise<IAgentSkillItem[]>;
	isInstalled(id: string): boolean;
	getInstalledIds(): string[];
}

export class EccInstallService implements IEccInstallService {
	readonly _serviceBrand: undefined;
	private readonly _onDidChangeInstallStatus = new Emitter<void>();
	readonly onDidChangeInstallStatus: Event<void> = this._onDidChangeInstallStatus.event;
	private installedIds: Set<string> = new Set();
	private readonly STORAGE_KEY = 'statuz.ecc.installed';

	constructor(@IStorageService private readonly storageService: IStorageService) {
		this.loadFromStorage();
	}

	private loadFromStorage(): void {
		const raw = this.storageService.get(this.STORAGE_KEY, StorageScope.PROFILE);
		if (raw) {
			try {
				const arr = JSON.parse(raw) as string[];
				this.installedIds = new Set(arr);
			} catch { /* ignore */ }
		}
	}

	private saveToStorage(): void {
		this.storageService.store(this.STORAGE_KEY, JSON.stringify([...this.installedIds]), StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	async install(id: string): Promise<void> {
		// TODO: Phase 3 — real file copy from GitHub to .trae/
		this.installedIds.add(id);
		this.saveToStorage();
		this._onDidChangeInstallStatus.fire();
	}

	async uninstall(id: string): Promise<void> {
		// TODO: Phase 3 — real file deletion from .trae/
		this.installedIds.delete(id);
		this.saveToStorage();
		this._onDidChangeInstallStatus.fire();
	}

	async scanInstalled(): Promise<IAgentSkillItem[]> {
		// TODO: Phase 3 — real .trae/ directory scan
		return [];
	}

	isInstalled(id: string): boolean {
		return this.installedIds.has(id);
	}

	getInstalledIds(): string[] {
		return [...this.installedIds];
	}
}