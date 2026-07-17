/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseSettings.js';

export const ISupabaseClientService = createDecorator<ISupabaseClientService>('supabaseClientService');

export interface ISupabaseClientService {
	readonly _serviceBrand: undefined;
	getClient(): SupabaseClient;
	getAuth(): SupabaseClient['auth'];
}

class SupabaseClientService extends Disposable implements ISupabaseClientService {

	readonly _serviceBrand: undefined;

	private _client: SupabaseClient | null = null;

	constructor() {
		super();
	}

	getClient(): SupabaseClient {
		if (!this._client) {
			this._client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
				auth: {
					persistSession: false, // We manage session persistence manually via IStorageService
					autoRefreshToken: true,
					detectSessionInUrl: false, // No URL-based session detection in Electron
				},
			});
		}
		return this._client;
	}

	getAuth(): SupabaseClient['auth'] {
		return this.getClient().auth;
	}
}

registerSingleton(ISupabaseClientService, SupabaseClientService, InstantiationType.Delayed);