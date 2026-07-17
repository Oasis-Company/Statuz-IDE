/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ISupabaseClientService } from '../supabase/supabaseClientService.js';
import { ISupabaseAuthService } from '../supabase/supabaseAuthService.js';
import { guardAsync } from './apiClient.js';
import type { ApiResult } from './apiTypes.js';
import type { BoardSyncData } from '../supabase/supabaseTypes.js';

export const IBoardDataService = createDecorator<IBoardDataService>('boardDataService');

export interface IBoardDataService {
	readonly _serviceBrand: undefined;

	/** Save board data to Supabase (project_blocks table, type='board'). */
	saveBoard(projectId: string, data: BoardSyncData): Promise<ApiResult<void>>;

	/** Load board data from Supabase. */
	loadBoard(projectId: string): Promise<ApiResult<BoardSyncData | null>>;

	/** Sync local (localStorage) board data to Supabase. */
	syncLocalToRemote(projectId: string, localStorageKey: string): Promise<ApiResult<void>>;

	/** Whether the user is authenticated and can sync. */
	readonly canSync: boolean;
}

class BoardDataService extends Disposable implements IBoardDataService {

	readonly _serviceBrand: undefined;

	constructor(
		@ISupabaseClientService private readonly supabaseClient: ISupabaseClientService,
		@ISupabaseAuthService private readonly authService: ISupabaseAuthService,
	) {
		super();
	}

	get canSync(): boolean {
		return this.authService.isLoggedIn;
	}

	async saveBoard(projectId: string, data: BoardSyncData): Promise<ApiResult<void>> {
		if (!this.canSync) {
			return { data: null, error: { type: 'auth', message: 'Not authenticated. Please sign in to sync.' } };
		}

		return guardAsync(async () => {
			const supabase = this.supabaseClient.getClient();

			// Check if a board block already exists for this project
			const { data: existing } = await supabase
				.from('project_blocks')
				.select('id')
				.eq('project_id', projectId)
				.eq('type', 'board')
				.single();

			if (existing) {
				// Update existing board
				const { error } = await supabase
					.from('project_blocks')
					.update({
						config: data as unknown as Record<string, unknown>,
						updated_at: new Date().toISOString(),
					})
					.eq('id', existing.id);
				if (error) throw error;
			} else {
				// Create new board block
				const { error } = await supabase
					.from('project_blocks')
					.insert({
						project_id: projectId,
						type: 'board',
						config: data as unknown as Record<string, unknown>,
						title: 'Strategy Board',
						position: 0,
					});
				if (error) throw error;
			}
		}, 'saveBoard');
	}

	async loadBoard(projectId: string): Promise<ApiResult<BoardSyncData | null>> {
		if (!this.canSync) {
			return { data: null, error: { type: 'auth', message: 'Not authenticated.' } };
		}

		return guardAsync(async () => {
			const supabase = this.supabaseClient.getClient();
			const { data, error } = await supabase
				.from('project_blocks')
				.select('config')
				.eq('project_id', projectId)
				.eq('type', 'board')
				.single();

			if (error) {
				if (error.code === 'PGRST116') {
					// No rows found — not an error, just no data yet
					return null;
				}
				throw error;
			}

			if (!data || !data.config) return null;

			const config = data.config as unknown as BoardSyncData;
			// Validate the config has the expected shape
			if (config && Array.isArray(config.nodes) && Array.isArray(config.edges)) {
				return config;
			}
			return null;
		}, 'loadBoard');
	}

	async syncLocalToRemote(projectId: string, localStorageKey: string): Promise<ApiResult<void>> {
		return guardAsync(async () => {
			const raw = localStorage.getItem(localStorageKey);
			if (!raw) {
				return; // Nothing to sync
			}

			const data: BoardSyncData = {
				nodes: [],
				edges: [],
				viewport: { x: 0, y: 0, zoom: 1 },
				lastModified: new Date().toISOString(),
				version: 1,
			};

			// Try to parse local data
			try {
				const local = JSON.parse(raw);
				if (local.nodeLayouts) data.nodes = local.nodeLayouts;
				if (local.edges) data.edges = local.edges;
				if (local.viewport) data.viewport = local.viewport;
			} catch {
				// If parsing fails, use empty data
			}

			await this.saveBoard(projectId, data);
		}, 'syncLocalToRemote');
	}
}

registerSingleton(IBoardDataService, BoardDataService, InstantiationType.Delayed);