/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/storage/engine.ts
 *  Adapted: Zod schema → StorageSchema validator; no external dependencies
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type { StorageValue, StorageKeyDef, StorageConfig } from './storageTypes.js';
import { runMigrations, CURRENT_VERSION } from './storageMigrations.js';

/* ─── Engine ─────────────────────────────────────────────── */

export class StorageEngine {
	private readonly prefix: string;
	public readonly currentVersion: number;

	constructor(config: StorageConfig) {
		this.prefix = config.prefix.endsWith('-') ? config.prefix : `${config.prefix}-`;
		this.currentVersion = CURRENT_VERSION;
	}

	/* ─── Build full key ──────────────────────────────────── */

	buildKey(subKey: string, ...args: string[]): string {
		const suffix = args.length > 0 ? `-${args.join('-')}` : '';
		return `${this.prefix}${subKey}${suffix}`;
	}

	/* ─── Get ──────────────────────────────────────────────── */

	get<T>(keyDef: StorageKeyDef<T>, ...args: string[]): T {
		const fullKey = this.buildKey(keyDef.key, ...args);
		try {
			const raw = localStorage.getItem(fullKey);
			return this.safeParse(raw, keyDef, fullKey);
		} catch (err) {
			console.warn(`[StorageEngine] Unexpected error reading "${fullKey}":`, err);
			return keyDef.default;
		}
	}

	/* ─── Set ──────────────────────────────────────────────── */

	set<T>(keyDef: StorageKeyDef<T>, value: T, ...args: string[]): boolean {
		const fullKey = this.buildKey(keyDef.key, ...args);
		const wrapped: StorageValue<T> = {
			version: this.currentVersion,
			data: value,
			timestamp: Date.now(),
		};
		try {
			localStorage.setItem(fullKey, JSON.stringify(wrapped));
			return true;
		} catch (err) {
			if (err instanceof DOMException && (
				err.name === 'QuotaExceededError' ||
				err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
			)) {
				this.warnQuota(fullKey, value);
			} else {
				console.warn(`[StorageEngine] Error writing "${fullKey}":`, err);
			}
			return false;
		}
	}

	/* ─── Remove ───────────────────────────────────────────── */

	remove<T>(keyDef: StorageKeyDef<T>, ...args: string[]): void {
		const fullKey = this.buildKey(keyDef.key, ...args);
		try {
			localStorage.removeItem(fullKey);
		} catch (err) {
			console.warn(`[StorageEngine] Error removing "${fullKey}":`, err);
		}
	}

	/* ─── Clear ────────────────────────────────────────────── */

	clear(prefix?: string): void {
		const matchPrefix = prefix ?? this.prefix;
		try {
			const keysToRemove: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.startsWith(matchPrefix)) {
					keysToRemove.push(key);
				}
			}
			keysToRemove.forEach(k => localStorage.removeItem(k));
		} catch (err) {
			console.warn(`[StorageEngine] Error clearing prefix "${matchPrefix}":`, err);
		}
	}

	/* ─── Safe Parse ───────────────────────────────────────── */

	private safeParse<T>(
		raw: string | null,
		keyDef: StorageKeyDef<T>,
		fullKey: string,
	): T {
		if (raw === null) return keyDef.default;

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			console.warn(`[StorageEngine] Corrupt JSON for "${fullKey}", resetting to default`);
			this.sanitize(fullKey, keyDef.default);
			return keyDef.default;
		}

		// Handle wrapped StorageValue format
		let dataVersion = 0;
		let dataValue = parsed;

		if (parsed && typeof parsed === 'object' && 'version' in (parsed as Record<string, unknown>) && 'data' in (parsed as Record<string, unknown>)) {
			const sv = parsed as StorageValue<unknown>;
			dataVersion = sv.version ?? 0;
			dataValue = sv.data;
		}

		// Check TTL — if expired, reset to default
		if (dataVersion > 0 && keyDef.ttl) {
			const sv = parsed as StorageValue<unknown>;
			if (this.isExpired(sv, keyDef.ttl)) {
				console.warn(`[StorageEngine] TTL expired for "${fullKey}", resetting to default`);
				this.sanitize(fullKey, keyDef.default);
				return keyDef.default;
			}
		}

		// Run migrations if needed
		if (dataVersion < this.currentVersion) {
			try {
				dataValue = runMigrations(keyDef.key, dataValue, dataVersion, this.currentVersion);
				// Write back migrated data
				const migrated: StorageValue<T> = {
					version: this.currentVersion,
					data: dataValue as T,
					timestamp: Date.now(),
				};
				try {
					localStorage.setItem(fullKey, JSON.stringify(migrated));
				} catch { /* best effort */ }
			} catch (migrationErr) {
				console.warn(`[StorageEngine] Migration failed for "${fullKey}", resetting to default:`, migrationErr);
				this.sanitize(fullKey, keyDef.default);
				return keyDef.default;
			}
		}

		// Validate with schema
		if (keyDef.schema) {
			try {
				return keyDef.schema.validate(dataValue);
			} catch (validationErr) {
				console.warn(
					`[StorageEngine] Schema validation failed for "${fullKey}", resetting to default:`,
					validationErr,
				);
				this.sanitize(fullKey, keyDef.default);
				return keyDef.default;
			}
		}

		return dataValue as T;
	}

	/* ─── TTL Check ────────────────────────────────────────── */

	private isExpired<T>(wrapped: StorageValue<T>, ttl: number): boolean {
		return Date.now() - wrapped.timestamp > ttl;
	}

	/* ─── Sanitize ─────────────────────────────────────────── */

	private sanitize<T>(fullKey: string, defaultValue: T): void {
		try {
			const wrapped: StorageValue<T> = {
				version: this.currentVersion,
				data: defaultValue,
				timestamp: Date.now(),
			};
			localStorage.setItem(fullKey, JSON.stringify(wrapped));
		} catch { /* best effort */ }
	}

	/* ─── Quota Warning ────────────────────────────────────── */

	private warnQuota<T>(fullKey: string, value: T): void {
		const estimate = this.getSizeEstimate();
		console.warn(
			`[StorageEngine] Quota exceeded writing "${fullKey}"`,
			`Size: ~${new Blob([JSON.stringify(value)]).size} bytes`,
			estimate ? `Available: ~${Math.round((estimate.quota - estimate.usage) / 1024)} KB` : '',
		);
	}

	/* ─── Size Estimate ────────────────────────────────────── */

	getSizeEstimate(): { usage: number; quota: number } | null {
		try {
			let total = 0;
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) total += key.length + (localStorage.getItem(key)?.length ?? 0);
			}
			return { usage: total * 2, quota: 5 * 1024 * 1024 }; // rough UTF-16 estimate, 5MB typical quota
		} catch {
			return null;
		}
	}
}