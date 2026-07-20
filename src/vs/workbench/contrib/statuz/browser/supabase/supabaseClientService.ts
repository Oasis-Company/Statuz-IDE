/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { SupabaseClient } from '@supabase/supabase-js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseSettings.js';

export const ISupabaseClientService = createDecorator<ISupabaseClientService>('supabaseClientService');

export interface ISupabaseClientService {
	readonly _serviceBrand: undefined;
	isAvailable(): boolean;
	getClient(): SupabaseClient | null;
	getAuth(): SupabaseClient['auth'] | null;
}

/**
 * Lazy-loads the supabase createClient function to avoid crashing the
 * Electron renderer when the package cannot be resolved as a bare specifier.
 */
let _createClient: ((url: string, key: string, options?: any) => SupabaseClient) | null = null;
let _loadAttempted = false;

function getCreateClient(): typeof _createClient {
	if (_loadAttempted) { return _createClient; }
	_loadAttempted = true;
	try {
		// Dynamic require bypasses the static import resolution issue in Electron sandbox
		const supabase = require('@supabase/supabase-js');
		_createClient = supabase.createClient;
	} catch (err) {
		console.warn('[Supabase] Failed to load @supabase/supabase-js:', err);
		_createClient = null;
	}
	return _createClient;
}

class SupabaseClientService extends Disposable implements ISupabaseClientService {

	readonly _serviceBrand: undefined;

	private _client: SupabaseClient | null = null;

	constructor() {
		super();
	}

	isAvailable(): boolean {
		return getCreateClient() !== null;
	}

	getClient(): SupabaseClient | null {
		if (!this._client) {
			const createClient = getCreateClient();
			if (!createClient) {
				console.warn('[Supabase] Client not available — package not loaded');
				return null;
			}
			this._client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
				auth: {
					persistSession: false,
					autoRefreshToken: true,
					detectSessionInUrl: false,
				},
			});
		}
		return this._client;
	}

	getAuth(): SupabaseClient['auth'] | null {
		const client = this.getClient();
		return client ? client.auth : null;
	}
}

registerSingleton(ISupabaseClientService, SupabaseClientService, InstantiationType.Delayed);