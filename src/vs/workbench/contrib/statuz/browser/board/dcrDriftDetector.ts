/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/dcr/drift-detector.ts
 *  Adapted: Supabase → in-memory store; works with DCRegistry
 *--------------------------------------------------------------------------------------------*/

import type {
	DriftFlagItem,
	DriftFlagType,
	DriftSeverity,
	DecisionRegistryEntry,
} from './dcrTypes.js';
import { generateId } from './dcrTransform.js';
import type { Constitution } from './boardTypes.js';

/* ─── Constants ──────────────────────────────────────────── */

const DECAY_CRITICAL_DAYS = 14;
const DECAY_WARNING_DAYS = 7;
const ASSUMPTION_STALE_DAYS = 21;


/* ─── In-Memory Flag Store ───────────────────────────────── */

interface DriftFlagStore {
	flags: Map<string, DriftFlagItem>;
}

export interface CreateFlagInput {
	projectId: string;
	decisionId: string;
	relatedDecisionId?: string;
	flagType: DriftFlagType;
	severity: DriftSeverity;
	description: string;
}

export function createDriftFlag(
	store: DriftFlagStore,
	input: CreateFlagInput,
): DriftFlagItem {
	const flag: DriftFlagItem = {
		id: generateId('flag'),
		projectId: input.projectId,
		decisionId: input.decisionId,
		relatedDecisionId: input.relatedDecisionId ?? null,
		flagType: input.flagType,
		severity: input.severity,
		description: input.description,
		resolved: false,
		resolution: null,
		resolvedAt: null,
		createdAt: new Date().toISOString(),
	};
	store.flags.set(flag.id, flag);
	return flag;
}

export function createDriftFlags(
	store: DriftFlagStore,
	inputs: CreateFlagInput[],
): DriftFlagItem[] {
	if (inputs.length === 0) return [];
	return inputs.map(input => createDriftFlag(store, input));
}

export function getOpenFlags(
	store: DriftFlagStore,
	projectId: string,
): DriftFlagItem[] {
	const flags: DriftFlagItem[] = [];
	for (const flag of store.flags.values()) {
		if (flag.projectId === projectId && !flag.resolved) {
			flags.push(flag);
		}
	}
	flags.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	return flags;
}


/* ─── Scan Result ────────────────────────────────────────── */

export interface DriftScanResult {
	flags: DriftFlagItem[];
	scanSummary: {
		totalChecked: number;
		flagsCreated: number;
		decayFlags: number;
		assumptionFlags: number;
		constitutionFlags: number;
	};
}

/**
 * Full drift scan for a project.
 */
export function scanProjectDrift(
	store: DriftFlagStore,
	projectId: string,
	activeDecisions: DecisionRegistryEntry[],
	constitution?: Constitution | null,
): DriftScanResult {
	const now = Date.now();
	const dayMs = 86400000;

	// Get existing flagged decision IDs to avoid duplicates
	const existingFlags = getOpenFlags(store, projectId);
	const flaggedDecisionIds = new Set(
		existingFlags.map(f => `${f.decisionId}:${f.flagType}:${f.relatedDecisionId ?? ''}`),
	);

	const flagInputs: CreateFlagInput[] = [];

	for (const decision of activeDecisions) {
		// Scan 1: Commitment decay
		if (decision.lastConfirmedAt) {
			const daysSinceConfirm = Math.floor(
				(now - new Date(decision.lastConfirmedAt).getTime()) / dayMs,
			);

			const decayKey = `${decision.id}:commitment-decay:`;
			if (daysSinceConfirm > DECAY_CRITICAL_DAYS && !flaggedDecisionIds.has(decayKey)) {
				flagInputs.push({
					projectId,
					decisionId: decision.id,
					flagType: 'commitment-decay',
					severity: 'critical',
					description: `Decision "${decision.statement}" has not been confirmed for ${daysSinceConfirm} days — may be severely decayed`,
				});
			} else if (daysSinceConfirm > DECAY_WARNING_DAYS && !flaggedDecisionIds.has(decayKey)) {
				flagInputs.push({
					projectId,
					decisionId: decision.id,
					flagType: 'commitment-decay',
					severity: 'warning',
					description: `Decision "${decision.statement}" has not been confirmed for ${daysSinceConfirm} days — review recommended`,
				});
			}
		}

		// Scan 2: Assumption stale
		if (decision.assumptions.length > 0 && decision.createdAt) {
			const age = Math.floor(
				(now - new Date(decision.createdAt).getTime()) / dayMs,
			);

			const staleKey = `${decision.id}:assumption-invalidated:`;
			if (age > ASSUMPTION_STALE_DAYS && !flaggedDecisionIds.has(staleKey)) {
				flagInputs.push({
					projectId,
					decisionId: decision.id,
					flagType: 'assumption-invalidated',
					severity: 'info',
					description: `Decision "${decision.statement}" has ${decision.assumptions.length} assumptions ` +
						`that are ${age} days old — may no longer hold`,
				});
			}
		}

		// Scan 3: Constitution violation
		if (constitution) {
			const violation = checkConstitutionViolation(decision, constitution);
			if (violation) {
				const violationKey = `${decision.id}:constitution-violation:`;
				if (!flaggedDecisionIds.has(violationKey)) {
					flagInputs.push({
						projectId,
						decisionId: decision.id,
						flagType: 'constitution-violation',
						severity: 'critical',
						description: violation,
					});
				}
			}
		}
	}

	// Batch write flags
	const newFlags = createDriftFlags(store, flagInputs);

	// Cross-scan: Assumption contradictions
	const assumptionFlags = scanAssumptionContradictions(
		store, projectId, activeDecisions, flaggedDecisionIds,
	);

	return {
		flags: [...newFlags, ...assumptionFlags],
		scanSummary: {
			totalChecked: activeDecisions.length,
			flagsCreated: newFlags.length + assumptionFlags.length,
			decayFlags: newFlags.filter(f => f.flagType === 'commitment-decay').length,
			assumptionFlags:
				assumptionFlags.length +
				newFlags.filter(f => f.flagType === 'assumption-invalidated').length,
			constitutionFlags: newFlags.filter(f => f.flagType === 'constitution-violation').length,
		},
	};
}


/* ─── Constitution Violation Check ───────────────────────── */

function checkConstitutionViolation(
	decision: DecisionRegistryEntry,
	constitution: Constitution,
): string | null {
	const statement = decision.statement.toLowerCase();

	// Check forbidden_features
	for (const feature of constitution.forbidden_features) {
		if (feature && statement.includes(feature.toLowerCase())) {
			return `Decision "${decision.statement}" violates constitution forbidden item: "${feature}"`;
		}
	}

	// Check constraints
	for (const constraint of constitution.constraints) {
		const lowerConstraint = constraint.toLowerCase();
		if (
			lowerConstraint.includes('no ') ||
			lowerConstraint.includes('not ') ||
			lowerConstraint.includes('避免') ||
			lowerConstraint.includes('不能') ||
			lowerConstraint.includes('不得')
		) {
			const concept = extractConstraintConcept(lowerConstraint);
			if (concept && statement.includes(concept)) {
				return `Decision "${decision.statement}" may conflict with constitution constraint: "${constraint}"`;
			}
		}
	}

	// Check deprecated forbiddenVec
	if (constitution.forbiddenVec) {
		const forbiddenLower = constitution.forbiddenVec.toLowerCase();
		if (statement.includes(forbiddenLower)) {
			return `Decision "${decision.statement}" involves prohibited area: "${constitution.forbiddenVec}"`;
		}
	}

	return null;
}

function extractConstraintConcept(constraint: string): string | null {
	const concept = constraint
		.replace(/不能|不得|不要|避免|no |not |without|禁止/g, '')
		.trim();
	if (concept.length < 2) return null;
	return concept;
}


/* ─── Assumption Contradiction Cross-Scan ─────────────────── */

function scanAssumptionContradictions(
	store: DriftFlagStore,
	projectId: string,
	activeDecisions: DecisionRegistryEntry[],
	existingFlaggedIds: Set<string>,
): DriftFlagItem[] {
	const flagInputs: CreateFlagInput[] = [];

	for (let i = 0; i < activeDecisions.length; i++) {
		for (let j = i + 1; j < activeDecisions.length; j++) {
			const a = activeDecisions[i];
			const b = activeDecisions[j];

			if (a.id === b.id) continue;
			if (a.assumptions.length === 0 || b.assumptions.length === 0) continue;

			const aConcepts = a.assumptions.map(extractKeyConcept).filter(Boolean);
			const bConcepts = b.assumptions.map(extractKeyConcept).filter(Boolean);

			for (const aConcept of aConcepts) {
				for (const bConcept of bConcepts) {
					if (aConcept && bConcept && areContradictoryAssumptions(aConcept, bConcept)) {
						const key = `${a.id}:assumption-invalidated:${b.id}`;
						if (!existingFlaggedIds.has(key)) {
							flagInputs.push({
								projectId,
								decisionId: a.id,
								relatedDecisionId: b.id,
								flagType: 'assumption-invalidated',
								severity: 'warning',
								description: `Assumption "${aConcept}" from "${a.statement}" ` +
									`may contradict assumption "${bConcept}" from "${b.statement}"`,
							});
						}
					}
				}
			}
		}
	}

	return createDriftFlags(store, flagInputs);
}

function extractKeyConcept(assumption: string): string | null {
	const cleaned = assumption.toLowerCase().trim();
	if (cleaned.length < 3) return null;
	return cleaned;
}

function areContradictoryAssumptions(a: string, b: string): boolean {
	const contradictoryPairs: [string, string][] = [
		['rust', 'python'],
		['rust', 'javascript'],
		['rust', 'typescript'],
		['webgl', 'canvas'],
		['react', 'vue'],
		['react', 'angular'],
		['mobile', 'desktop'],
		['ios', 'android'],
		['经验', '没有经验'],
		['有经验', '无经验'],
		['大团队', '小团队'],
		['慢', '快'],
		['保守', '激进'],
		['稳定', '快速'],
	];

	for (const [termA, termB] of contradictoryPairs) {
		if (
			(a.includes(termA) && b.includes(termB)) ||
			(a.includes(termB) && b.includes(termA))
		) {
			return true;
		}
	}

	return false;
}