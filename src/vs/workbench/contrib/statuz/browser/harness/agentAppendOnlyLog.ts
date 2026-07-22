/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';

/**
 * An append-only, immutable log for agent usage records and other sequential data.
 *
 * Design principles (from agentic-os):
 * - Immutable append: entries are never modified once written.
 * - Schema evolution: never rename fields; add new fields and mark old ones deprecated.
 * - File-based memory: persists via IStorageService to survive restarts.
 *
 * @typeParam T - The type of entries stored in the log. Must be JSON-serializable.
 */
export class AppendOnlyLog<T> {
	private readonly storageKey: string;
	private readonly storageService: IStorageService;
	private readonly maxEntries: number;

	/**
	 * @param storageKey - Unique key for persisting this log in IStorageService.
	 * @param storageService - The VS Code storage service for persistence.
	 * @param maxEntries - Maximum number of entries to retain (default 5000).
	 */
	constructor(storageKey: string, storageService: IStorageService, maxEntries: number = 5000) {
		this.storageKey = storageKey;
		this.storageService = storageService;
		this.maxEntries = maxEntries;
	}

	/**
	 * Immutably append a new entry to the log.
	 *
	 * Reads the existing array, creates a new array with the entry appended,
	 * enforces the maxEntries cap by keeping the most recent entries,
	 * and persists the result to storage.
	 *
	 * @param entry - The entry to append.
	 * @returns The updated array of entries after append.
	 * @throws If the storage write fails (caller must handle).
	 */
	append(entry: T): T[] {
		const existing = this.readAll();
		const updated = [...existing, entry];

		// Enforce maxEntries: keep the most recent entries
		let trimmed = updated;
		if (trimmed.length > this.maxEntries) {
			trimmed = trimmed.slice(trimmed.length - this.maxEntries);
		}

		this.persist(trimmed);
		return trimmed;
	}

	/**
	 * Replay the entire log as a read-only array.
	 *
	 * @returns A copy of all entries currently stored, in insertion order.
	 */
	replay(): T[] {
		return this.readAll();
	}

	/**
	 * Compact the log to keep only the most recent `keepCount` entries.
	 *
	 * Never modifies existing records - creates a new truncated array.
	 * If `keepCount` >= current length, this is a no-op.
	 *
	 * @param keepCount - Number of most recent entries to retain.
	 */
	compact(keepCount: number): void {
		if (keepCount < 0) {
			return;
		}
		const existing = this.readAll();
		if (existing.length <= keepCount) {
			return;
		}
		const trimmed = existing.slice(existing.length - keepCount);
		this.persist(trimmed);
	}

	/**
	 * Clear the entire log, replacing the stored array with an empty array.
	 */
	clear(): void {
		this.persist([]);
	}

	// ─── Private helpers ───────────────────────────────────────

	private readAll(): T[] {
		const raw = this.storageService.get(this.storageKey, StorageScope.PROFILE);
		if (!raw) {
			return [];
		}
		try {
			return JSON.parse(raw) as T[];
		} catch {
			return [];
		}
	}

	private persist(entries: T[]): void {
		this.storageService.store(
			this.storageKey,
			JSON.stringify(entries),
			StorageScope.PROFILE,
			StorageTarget.MACHINE,
		);
	}
}