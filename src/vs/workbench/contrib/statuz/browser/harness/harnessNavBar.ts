/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, addDisposableListener } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';

export type HarnessTab = 'catalog' | 'installed' | 'harness' | 'config' | 'templates' | 'design' | 'sandbox' | 'analytics' | 'pipeline' | 'regression';

export class HarnessNavBar extends Disposable {

	private readonly container: HTMLElement;
	private readonly tabButtons: Map<HarnessTab, HTMLElement> = new Map();
	private readonly onTabSwitch: (tab: HarnessTab) => void;
	private activeTab: HarnessTab = 'catalog';

	constructor(
		parent: HTMLElement,
		onTabSwitch: (tab: HarnessTab) => void,
	) {
		super();
		this.onTabSwitch = onTabSwitch;

		this.container = append(parent, $('.harness-nav-bar'));
		this.createTabs();
		this.createActions();
	}

	private createTabs(): void {
		const tabGroup = append(this.container, $('.harness-nav-tab-group'));

		const tabs: { id: HarnessTab; label: string }[] = [
			{ id: 'catalog', label: 'Catalog' },
			{ id: 'installed', label: 'Installed' },
			{ id: 'templates', label: 'Templates' },
			{ id: 'design', label: 'Design' },
			{ id: 'harness', label: 'Harness' },
			{ id: 'sandbox', label: 'Sandbox' },
			{ id: 'analytics', label: 'Analytics' },
			{ id: 'pipeline', label: 'Pipeline' },
			{ id: 'regression', label: 'Regression' },
			{ id: 'config', label: 'Config' },
		];

		tabs.forEach(tab => {
			const btn = append(tabGroup, $('button.harness-nav-tab'));
			btn.textContent = tab.label;
			btn.dataset.tab = tab.id;
			if (tab.id === this.activeTab) {
				btn.classList.add('active');
			}
			this.tabButtons.set(tab.id, btn);
			this._register(addDisposableListener(btn, 'click', () => this.switchTab(tab.id)));
		});
	}

	private createActions(): void {
		const actions = append(this.container, $('.harness-nav-actions'));

		const refreshBtn = append(actions, $('button.harness-nav-action-btn'));
		append(refreshBtn, $('span.codicon.codicon-refresh'));
		refreshBtn.title = 'Refresh Catalog';
		this._register(addDisposableListener(refreshBtn, 'click', () => {
			// TODO: Phase 2 — trigger catalog refresh
			console.log('[Harness] Refresh catalog');
		}));

		const settingsBtn = append(actions, $('button.harness-nav-action-btn'));
		append(settingsBtn, $('span.codicon.codicon-settings-gear'));
		settingsBtn.title = 'Settings';
		this._register(addDisposableListener(settingsBtn, 'click', () => {
			this.switchTab('config');
		}));
	}

	switchTab(tab: HarnessTab): void {
		if (tab === this.activeTab) {
			return;
		}
		this.activeTab = tab;

		// Update active state
		this.tabButtons.forEach((btn, id) => {
			btn.classList.toggle('active', id === tab);
		});

		this.onTabSwitch(tab);
	}

	override dispose(): void {
		super.dispose();
	}
}