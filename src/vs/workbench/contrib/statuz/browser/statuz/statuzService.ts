/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { URI } from '../../../../../base/common/uri.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import * as YAML from 'yaml';
import type { StatuzDocument, StatuzReadResult } from './statuzTypes.js';

export const IStatuzService = createDecorator<IStatuzService>('statuzService');

export interface IStatuzService {
	readonly _serviceBrand: undefined;

	/**
	 * Reads and parses .statuz/statuz.yaml from the workspace root.
	 * Returns a StatuzReadResult with ok=true and the document on success,
	 * or ok=false with an error message on failure.
	 */
	readStatuz(): Promise<StatuzReadResult>;

	/**
	 * Returns the cached document from the last successful read,
	 * or null if no successful read has occurred.
	 */
	getDocument(): StatuzDocument | null;

	/**
	 * Returns the most recent error message, or null if the last read succeeded.
	 */
	getLastError(): string | null;
}

export class StatuzService implements IStatuzService {
	declare readonly _serviceBrand: undefined;

	private lastDocument: StatuzDocument | null = null;
	private lastError: string | null = null;
	private lastFilePath: string = '';

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {}

	async readStatuz(): Promise<StatuzReadResult> {
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			this.lastError = 'No workspace folder open.';
			return { ok: false, error: this.lastError, filePath: '' };
		}

		const statuzYamlUri = URI.joinPath(workspace.folders[0].uri, '.statuz', 'statuz.yaml');
		this.lastFilePath = statuzYamlUri.fsPath;

		try {
			const content = await this.fileService.readFile(statuzYamlUri);
			const raw = content.value.toString();
			const parsed = YAML.parse(raw) as Record<string, unknown>;

			if (!parsed || typeof parsed !== 'object') {
				this.lastError = 'statuz.yaml is empty or not a valid YAML object.';
				return { ok: false, error: this.lastError, filePath: this.lastFilePath };
			}

			// Validate required fields
			if (!parsed.identity || typeof parsed.identity !== 'object') {
				this.lastError = 'statuz.yaml is missing required field: identity.';
				return { ok: false, error: this.lastError, filePath: this.lastFilePath };
			}

			const identity = parsed.identity as Record<string, unknown>;
			if (!identity.agent_name || !identity.project_name) {
				this.lastError = 'statuz.yaml identity is missing required fields: agent_name and/or project_name.';
				return { ok: false, error: this.lastError, filePath: this.lastFilePath };
			}

			if (!parsed.current_state || typeof parsed.current_state !== 'object') {
				this.lastError = 'statuz.yaml is missing required field: current_state.';
				return { ok: false, error: this.lastError, filePath: this.lastFilePath };
			}

			const currentState = parsed.current_state as Record<string, unknown>;
			if (!currentState.status) {
				this.lastError = 'statuz.yaml current_state is missing required field: status.';
				return { ok: false, error: this.lastError, filePath: this.lastFilePath };
			}

			// Coerce to typed document (rely on schema validation, not runtime type checking)
			const document = parsed as unknown as StatuzDocument;
			this.lastDocument = document;
			this.lastError = null;

			return { ok: true, document, filePath: this.lastFilePath };
		} catch (err) {
			if (err instanceof YAML.YAMLError) {
				this.lastError = `Invalid YAML in statuz.yaml: ${err.message}`;
			} else {
				const code = (err as any)?.code;
				if (code === 'FileNotFound' || code === 'ENOENT') {
					this.lastError = 'No .statuz/statuz.yaml found in workspace. Run "statuz init" to create one.';
				} else {
					this.lastError = `Failed to read statuz.yaml: ${(err as Error).message || String(err)}`;
				}
			}
			this.lastDocument = null;
			return { ok: false, error: this.lastError, filePath: this.lastFilePath };
		}
	}

	getDocument(): StatuzDocument | null {
		return this.lastDocument;
	}

	getLastError(): string | null {
		return this.lastError;
	}
}