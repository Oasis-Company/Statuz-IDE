/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/board/completeness.ts
 *  Adapted: field names aligned with canonical Constitution type
 *--------------------------------------------------------------------------------------------*/

import type { SandboxCard, Constitution } from './boardTypes.js';

/* ─── Constants ──────────────────────────────────────────── */

/** Core card types that define strategic completeness. */
export const CORE_CARD_TYPES = ['vision', 'user', 'problem', 'mvp'] as const;

/** Card existence weight: 15% per type, 4 types = 60% total. */
export const CARD_EXISTENCE_WEIGHT = 0.15;

/** Card status weight: 5% per type, 4 types = 20% total. */
export const CARD_STATUS_WEIGHT = 0.05;

/** Constitution completeness weight: 20% total. */
export const CONSTITUTION_WEIGHT = 0.20;


/* ─── Result Type ────────────────────────────────────────── */

export interface CompletenessResult {
	/** Overall score 0-100. */
	score: number;
	/** Detailed breakdown by category. */
	breakdown: {
		cards: Array<{
			type: string;
			exists: boolean;
			status: string;
			score: number;
			label: string;
		}>;
		constitution: {
			vision: boolean;
			principles: number;
			constraints: number;
			metrics: number;
			score: number;
		};
	};
	/** Missing items that can be clicked to create. */
	missingItems: Array<{
		type: string;
		label: string;
		reason: string;
	}>;
}


/* ─── Helpers ────────────────────────────────────────────── */

function getCardLabel(type: string): string {
	const labels: Record<string, string> = {
		vision: 'Vision',
		user: 'User',
		problem: 'Problem',
		mvp: 'MVP',
	};
	return labels[type] || type;
}

function getStatusScore(status: string | undefined): number {
	if (status === 'Approved') return 1;
	if (status === 'Review') return 0.5;
	return 0;
}


/* ─── Main ───────────────────────────────────────────────── */

export function calculateCompleteness(
	cards: SandboxCard[],
	constitution: Constitution | null,
): CompletenessResult {
	const breakdown: CompletenessResult['breakdown'] = {
		cards: [],
		constitution: { vision: false, principles: 0, constraints: 0, metrics: 0, score: 0 },
	};
	const missingItems: CompletenessResult['missingItems'] = [];
	let totalScore = 0;

	// 1. Card existence + status scoring (80% total)
	for (const type of CORE_CARD_TYPES) {
		const card = cards.find(c => c.type === type);
		const exists = !!card;
		const status = card?.status || 'Draft';
		const statusScore = getStatusScore(status);

		const existenceScore = exists ? CARD_EXISTENCE_WEIGHT : 0;
		const statusContribution = statusScore * CARD_STATUS_WEIGHT;
		const cardScore = (existenceScore + statusContribution) / 0.20;

		totalScore += existenceScore + statusContribution;

		breakdown.cards.push({
			type,
			label: getCardLabel(type),
			exists,
			status,
			score: Math.round(cardScore * 100) / 100,
		});

		if (!exists) {
			missingItems.push({
				type,
				label: getCardLabel(type),
				reason: `Missing ${getCardLabel(type)} card`,
			});
		}
	}

	// 2. Constitution completeness scoring (20% total)
	if (constitution) {
		const hasVision = !!constitution.vision && constitution.vision.length > 0;
		const principleCount = constitution.principles?.length || 0;
		const constraintCount = constitution.constraints?.length || 0;
		const metricCount = constitution.metrics?.length || 0;

		const visionScore = hasVision ? 0.08 : 0;
		const principleScore = Math.min(principleCount / 3, 1) * 0.05;
		const constraintScore = Math.min(constraintCount / 2, 1) * 0.04;
		const metricScore = Math.min(metricCount / 2, 1) * 0.03;
		const constScore = visionScore + principleScore + constraintScore + metricScore;

		totalScore += constScore;

		breakdown.constitution = {
			vision: hasVision,
			principles: principleCount,
			constraints: constraintCount,
			metrics: metricCount,
			score: Math.round((constScore / CONSTITUTION_WEIGHT) * 100 * 100) / 100,
		};

		if (!hasVision) {
			missingItems.push({
				type: 'vision',
				label: 'Constitution Vision',
				reason: 'Constitution vision is empty',
			});
		}
	} else {
		missingItems.push({
			type: 'constitution',
			label: 'Constitution',
			reason: 'No constitution defined',
		});
	}

	return {
		score: Math.round(totalScore * 100),
		breakdown,
		missingItems,
	};
}