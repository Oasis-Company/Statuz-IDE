/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/types.ts
 *  Minimal subset for Phase 1 — will be expanded in Phase 2
 *--------------------------------------------------------------------------------------------*/

/* ─── Board Node Layout ──────────────────────────────────── */

export interface FlowNodeLayout {
	id: string;
	type: 'card' | 'decision' | 'constitution' | 'skill-group';
	position: { x: number; y: number };
	size?: 'small' | 'medium' | 'large';
	collapsed?: boolean;
}

/* ─── Board Edge Data ────────────────────────────────────── */

export interface FlowEdgeData {
	id: string;
	source: string;
	target: string;
	type: 'informs' | 'constrains' | 'contradicts' | 'validates' | 'extends';
	label?: string;
}

/* ─── Board Snapshot ─────────────────────────────────────── */

export interface BoardSnapshot {
	cardId?: string;
	summary: string;
	status: 'active' | 'stale' | 'draft';
	ruleViolations?: Array<{ field: string; detail: string }>;
}

/* ─── Stored Viewport ────────────────────────────────────── */

export interface StoredViewport {
	x: number;
	y: number;
	zoom: number;
}