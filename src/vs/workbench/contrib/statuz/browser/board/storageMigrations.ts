/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/storage/migrations.ts
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/* ─── Types ──────────────────────────────────────────────── */

export interface Migration {
	key: string;        // Storage key this migration applies to (e.g. 'layout', 'dialog')
	from: number;       // Source version
	to: number;         // Target version
	migrate: (data: unknown) => unknown;
}

/* ─── Current Schema Version ─────────────────────────────── */

export const CURRENT_VERSION = 1;

/* ─── Registry ───────────────────────────────────────────── */

export const MIGRATIONS: Migration[] = [
	// V1 → V2: Add 'size' field to FlowNodeLayout (default 'medium')
	// {
	//   key: 'layout',
	//   from: 1,
	//   to: 2,
	//   migrate: (data) => {
	//     if (!Array.isArray(data)) return data;
	//     return data.map((node: Record<string, unknown>) => ({
	//       ...node,
	//       size: node.size ?? 'medium',
	//     }));
	//   },
	// },
];

/* ─── Runner ─────────────────────────────────────────────── */

export function runMigrations(
	key: string,
	data: unknown,
	fromVersion: number,
	toVersion: number,
): unknown {
	if (fromVersion >= toVersion) return data;

	let current = data;
	let version = fromVersion;

	// Find migrations for this key in order
	const keyMigrations = MIGRATIONS
		.filter(m => m.key === key && m.from >= fromVersion && m.to <= toVersion)
		.sort((a, b) => a.from - b.from);

	for (const migration of keyMigrations) {
		if (migration.from !== version) {
			console.warn(
				`[Migrations] Version gap: expected ${version}, got migration from ${migration.from}`,
			);
			continue;
		}
		try {
			current = migration.migrate(current);
			version = migration.to;
			console.info(`[Migrations] Applied migration ${migration.key} v${migration.from} → v${migration.to}`);
		} catch (err) {
			console.error(`[Migrations] Failed migration ${migration.key} v${migration.from} → v${migration.to}:`, err);
			throw err;
		}
	}

	return current;
}