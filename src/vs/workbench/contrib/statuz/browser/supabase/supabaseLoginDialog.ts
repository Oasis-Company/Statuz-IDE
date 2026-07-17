/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { clearNode, addDisposableListener } from '../../../../../base/browser/dom.js';

export type LoginDialogMode = 'signin' | 'signup' | 'forgot';

export interface LoginDialogCallbacks {
	onSignIn: (email: string, password: string) => Promise<void>;
	onSignUp: (email: string, password: string) => Promise<void>;
	onClose: () => void;
}

export class SupabaseLoginDialog extends Disposable {

	private readonly overlay: HTMLElement;
	private readonly dialog: HTMLElement;
	private readonly emailInput: HTMLInputElement;
	private readonly passwordInput: HTMLInputElement;
	private readonly submitBtn: HTMLButtonElement;
	private readonly toggleBtn: HTMLButtonElement;
	private readonly statusEl: HTMLElement;
	private readonly titleEl: HTMLElement;

	private mode: LoginDialogMode = 'signin';
	private isLoading = false;

	constructor(
		parent: HTMLElement,
		private readonly callbacks: LoginDialogCallbacks,
	) {
		super();

		// Overlay
		this.overlay = document.createElement('div');
		this.overlay.style.cssText = `
			position:fixed;top:0;left:0;width:100%;height:100%;
			background:rgba(0,0,0,0.4);z-index:1000;
			display:flex;align-items:center;justify-content:center;
		`;
		parent.appendChild(this.overlay);

		// Dialog
		this.dialog = document.createElement('div');
		this.dialog.style.cssText = `
			background:var(--vscode-editor-background,#1e1e1e);
			border:1px solid var(--vscode-sideBarSectionHeader-border,#333);
			border-radius:8px;padding:24px;width:340px;
			box-shadow:0 8px 32px rgba(0,0,0,0.3);
			font-family:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,sans-serif);
			position:relative;
		`;
		this.overlay.appendChild(this.dialog);

		// Close button (top-right)
		const closeBtn = document.createElement('button');
		closeBtn.innerHTML = '&times;';
		closeBtn.style.cssText = `
			position:absolute;top:8px;right:12px;
			background:none;border:none;color:var(--vscode-descriptionForeground,#999);
			font-size:20px;cursor:pointer;padding:4px;line-height:1;
		`;
		closeBtn.title = 'Close';
		this.dialog.appendChild(closeBtn);
		this._register(addDisposableListener(closeBtn, 'click', () => this.close()));

		// Title
		this.titleEl = document.createElement('h2');
		this.titleEl.style.cssText = `
			font-size:16px;font-weight:600;margin:0 0 16px;
			color:var(--vscode-editor-foreground,#ddd);
		`;
		this.titleEl.textContent = 'Sign In to Statuz';
		this.dialog.appendChild(this.titleEl);

		// Email input
		const emailGroup = this.createInputGroup('Email');
		this.emailInput = emailGroup.input;
		this.emailInput.type = 'email';
		this.emailInput.placeholder = 'you@example.com';
		this.dialog.appendChild(emailGroup.container);

		// Password input
		const passwordGroup = this.createInputGroup('Password');
		this.passwordInput = passwordGroup.input;
		this.passwordInput.type = 'password';
		this.passwordInput.placeholder = '••••••••';
		this.dialog.appendChild(passwordGroup.container);

		// Status message
		this.statusEl = document.createElement('div');
		this.statusEl.style.cssText = `
			font-size:12px;min-height:18px;margin:8px 0;
			color:var(--vscode-errorForeground,#f14c4c);
			display:none;
		`;
		this.dialog.appendChild(this.statusEl);

		// Submit button
		this.submitBtn = document.createElement('button');
		this.submitBtn.style.cssText = `
			width:100%;padding:8px 16px;
			background:var(--vscode-button-background,#0078d4);
			color:var(--vscode-button-foreground,#fff);
			border:1px solid var(--vscode-button-border,transparent);
			border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;
			font-family:inherit;margin-top:4px;
			transition:opacity 0.15s ease;
		`;
		this.submitBtn.textContent = 'Sign In';
		this.dialog.appendChild(this.submitBtn);
		this._register(addDisposableListener(this.submitBtn, 'click', () => this.handleSubmit()));

		// Toggle mode button
		this.toggleBtn = document.createElement('button');
		this.toggleBtn.style.cssText = `
			width:100%;padding:6px;margin-top:8px;
			background:none;border:none;
			color:var(--vscode-textLink-foreground,#3794ff);
			cursor:pointer;font-size:12px;font-family:inherit;
		`;
		this.toggleBtn.textContent = "Don't have an account? Sign Up";
		this.dialog.appendChild(this.toggleBtn);
		this._register(addDisposableListener(this.toggleBtn, 'click', () => this.toggleMode()));

		// Enter key handler
		this._register(addDisposableListener(this.passwordInput, 'keydown', (e) => {
			if (e.key === 'Enter') this.handleSubmit();
		}));
		this._register(addDisposableListener(this.emailInput, 'keydown', (e) => {
			if (e.key === 'Enter') this.passwordInput.focus();
		}));

		// Click outside to close
		this._register(addDisposableListener(this.overlay, 'click', (e) => {
			if (e.target === this.overlay) this.close();
		}));
	}

	private createInputGroup(label: string): { container: HTMLElement; input: HTMLInputElement } {
		const container = document.createElement('div');
		container.style.cssText = 'margin-bottom:12px;';

		const labelEl = document.createElement('label');
		labelEl.textContent = label;
		labelEl.style.cssText = `
			display:block;font-size:12px;margin-bottom:4px;
			color:var(--vscode-descriptionForeground,#999);
		`;
		container.appendChild(labelEl);

		const input = document.createElement('input');
		input.style.cssText = `
			width:100%;padding:6px 8px;box-sizing:border-box;
			background:var(--vscode-input-background,#3c3c3c);
			color:var(--vscode-input-foreground,#ccc);
			border:1px solid var(--vscode-input-border,#555);
			border-radius:4px;font-size:13px;font-family:inherit;
			outline:none;
		`;
		container.appendChild(input);

		return { container, input };
	}

	private toggleMode(): void {
		if (this.mode === 'signin') {
			this.mode = 'signup';
			this.titleEl.textContent = 'Create Account';
			this.submitBtn.textContent = 'Sign Up';
			this.toggleBtn.textContent = 'Already have an account? Sign In';
		} else {
			this.mode = 'signin';
			this.titleEl.textContent = 'Sign In to Statuz';
			this.submitBtn.textContent = 'Sign In';
			this.toggleBtn.textContent = "Don't have an account? Sign Up";
		}
		this.clearStatus();
	}

	private setStatus(message: string, isError: boolean): void {
		this.statusEl.textContent = message;
		this.statusEl.style.color = isError
			? 'var(--vscode-errorForeground,#f14c4c)'
			: 'var(--vscode-gitDecoration-addedResourceForeground,#4ec9b0)';
		this.statusEl.style.display = 'block';
	}

	private clearStatus(): void {
		this.statusEl.style.display = 'none';
		this.statusEl.textContent = '';
	}

	private async handleSubmit(): Promise<void> {
		if (this.isLoading) return;

		const email = this.emailInput.value.trim();
		const password = this.passwordInput.value;

		if (!email) {
			this.setStatus('Please enter your email address.', true);
			return;
		}
		if (!password || password.length < 6) {
			this.setStatus('Password must be at least 6 characters.', true);
			return;
		}

		this.isLoading = true;
		this.submitBtn.disabled = true;
		this.submitBtn.style.opacity = '0.7';
		this.submitBtn.textContent = this.mode === 'signin' ? 'Signing in...' : 'Creating account...';
		this.clearStatus();

		try {
			if (this.mode === 'signin') {
				await this.callbacks.onSignIn(email, password);
			} else {
				await this.callbacks.onSignUp(email, password);
			}
			this.close();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
			this.setStatus(message, true);
		} finally {
			this.isLoading = false;
			this.submitBtn.disabled = false;
			this.submitBtn.style.opacity = '1';
			this.submitBtn.textContent = this.mode === 'signin' ? 'Sign In' : 'Sign Up';
		}
	}

	close(): void {
		this.callbacks.onClose();
	}

	override dispose(): void {
		clearNode(this.overlay);
		this.overlay.remove();
		super.dispose();
	}
}