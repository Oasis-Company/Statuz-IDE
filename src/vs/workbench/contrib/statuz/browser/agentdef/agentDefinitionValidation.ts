/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentDefinition, AgentDefinitionIndex, AgentDefinitionSource } from './agentDefinitionTypes.js';

// ─── Validation Result ────────────────────────────────────────

export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	errors: string[];
}

// ─── Helpers ───────────────────────────────────────────────────

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && !isNaN(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArrayOfStrings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function requiredString(value: unknown, path: string, errors: string[], minLen = 1, maxLen = 4096): string | undefined {
	if (!isString(value)) {
		errors.push(`${path}: expected string, got ${typeof value}`);
		return undefined;
	}
	if (value.length < minLen) {
		errors.push(`${path}: string too short (min ${minLen})`);
		return undefined;
	}
	if (value.length > maxLen) {
		errors.push(`${path}: string too long (max ${maxLen})`);
		return undefined;
	}
	return value;
}

function requiredNumber(value: unknown, path: string, errors: string[]): number | undefined {
	if (!isNumber(value)) {
		errors.push(`${path}: expected number, got ${typeof value}`);
		return undefined;
	}
	return value;
}

// ─── Source Validators ─────────────────────────────────────────

function validateLocalSource(data: Record<string, unknown>, path: string, errors: string[]): AgentDefinitionSource | undefined {
	const sourcePath = requiredString(data.path, `${path}.path`, errors);
	if (sourcePath === undefined) { return undefined; }
	return { type: 'local', path: sourcePath };
}

function validateEccSource(data: Record<string, unknown>, path: string, errors: string[]): AgentDefinitionSource | undefined {
	const componentId = requiredString(data.componentId, `${path}.componentId`, errors);
	const eccVersion = requiredString(data.eccVersion, `${path}.eccVersion`, errors);
	if (componentId === undefined || eccVersion === undefined) { return undefined; }
	const updateAvailable = data.updateAvailable === true ? true : undefined;
	return { type: 'ecc', componentId, eccVersion, updateAvailable };
}

function validateMarketplaceSource(data: Record<string, unknown>, path: string, errors: string[]): AgentDefinitionSource | undefined {
	const url = requiredString(data.url, `${path}.url`, errors);
	const packageId = requiredString(data.packageId, `${path}.packageId`, errors);
	if (url === undefined || packageId === undefined) { return undefined; }
	return { type: 'marketplace', url, packageId };
}

function validateSource(data: unknown, path: string, errors: string[]): AgentDefinitionSource | undefined {
	if (!isObject(data)) {
		errors.push(`${path}: expected object, got ${typeof data}`);
		return undefined;
	}
	const type = data.type;
	if (!isString(type)) {
		errors.push(`${path}.type: expected string, got ${typeof type}`);
		return undefined;
	}
	switch (type) {
		case 'local': return validateLocalSource(data, path, errors);
		case 'ecc': return validateEccSource(data, path, errors);
		case 'marketplace': return validateMarketplaceSource(data, path, errors);
		default:
			errors.push(`${path}.type: unknown source type "${type}"`);
			return undefined;
	}
}

// ─── AgentDefinition Validator ─────────────────────────────────

export function validateAgentDefinition(data: unknown): ValidationResult<AgentDefinition> {
	const errors: string[] = [];

	if (!isObject(data)) {
		errors.push(`root: expected object, got ${typeof data}`);
		return { success: false, errors };
	}

	const id = requiredString(data.id, 'id', errors, 1, 128);
	const name = requiredString(data.name, 'name', errors, 1, 128);
	const kind = requiredString(data.kind, 'kind', errors, 1, 64);
	const description = requiredString(data.description, 'description', errors, 0, 4096);
	const version = requiredString(data.version, 'version', errors, 1, 32);
	const author = requiredString(data.author, 'author', errors, 0, 128);
	const source = validateSource(data.source, 'source', errors);
	const icon = requiredString(data.icon, 'icon', errors, 1, 64);
	const category = requiredString(data.category, 'category', errors, 0, 128);

	// tags
	const rawTags = data.tags;
	let tags: string[] = [];
	if (rawTags !== undefined && rawTags !== null) {
		if (isArrayOfStrings(rawTags)) {
			tags = rawTags;
		} else {
			errors.push('tags: expected array of strings');
		}
	}

	// config
	const rawConfig = data.config;
	let config: Record<string, unknown> = {};
	if (rawConfig !== undefined && rawConfig !== null) {
		if (isObject(rawConfig)) {
			config = rawConfig;
		} else {
			errors.push('config: expected object');
		}
	}

	const createdAt = requiredNumber(data.createdAt, 'createdAt', errors);
	const updatedAt = requiredNumber(data.updatedAt, 'updatedAt', errors);

	if (errors.length > 0) {
		return { success: false, errors };
	}

	// All required fields are guaranteed non-undefined because errors.length === 0
	return {
		success: true,
		errors: [],
		data: {
			id: id!,
			name: name!,
			kind: kind!,
			description: description!,
			version: version!,
			author: author!,
			source: source!,
			icon: icon!,
			category: category!,
			tags,
			config,
			createdAt: createdAt!,
			updatedAt: updatedAt!,
		},
	};
}

// ─── AgentDefinitionIndex Validator ────────────────────────────

export function validateAgentDefinitionIndex(data: unknown): ValidationResult<AgentDefinitionIndex> {
	const errors: string[] = [];

	if (!isObject(data)) {
		errors.push(`root: expected object, got ${typeof data}`);
		return { success: false, errors };
	}

	if (data.version !== 1) {
		errors.push(`version: expected 1, got ${data.version}`);
	}

	const entries: Record<string, string> = {};
	const rawEntries = data.entries;
	if (isObject(rawEntries)) {
		for (const [key, value] of Object.entries(rawEntries)) {
			if (isString(value)) {
				entries[key] = value;
			} else {
				errors.push(`entries.${key}: expected string, got ${typeof value}`);
			}
		}
	} else {
		errors.push(`entries: expected object, got ${typeof rawEntries}`);
	}

	const updatedAt = requiredNumber(data.updatedAt, 'updatedAt', errors);

	if (errors.length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		errors: [],
		data: {
			version: 1,
			entries,
			updatedAt: updatedAt!,
		},
	};
}