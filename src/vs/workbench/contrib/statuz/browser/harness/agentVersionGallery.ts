/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, clearNode, addDisposableListener } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IAgentManagementService } from '../agentManagementService.js';
import { ConfigSnapshot } from '../agentManagement.types.js';

export class AgentVersionGallery extends Disposable {

	private readonly container: HTMLElement;
	private snapshotList: ConfigSnapshot[] = [];

	constructor(
		parent: HTMLElement,
		private readonly agentId: string,
		private readonly agentMgmtService: IAgentManagementService,
		private readonly onRollback: (snapshotId: string) => void,
	) {
		super();
		this.container = parent;
		this.container.className = 'agent-version-gallery';
		this.loadSnapshots();
	}

	private async loadSnapshots(): Promise<void> {
		clearNode(this.container);

		const header = append(this.container, $('.agent-version-gallery-header'));
		append(header, $('span.codicon.codicon-history'));
		append(header, document.createTextNode(' Version History'));

		const snapBtn = append(header, $('button.agent-version-gallery-snapshot-btn')) as HTMLButtonElement;
		snapBtn.textContent = 'Save Snapshot';
		this._register(addDisposableListener(snapBtn, 'click', async () => {
			await this.agentMgmtService.snapshotConfig(this.agentId);
			await this.loadSnapshots();
		}));

		this.snapshotList = await this.agentMgmtService.getConfigHistory(this.agentId);

		if (this.snapshotList.length === 0) {
			const empty = append(this.container, $('.agent-version-gallery-empty'));
			append(empty, $('span.codicon.codicon-info'));
			append(empty, $('span')).textContent = 'No snapshots yet. Save one to start tracking changes.';
			return;
		}

		const list = append(this.container, $('.agent-version-gallery-list'));
		for (const snap of this.snapshotList) {
			const item = append(list, $('.agent-version-gallery-item'));

			const info = append(item, $('.agent-version-gallery-item-info'));
			const label = append(info, $('.agent-version-gallery-item-label'));
			label.textContent = snap.label;
			const time = append(info, $('.agent-version-gallery-item-time'));
			time.textContent = new Date(snap.timestamp).toLocaleString();

			const configKeys = Object.keys(snap.config).length;
			const meta = append(info, $('.agent-version-gallery-item-meta'));
			meta.textContent = `${configKeys} config keys`;

			const actions = append(item, $('.agent-version-gallery-item-actions'));
			const rollbackBtn = append(actions, $('button.agent-version-gallery-rollback-btn')) as HTMLButtonElement;
			rollbackBtn.textContent = 'Restore';
			rollbackBtn.title = 'Rollback to this version';
			this._register(addDisposableListener(rollbackBtn, 'click', (e) => {
				e.stopPropagation();
				if (window.confirm('Restore this config version? A new snapshot of the current config will be saved first.')) {
					this.onRollback(snap.id);
				}
			}));
		}
	}

	override dispose(): void {
		super.dispose();
	}
}