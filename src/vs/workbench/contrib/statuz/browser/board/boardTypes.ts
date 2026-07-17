/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Expanded from Sandboxer src/types.ts — full board data model
 *--------------------------------------------------------------------------------------------*/

/* ─── Card Status ───────────────────────────────────────── */

export type CardStatus = 'draft' | 'approved' | 'rejected' | 'pending';

/* ─── Strategy Card ─────────────────────────────────────── */

export interface SandboxCard {
	id: string;
	conceptId: 'A' | 'B' | 'C';
	type: 'vision' | 'user' | 'problem' | 'mvp';
	content: string;
	status: CardStatus;
	constitution?: Constitution;
	createdAt: string;
	updatedAt: string;
}

/* ─── Constitution ──────────────────────────────────────── */

export interface Constitution {
	vision: string;
	principles: string[];
	constraints: string[];
	metrics: string[];
	forbidden_features: string[];
	/** @deprecated use forbidden_features */
	forbiddenVec?: string;
}

/* ─── Concept Type ──────────────────────────────────────── */

export type ConceptType = 'A' | 'B' | 'C';

/* ─── Board Node Layout ─────────────────────────────────── */

export interface FlowNodeLayout {
	id: string;
	type: 'card' | 'decision' | 'constitution' | 'skill-group';
	position: { x: number; y: number };
	size?: 'small' | 'medium' | 'large';
	collapsed?: boolean;
}

/* ─── Board Edge Data ───────────────────────────────────── */

export interface FlowEdgeData {
	id: string;
	source: string;
	target: string;
	type: 'informs' | 'constrains' | 'contradicts' | 'validates' | 'extends';
	label?: string;
}

/* ─── Board Snapshot ────────────────────────────────────── */

export interface BoardSnapshotData {
	cardId?: string;
	summary: string;
	status: 'active' | 'stale' | 'draft';
	ruleViolations?: Array<{ field: string; detail: string }>;
}

/* ─── Stored Viewport ───────────────────────────────────── */

export interface StoredViewport {
	x: number;
	y: number;
	zoom: number;
}

/* ─── Project Branch ────────────────────────────────────── */

export interface ProjectBranch {
	id: string;
	name: string;
	conceptId: ConceptType;
	createdAt: string;
	updatedAt: string;
}