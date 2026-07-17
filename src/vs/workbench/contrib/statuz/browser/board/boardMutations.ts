/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/board/mutations.ts
 *  Adapted: removed React types; kept pure mutation resolution logic
 *--------------------------------------------------------------------------------------------*/

import type { SandboxCard, FlowEdgeData } from './boardTypes.js';

/* ─── Mutation Types ─────────────────────────────────────── */

export type CardStatusValue = 'Approved' | 'Review' | 'Draft' | 'Rejected' | 'Pending';

export interface UpdateCardStatusMutation {
	type: 'UPDATE_CARD_STATUS';
	card: string;       // fuzzy match: card id or title prefix
	status: CardStatusValue;
}

export interface AddEdgeMutation {
	type: 'ADD_EDGE';
	source: string;      // fuzzy match
	target: string;      // fuzzy match
	edgeType: FlowEdgeData['type'];
}

export interface SetCardAttrMutation {
	type: 'SET_CARD_ATTR';
	card: string;        // fuzzy match
	attr: string;        // attribute name
	value: string;       // attribute value
}

export interface AddDecisionMutation {
	type: 'ADD_DECISION';
	statement: string;
	category: string;
	commitment: string;
}

export type SkillMutation =
	| UpdateCardStatusMutation
	| AddEdgeMutation
	| SetCardAttrMutation
	| AddDecisionMutation;


/* ─── Resolution ─────────────────────────────────────────── */

export function resolveMutationTarget(
	cards: SandboxCard[],
	mutation: SkillMutation,
): SandboxCard | null {
	const targetStr = getTargetString(mutation);
	if (!targetStr) return null;

	// Level 1: Exact ID match
	const exactMatch = cards.find(c => c.id === targetStr);
	if (exactMatch) return exactMatch;

	// Level 2: Title prefix match (case-insensitive)
	const lowerTarget = targetStr.toLowerCase();
	const prefixMatch = cards.find(c =>
		c.content.toLowerCase().startsWith(lowerTarget),
	);
	if (prefixMatch) return prefixMatch;

	// Level 3: Type match (e.g. "vision", "user", "problem", "mvp")
	const typeMatch = cards.find(c =>
		c.type.toLowerCase() === lowerTarget,
	);
	if (typeMatch) return typeMatch;

	return null;
}

export function resolveEdgeTargets(
	cards: SandboxCard[],
	mutation: AddEdgeMutation,
): { source: SandboxCard | null; target: SandboxCard | null } {
	const source = resolveMutationTarget(cards, {
		type: 'UPDATE_CARD_STATUS',
		card: mutation.source,
		status: 'Approved',
	});

	const target = resolveMutationTarget(cards, {
		type: 'UPDATE_CARD_STATUS',
		card: mutation.target,
		status: 'Approved',
	});

	return { source, target };
}


/* ─── Helpers ────────────────────────────────────────────── */

function getTargetString(mutation: SkillMutation): string | null {
	switch (mutation.type) {
		case 'UPDATE_CARD_STATUS':
		case 'SET_CARD_ATTR':
			return mutation.card;
		case 'ADD_EDGE':
			return null; // handled by resolveEdgeTargets
		case 'ADD_DECISION':
			return null; // decisions are not cards
		default:
			return null;
	}
}