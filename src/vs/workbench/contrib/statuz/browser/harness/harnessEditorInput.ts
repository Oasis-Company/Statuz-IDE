/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { localize } from '../../../../../nls.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import { EditorInput } from '../../../../../workbench/common/editor/editorInput.js';
import { IUntypedEditorInput } from '../../../../../workbench/common/editor.js';

export const HarnessEditorIcon = registerIcon(
	'harness-editor-label-icon',
	Codicon.symbolMethod,
	localize('harnessEditorLabelIcon', 'Icon of the harness editor label.')
);

export class HarnessEditorInput extends EditorInput {

	static readonly ID: string = 'workbench.input.statuzHarness';

	readonly resource: URI = URI.from({
		scheme: 'statuz-harness',
		path: 'harness-editor'
	});

	override get typeId(): string {
		return HarnessEditorInput.ID;
	}

	override getName(): string {
		return localize('harnessEditorName', 'Agent Management');
	}

	override getIcon(): ThemeIcon {
		return HarnessEditorIcon;
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(otherInput)) {
			return true;
		}
		return otherInput instanceof HarnessEditorInput;
	}
}