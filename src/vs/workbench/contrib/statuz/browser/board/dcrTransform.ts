/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/dcr/transform.ts
 *  Adapted: Supabase row types removed; kept helper functions only
 *--------------------------------------------------------------------------------------------*/

import type { DecisionEdge, DriftFlagItem } from './dcrTypes.js';

/* ─── Edge Filters ──────────────────────────────────────── */

export function getEdgesForDecision(
	decisionId: string,
	allEdges: DecisionEdge[],
): DecisionEdge[] {
	return allEdges.filter(e => e.sourceDecisionId === decisionId);
}

export function getIncomingEdgesForDecision(
	decisionId: string,
	allEdges: DecisionEdge[],
): DecisionEdge[] {
	return allEdges.filter(e => e.targetDecisionId === decisionId);
}

/* ─── Flag Filters ──────────────────────────────────────── */

export function getFlagsForDecision(
	decisionId: string,
	allFlags: DriftFlagItem[],
): DriftFlagItem[] {
	return allFlags.filter(f => f.decisionId === decisionId);
}

/* ─── ID Generator ──────────────────────────────────────── */

let _idCounter = 0;

export function generateId(prefix: string = 'dcr'): string {
	_idCounter++;
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	const counter = _idCounter.toString(36);
	return `${prefix}_${timestamp}${random}${counter}`;
}