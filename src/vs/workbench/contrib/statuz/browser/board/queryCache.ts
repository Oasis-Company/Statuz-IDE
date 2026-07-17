/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/api/cache.ts
 *  No changes needed — pure generic cache with no external dependencies
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/* ─── Cache Entry ────────────────────────────────────────── */

interface CacheEntry {
	data: unknown;
	timestamp: number;
	ttl: number;
	tags: string[];
}

/* ─── Cache ──────────────────────────────────────────────── */

const MAX_ENTRIES = 100;
const EVICT_BATCH = 20;

export class QueryCache {
	private store = new Map<string, CacheEntry>();
	private pending = new Map<string, Promise<unknown>>();

	/* ─── Get or Fetch ─────────────────────────────────────── */

	async getOrFetch<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttl: number = 30000,
		tags?: string[],
	): Promise<T> {
		// Check cache
		const cached = this.store.get(key);
		if (cached && Date.now() - cached.timestamp < cached.ttl) {
			return cached.data as T;
		}

		// Check in-flight
		const inFlight = this.pending.get(key);
		if (inFlight) {
			return inFlight as Promise<T>;
		}

		// Fetch
		const promise = fetcher()
			.then((data) => {
				this.store.set(key, {
					data,
					timestamp: Date.now(),
					ttl,
					tags: tags ?? [],
				});
				this.pending.delete(key);
				this.evictIfNeeded();
				return data;
			})
			.catch((err) => {
				this.pending.delete(key);
				throw err;
			});

		this.pending.set(key, promise);
		return promise;
	}

	/* ─── Invalidate by Key ────────────────────────────────── */

	invalidate(key: string): void {
		this.store.delete(key);
	}

	/* ─── Invalidate by Tag ────────────────────────────────── */

	invalidateByTag(tag: string): void {
		for (const [key, entry] of this.store) {
			if (entry.tags.includes(tag)) {
				this.store.delete(key);
			}
		}
	}

	/* ─── Clear ────────────────────────────────────────────── */

	clear(): void {
		this.store.clear();
		this.pending.clear();
	}

	/* ─── LRU Eviction ─────────────────────────────────────── */

	private evictIfNeeded(): void {
		if (this.store.size <= MAX_ENTRIES) return;

		// Sort by timestamp (oldest first) and remove oldest batch
		const entries = Array.from(this.store.entries()).sort(
			([, a], [, b]) => a.timestamp - b.timestamp,
		);

		const toRemove = entries.slice(0, EVICT_BATCH);
		for (const [key] of toRemove) {
			this.store.delete(key);
		}
	}
}

/* ─── Singleton ──────────────────────────────────────────── */

export const queryCache = new QueryCache();