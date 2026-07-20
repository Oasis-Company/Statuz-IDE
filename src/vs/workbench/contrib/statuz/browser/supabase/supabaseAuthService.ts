/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { ISupabaseClientService } from './supabaseClientService.js';
import { SUPABASE_STORAGE_KEY } from './supabaseSettings.js';
import { guardAsync } from '../board/apiClient.js';
import type { ApiResult } from '../board/apiTypes.js';
import type { Session, User, AuthResponse } from '@supabase/supabase-js';

export const ISupabaseAuthService = createDecorator<ISupabaseAuthService>('supabaseAuthService');

export interface ISupabaseAuthService {
	readonly _serviceBrand: undefined;

	/** Sign in with email and password. */
	signIn(email: string, password: string): Promise<ApiResult<Session>>;

	/** Sign up with email and password. */
	signUp(email: string, password: string): Promise<ApiResult<Session>>;

	/** Sign out the current user. */
	signOut(): Promise<ApiResult<void>>;

	/** Get the currently logged-in user, or null. */
	getCurrentUser(): User | null;

	/** Get the current session, or null. */
	getCurrentSession(): Session | null;

	/** Restore session from persisted storage. */
	restoreSession(): Promise<ApiResult<Session | null>>;

	/** Fired when the auth session changes (login/logout/token refresh). */
	readonly onDidChangeSession: Event<Session | null>;

	/** Whether a user is currently logged in. */
	readonly isLoggedIn: boolean;
}

class SupabaseAuthService extends Disposable implements ISupabaseAuthService {

	readonly _serviceBrand: undefined;

	private _currentSession: Session | null = null;
	private _currentUser: User | null = null;

	private readonly _onDidChangeSession = this._register(new Emitter<Session | null>());
	readonly onDidChangeSession: Event<Session | null> = this._onDidChangeSession.event;

	constructor(
		@ISupabaseClientService private readonly supabaseClient: ISupabaseClientService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		// Auto-restore session on construction
		this.restoreSession();

		// Listen for auth state changes
		this._register(toDisposable(() => {
			// Cleanup handled by auth listener
		}));
		// Subscribe to Supabase auth state changes
		const auth = this.supabaseClient.getAuth();
		if (auth) {
			const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
				this._currentSession = session;
				this._currentUser = session?.user ?? null;
				this._onDidChangeSession.fire(session);

				// Persist session to IStorageService
				if (session) {
					this.storageService.store(SUPABASE_STORAGE_KEY, JSON.stringify({
						access_token: session.access_token,
						refresh_token: session.refresh_token,
						expires_at: Date.now() + (session.expires_in || 3600) * 1000,
					}), StorageScope.APPLICATION, StorageTarget.MACHINE);
				} else {
					this.storageService.remove(SUPABASE_STORAGE_KEY, StorageScope.APPLICATION);
				}
			});
			this._register(toDisposable(() => subscription.unsubscribe()));
		}
	}

	get isLoggedIn(): boolean {
		return this._currentSession !== null && this._currentUser !== null;
	}

	getCurrentUser(): User | null {
		return this._currentUser;
	}

	getCurrentSession(): Session | null {
		return this._currentSession;
	}

	private _getAuth() {
		const auth = this.supabaseClient.getAuth();
		if (!auth) {
			throw new Error('Supabase auth not available');
		}
		return auth;
	}

	async signIn(email: string, password: string): Promise<ApiResult<Session>> {
		if (!this.supabaseClient.isAvailable()) {
			return { data: null, error: { type: 'auth', message: 'Supabase client not available' } };
		}
		const result = await guardAsync(async () => {
			const response = await this._getAuth().signInWithPassword({ email, password });
			this.handleAuthResponse(response);
			return response.data.session;
		}, 'signIn');
		return result as ApiResult<Session>;
	}

	async signUp(email: string, password: string): Promise<ApiResult<Session>> {
		if (!this.supabaseClient.isAvailable()) {
			return { data: null, error: { type: 'auth', message: 'Supabase client not available' } };
		}
		const result = await guardAsync(async () => {
			const response = await this._getAuth().signUp({ email, password });
			this.handleAuthResponse(response);
			return response.data.session!;
		}, 'signUp');

		// If signUp returns null session (email confirmation required), still return success
		if (result.data === null && result.error === null) {
			// User was created but needs email confirmation
			return { data: null, error: { type: 'validation', message: 'Email confirmation required. Please check your inbox.' } };
		}

		return result as ApiResult<Session>;
	}

	async signOut(): Promise<ApiResult<void>> {
		if (!this.supabaseClient.isAvailable()) {
			this._currentSession = null;
			this._currentUser = null;
			this.storageService.remove(SUPABASE_STORAGE_KEY, StorageScope.APPLICATION);
			this._onDidChangeSession.fire(null);
			return { data: undefined, error: null };
		}
		return guardAsync(async () => {
			await this._getAuth().signOut();
			this._currentSession = null;
			this._currentUser = null;
			this.storageService.remove(SUPABASE_STORAGE_KEY, StorageScope.APPLICATION);
			this._onDidChangeSession.fire(null);
		}, 'signOut');
	}

	async restoreSession(): Promise<ApiResult<Session | null>> {
		if (!this.supabaseClient.isAvailable()) {
			return { data: null, error: null };
		}
		return guardAsync(async () => {
			// Try to restore from IStorageService
			const stored = this.storageService.get(SUPABASE_STORAGE_KEY, StorageScope.APPLICATION);
			if (stored) {
				try {
					const parsed = JSON.parse(stored);
					if (parsed.refresh_token) {
						const { data, error } = await this._getAuth().setSession({
							access_token: parsed.access_token,
							refresh_token: parsed.refresh_token,
						});
						if (!error && data.session) {
							this._currentSession = data.session;
							this._currentUser = data.session.user;
							this._onDidChangeSession.fire(data.session);
							return data.session;
						}
					}
				} catch {
					// Corrupted storage — clear it
					this.storageService.remove(SUPABASE_STORAGE_KEY, StorageScope.APPLICATION);
				}
			}

			// Try to get existing session from Supabase
			const { data, error } = await this._getAuth().getSession();
			if (!error && data.session) {
				this._currentSession = data.session;
				this._currentUser = data.session.user;
				this._onDidChangeSession.fire(data.session);
				return data.session;
			}

			return null;
		}, 'restoreSession');
	}

	// Don't expose the full AuthResponse
	private handleAuthResponse(response: AuthResponse): void {
		if (response.error) throw response.error;
	}
}

registerSingleton(ISupabaseAuthService, SupabaseAuthService, InstantiationType.Delayed);