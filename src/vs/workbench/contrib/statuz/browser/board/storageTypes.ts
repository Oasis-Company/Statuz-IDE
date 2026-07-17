/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/storage/types.ts
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/* ─── Storage Value Wrapper ──────────────────────────────── */

export interface StorageValue<T> {
	version: number;
	data: T;
	timestamp: number;
}

/* ─── Validator Function ─────────────────────────────────── */

/** A lightweight replacement for ZodSchema. Returns the parsed value or throws on failure. */
export interface StorageSchema<T> {
	validate(value: unknown): T;
}

/* ─── Key Definition ─────────────────────────────────────── */

export interface StorageKeyDef<T> {
	key: string;
	prefix: string;
	schema?: StorageSchema<T>;
	default: T;
	ttl?: number; // milliseconds — undefined means no expiry
}

/* ─── Engine Config ──────────────────────────────────────── */

export interface StorageConfig {
	prefix: string;
	version: number;
}