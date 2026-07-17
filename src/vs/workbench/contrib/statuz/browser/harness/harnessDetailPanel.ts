/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, clearNode, addDisposableListener } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentSkillItem } from '../agentManagement.types.js';

export interface HarnessDetailActions {
	onInstall: (id: string) => void;
	onUninstall: (id: string) => void;
	onToggle: (id: string, state: 'enabled' | 'disabled') => void;
	onConfigSave: (id: string, config: Record<string, any>) => void;
}

export class HarnessDetailPanel extends Disposable {

	private readonly container: HTMLElement;

	constructor(parent: HTMLElement) {
		super();
		this.container = parent;
		this.container.className = 'harness-detail-panel';
		this.renderEmpty();
	}

	show(item: IAgentSkillItem, actions: HarnessDetailActions): void {
		clearNode(this.container);

		const content = append(this.container, $('.harness-detail-content'));

		// Header: icon + name
		const header = append(content, $('.harness-detail-header'));
		const icon = append(header, $('span.harness-detail-icon.codicon'));
		icon.className = `harness-detail-icon codicon ${item.iconCodicon}`;
		append(header, $('.harness-detail-name')).textContent = item.name;

		// Description
		const descSection = append(content, $('.harness-detail-section'));
		append(descSection, $('.harness-detail-section-title')).textContent = 'Description';
		append(descSection, $('.harness-detail-description')).textContent = item.description;

		// Info grid
		const infoSection = append(content, $('.harness-detail-section'));
		append(infoSection, $('.harness-detail-section-title')).textContent = 'Details';
		const infoGrid = append(infoSection, $('.harness-detail-info-grid'));

		const infoRows: { label: string; value: string }[] = [
			{ label: 'Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1) },
			{ label: 'Version', value: `v${item.version}` },
			{ label: 'Author', value: item.author },
			{ label: 'Category', value: item.category },
			{ label: 'State', value: item.state.charAt(0).toUpperCase() + item.state.slice(1) },
			{ label: 'Install Path', value: item.installPath },
			{ label: 'Last Used', value: item.lastUsed > 0 ? new Date(item.lastUsed).toLocaleDateString() : 'Never' },
			{ label: 'Usage', value: `${item.usageCount} times` },
		];

		infoRows.forEach(row => {
			append(infoGrid, $('.harness-detail-info-label')).textContent = row.label;
			append(infoGrid, $('.harness-detail-info-value')).textContent = row.value;
		});

		// Tags
		if (item.tags.length > 0) {
			const tagSection = append(content, $('.harness-detail-section'));
			append(tagSection, $('.harness-detail-section-title')).textContent = 'Tags';
			const tagContainer = append(tagSection, $('.harness-detail-tags'));
			item.tags.forEach(tag => {
				append(tagContainer, $('.harness-detail-tag')).textContent = tag;
			});
		}

		// Actions
		const actionSection = append(content, $('.harness-detail-actions'));

		if (item.state === 'enabled' || item.state === 'error') {
			const uninstallBtn = append(actionSection, $('button.harness-detail-btn.danger'));
			uninstallBtn.textContent = 'Uninstall';
			this._register(addDisposableListener(uninstallBtn, 'click', () => {
				actions.onUninstall(item.id);
			}));

			const toggleBtn = append(actionSection, $('button.harness-detail-btn.secondary'));
			toggleBtn.textContent = item.state === 'enabled' ? 'Disable' : 'Enable';
			this._register(addDisposableListener(toggleBtn, 'click', () => {
				actions.onToggle(item.id, item.state === 'enabled' ? 'disabled' : 'enabled');
			}));
		} else {
			const installBtn = append(actionSection, $('button.harness-detail-btn.primary'));
			installBtn.textContent = 'Install';
			this._register(addDisposableListener(installBtn, 'click', () => {
				actions.onInstall(item.id);
			}));

			const toggleBtn = append(actionSection, $('button.harness-detail-btn.secondary'));
			toggleBtn.textContent = item.state === 'disabled' ? 'Enable' : 'Disable';
			this._register(addDisposableListener(toggleBtn, 'click', () => {
				actions.onToggle(item.id, item.state === 'disabled' ? 'enabled' : 'disabled');
			}));
		}

		// Config editor
		const configSection = append(content, $('.harness-detail-section'));
		append(configSection, $('.harness-detail-section-title')).textContent = 'Configuration';
		const configEditor = append(configSection, $('.harness-detail-config'));
		const textarea = append(configEditor, $('textarea.harness-detail-config-textarea')) as HTMLTextAreaElement;
		textarea.value = JSON.stringify(item.config, null, 2);
		const configActions = append(configEditor, $('.harness-detail-config-actions'));
		const saveBtn = append(configActions, $('button.harness-detail-btn.primary'));
		saveBtn.textContent = 'Save Config';
		this._register(addDisposableListener(saveBtn, 'click', () => {
			try {
				const parsed = JSON.parse(textarea.value);
				actions.onConfigSave(item.id, parsed);
			} catch (e) {
				// Invalid JSON — ignore
			}
		}));
	}

	private renderEmpty(): void {
		clearNode(this.container);
		const empty = append(this.container, $('.harness-detail-empty'));
		append(empty, $('span.codicon.codicon.symbol-method'));
		append(empty, $('span')).textContent = 'Select an item to view details';
	}

	hide(): void {
		this.renderEmpty();
	}

	override dispose(): void {
		super.dispose();
	}
}