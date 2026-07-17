/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/storage/keys.ts
 *  Adapted: Zod schemas → manual validator functions
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type { StorageKeyDef, StorageSchema } from './storageTypes.js';
import type { FlowNodeLayout, FlowEdgeData, BoardSnapshotData, StoredViewport } from './boardTypes.js';

/* ─── Validator Helpers ──────────────────────────────────── */

function safeString(v: unknown, fallback: string): string {
	return typeof v === 'string' ? v : fallback;
}

function safeNumber(v: unknown, fallback: number): number {
	return typeof v === 'number' && !isNaN(v) ? v : fallback;
}

function safeBoolean(v: unknown, fallback: boolean): boolean {
	return typeof v === 'boolean' ? v : fallback;
}

function safeObject(v: unknown): Record<string, unknown> | null {
	if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
	return null;
}

function safePosition(v: unknown): { x: number; y: number } {
	const obj = safeObject(v);
	if (!obj) return { x: 0, y: 0 };
	return {
		x: safeNumber(obj.x, 0),
		y: safeNumber(obj.y, 0),
	};
}

/* ─── FlowNodeLayout Validator ───────────────────────────── */

const FLOW_NODE_TYPES = ['card', 'decision', 'constitution', 'skill-group'] as const;
const FLOW_NODE_SIZES = ['small', 'medium', 'large'] as const;

function validateFlowNodeLayout(value: unknown): FlowNodeLayout {
	const obj = safeObject(value);
	if (!obj) throw new Error('Expected object for FlowNodeLayout');
	return {
		id: safeString(obj.id, ''),
		type: FLOW_NODE_TYPES.includes(obj.type as typeof FLOW_NODE_TYPES[number])
			? obj.type as FlowNodeLayout['type'] : 'card',
		position: safePosition(obj.position),
		size: FLOW_NODE_SIZES.includes(obj.size as typeof FLOW_NODE_SIZES[number])
			? obj.size as FlowNodeLayout['size'] : 'medium',
		collapsed: obj.collapsed !== undefined ? safeBoolean(obj.collapsed, false) : false,
	};
}

function validateFlowNodeLayoutArray(value: unknown): FlowNodeLayout[] {
	if (!Array.isArray(value)) return [];
	return value.map(v => validateFlowNodeLayout(v));
}

const flowNodeLayoutSchema: StorageSchema<FlowNodeLayout[]> = {
	validate: validateFlowNodeLayoutArray,
};

/* ─── FlowEdgeData Validator ──────────────────────────────── */

const EDGE_TYPES = ['informs', 'constrains', 'contradicts', 'validates', 'extends'] as const;

function validateFlowEdgeData(value: unknown): FlowEdgeData {
	const obj = safeObject(value);
	if (!obj) throw new Error('Expected object for FlowEdgeData');
	return {
		id: safeString(obj.id, ''),
		source: safeString(obj.source, ''),
		target: safeString(obj.target, ''),
		type: EDGE_TYPES.includes(obj.type as typeof EDGE_TYPES[number])
			? obj.type as FlowEdgeData['type'] : 'informs',
		label: obj.label !== undefined ? safeString(obj.label, '') : undefined,
	};
}

function validateFlowEdgeDataArray(value: unknown): FlowEdgeData[] {
	if (!Array.isArray(value)) return [];
	return value.map(v => validateFlowEdgeData(v));
}

const flowEdgeDataSchema: StorageSchema<FlowEdgeData[]> = {
	validate: validateFlowEdgeDataArray,
};

/* ─── BoardSnapshot Validator ─────────────────────────────── */

const SNAPSHOT_STATUSES = ['active', 'stale', 'draft'] as const;

function validateRuleViolation(v: unknown): { field: string; detail: string } {
	const obj = safeObject(v);
	if (!obj) throw new Error('Expected object for RuleViolation');
	return {
		field: safeString(obj.field, ''),
		detail: safeString(obj.detail, ''),
	};
}

function validateBoardSnapshot(value: unknown): BoardSnapshotData {
	const obj = safeObject(value);
	if (!obj) throw new Error('Expected object for BoardSnapshotData');
	return {
		cardId: obj.cardId !== undefined ? safeString(obj.cardId, '') : undefined,
		summary: safeString(obj.summary, ''),
		status: SNAPSHOT_STATUSES.includes(obj.status as typeof SNAPSHOT_STATUSES[number])
			? obj.status as BoardSnapshotData['status'] : 'draft',
		ruleViolations: Array.isArray(obj.ruleViolations)
			? obj.ruleViolations.map((v: unknown) => validateRuleViolation(v))
			: [],
	};
}

function validateBoardSnapshotArray(value: unknown): BoardSnapshotData[] {
	if (!Array.isArray(value)) return [];
	return value.map(v => validateBoardSnapshot(v));
}

const boardSnapshotSchema: StorageSchema<BoardSnapshotData[]> = {
	validate: validateBoardSnapshotArray,
};

/* ─── StoredViewport Validator ────────────────────────────── */

function validateStoredViewport(value: unknown): StoredViewport {
	const obj = safeObject(value);
	if (!obj) return { x: 0, y: 0, zoom: 0 };
	return {
		x: safeNumber(obj.x, 0),
		y: safeNumber(obj.y, 0),
		zoom: safeNumber(obj.zoom, 0),
	};
}

const storedViewportSchema: StorageSchema<StoredViewport> = {
	validate: validateStoredViewport,
};

/* ─── Flow Board Keys ────────────────────────────────────── */

export const FLOW_BOARD_KEYS = {
	layout: {
		key: 'layout',
		prefix: 'sb-flow',
		schema: flowNodeLayoutSchema,
		default: [] as FlowNodeLayout[],
	} satisfies StorageKeyDef<FlowNodeLayout[]>,

	edges: {
		key: 'edges',
		prefix: 'sb-flow',
		schema: flowEdgeDataSchema,
		default: [] as FlowEdgeData[],
	} satisfies StorageKeyDef<FlowEdgeData[]>,

	viewport: {
		key: 'viewport',
		prefix: 'sb-flow',
		schema: storedViewportSchema,
		default: { x: 0, y: 0, zoom: 0.8 },
	} satisfies StorageKeyDef<StoredViewport>,

	snapshots: {
		key: 'snapshots',
		prefix: 'sb-flow',
		schema: boardSnapshotSchema,
		default: [] as BoardSnapshotData[],
	} satisfies StorageKeyDef<BoardSnapshotData[]>,

	completedQuestions: {
		key: 'completed',
		prefix: 'sb-flow',
		default: [] as string[],
	} as StorageKeyDef<string[]>,
} as const;

/* ─── Aggregated Keys ────────────────────────────────────── */

export const STORAGE_KEYS = {
	...FLOW_BOARD_KEYS,
} as const;