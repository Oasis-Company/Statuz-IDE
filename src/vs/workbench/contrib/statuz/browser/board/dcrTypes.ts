/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/dcr/types.ts
 *  Adapted: Supabase row types removed; kept core decision types
 *--------------------------------------------------------------------------------------------*/

/* ─── Scalar Types ──────────────────────────────────────── */

/** Commitment level: from "exploring" to "set in stone" */
export type CommitmentLevel =
	| 'exploring'
	| 'tentative'
	| 'adopted'
	| 'committed'
	| 'rejected'
	| 'superseded';

/** Decision category */
export type DecisionCategory =
	| 'scope'
	| 'technology'
	| 'business'
	| 'design'
	| 'process';

/** Directed relationship between two decisions */
export type DecisionRelationship =
	| 'depends-on'
	| 'conflicts-with'
	| 'reinforces'
	| 'alternative';

/** Drift flag type */
export type DriftFlagType =
	| 'direct-conflict'
	| 'scope-creep'
	| 'commitment-decay'
	| 'assumption-invalidated'
	| 'constitution-violation';

/** Drift severity */
export type DriftSeverity =
	| 'info'
	| 'warning'
	| 'critical';

/** Drift resolution */
export type DriftResolution =
	| 'override'
	| 'reject'
	| 'reconcile';

/** Detection source */
export type DetectionSource =
	| 'manual'
	| 'ai-detected'
	| 'rule-based';

/** Decision source */
export type DecisionSource =
	| 'manual'
	| 'skill'
	| 'system'
	| 'migration';


/* ─── Core Entities ─────────────────────────────────────── */

/** Edge between two decisions */
export interface DecisionEdge {
	id: string;
	sourceDecisionId: string;
	targetDecisionId: string;
	relationship: DecisionRelationship;
	rationale: string | null;
	detectedBy: DetectionSource;
	createdAt: string;
}

/** Drift flag — a detected decision consistency issue */
export interface DriftFlagItem {
	id: string;
	projectId: string;
	decisionId: string;
	relatedDecisionId: string | null;
	flagType: DriftFlagType;
	severity: DriftSeverity;
	description: string;
	resolved: boolean;
	resolution: DriftResolution | null;
	resolvedAt: string | null;
	createdAt: string;
}

/** Decision registry entry */
export interface DecisionRegistryEntry {
	id: string;
	projectId: string;
	branchId: string | null;

	statement: string;
	category: DecisionCategory;

	issue: string | null;
	rationale: string | null;

	commitmentLevel: CommitmentLevel;
	legacyStatus: 'proposed' | 'evaluating' | 'accepted' | 'rejected';

	alternatives: string[];
	assumptions: string[];
	source: DecisionSource;
	relatedCardIds: string[];

	createdAt: string;
	lastConfirmedAt: string | null;
	supersededById: string | null;

	edges: DecisionEdge[];
	incomingEdges: DecisionEdge[];
	driftFlags: DriftFlagItem[];
}

/** Decision graph for Board rendering */
export interface DecisionGraph {
	nodes: DecisionRegistryEntry[];
	edges: DecisionEdge[];
	openFlags: DriftFlagItem[];
}

/** Convergence check item */
export interface ConvergenceItem {
	decisionId: string;
	statement: string;
	commitmentLevel: CommitmentLevel;
	age: number;
	daysSinceConfirm: number;
	reason: 'old' | 'conflicting' | 'low-commitment' | 'assumption-stale';
	suggestion: string;
}

/** Register decision input */
export interface RegisterDecisionInput {
	projectId: string;
	branchId?: string | null;
	statement: string;
	category: DecisionCategory;
	issue?: string | null;
	rationale?: string | null;
	commitmentLevel?: CommitmentLevel;
	alternatives?: string[];
	assumptions?: string[];
	source?: DecisionSource;
	relatedCardIds?: string[];
}

/** Update commitment input */
export interface UpdateCommitmentInput {
	decisionId: string;
	newLevel: CommitmentLevel;
	reason: string;
	supersededById?: string;
}

/** Resolve drift input */
export interface ResolveDriftInput {
	flagId: string;
	resolution: DriftResolution;
	note?: string;
}