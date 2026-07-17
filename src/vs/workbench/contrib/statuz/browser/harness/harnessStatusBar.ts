/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { append, $, clearNode } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';

export class HarnessStatusBar extends Disposable {

	private readonly container: HTMLElement;
	private readonly leftEl: HTMLElement;
	private readonly rightEl: HTMLElement;

	constructor(parent: HTMLElement) {
		super();
		this.container = append(parent, $('.harness-status-bar'));
		this.leftEl = append(this.container, $('.harness-status-left'));
		this.rightEl = append(this.container, $('.harness-status-right'));
	}

	update(available: number, installed: number, enabled: number): void {
		clearNode(this.leftEl);
		clearNode(this.rightEl);

		// Left: counts
		const availItem = append(this.leftEl, $('.harness-status-item'));
		const availIcon = append(availItem, $('span.codicon.codicon-package'));
		availIcon.style.marginRight = '2px';
		append(availItem, document.createTextNode(`${available} available`));

		append(this.leftEl, document.createTextNode('·'));

		const instItem = append(this.leftEl, $('.harness-status-item'));
		append(instItem, document.createTextNode(`${installed} installed`));

		append(this.leftEl, document.createTextNode('·'));

		const enbItem = append(this.leftEl, $('.harness-status-item'));
		append(enbItem, document.createTextNode(`${enabled} enabled`));

		// Right: version info
		const versionItem = append(this.rightEl, $('.harness-status-item'));
		append(versionItem, document.createTextNode('ECC Universal v2.0.0'));
	}

	override dispose(): void {
		super.dispose();
	}
}