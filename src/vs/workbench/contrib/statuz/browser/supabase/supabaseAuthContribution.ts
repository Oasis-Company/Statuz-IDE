/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../common/contributions.js';
import { ISupabaseAuthService } from './supabaseAuthService.js';
import { SupabaseLoginDialog } from './supabaseLoginDialog.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IContextKey, IContextKeyService, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { localize } from '../../../../../nls.js';

/* ─── Context key ────────────────────────────────────────── */

const CONTEXT_STATUZ_SIGNED_IN = new RawContextKey<boolean>('statuzSignedIn', false);

/* ─── Login dialog singleton ─────────────────────────────── */

let _loginDialog: SupabaseLoginDialog | null = null;

function showLoginDialog(authService: ISupabaseAuthService): void {
	if (_loginDialog) {
		_loginDialog.dispose();
		_loginDialog = null;
	}
	_loginDialog = new SupabaseLoginDialog(document.body, {
		onSignIn: async (email, password) => {
			const result = await authService.signIn(email, password);
			if (result.error) {
				throw new Error(result.error.message);
			}
		},
		onSignUp: async (email, password) => {
			const result = await authService.signUp(email, password);
			if (result.error) {
				throw new Error(result.error.message);
			}
		},
		onClose: () => {
			_loginDialog?.dispose();
			_loginDialog = null;
		},
	});
}

/* ─── Contribution ───────────────────────────────────────── */

export class StatuzAuthContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.statuzAuth';

	private readonly statuzSignedInContext: IContextKey<boolean>;

	constructor(
		@ISupabaseAuthService private readonly authService: ISupabaseAuthService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();
		this.statuzSignedInContext = CONTEXT_STATUZ_SIGNED_IN.bindTo(contextKeyService);
		this.initialize();
	}

	private initialize(): void {
		// Set initial context
		this.statuzSignedInContext.set(this.authService.isLoggedIn);

		// Listen for auth changes
		this._register(this.authService.onDidChangeSession(() => {
			this.statuzSignedInContext.set(this.authService.isLoggedIn);
		}));

		// Register Sign In action
		const that = this;
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: 'statuz.signInSupabase',
					title: localize('statuzSignIn', 'Sign in to Statuz...'),
					menu: {
						id: MenuId.AccountsContext,
						group: '0_signin',
						when: CONTEXT_STATUZ_SIGNED_IN.isEqualTo(false),
					},
				});
			}
			run(): void {
				showLoginDialog(that.authService);
			}
		}));

		// Register Sign Out action
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: 'statuz.signOutSupabase',
					title: localize('statuzSignOut', 'Sign out of Statuz'),
					menu: {
						id: MenuId.AccountsContext,
						group: '1_accounts',
						when: CONTEXT_STATUZ_SIGNED_IN.isEqualTo(true),
					},
				});
			}
			run(): void {
				that.authService.signOut();
			}
		}));
	}
}

registerWorkbenchContribution2(StatuzAuthContribution.ID, StatuzAuthContribution, WorkbenchPhase.AfterRestored);