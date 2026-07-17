/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/dcr/registry.ts
 *  Adapted: Supabase → in-memory Map; compensating transaction via try/catch rollback
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type {
	DecisionRegistryEntry,
	DecisionGraph,
	RegisterDecisionInput,
	UpdateCommitmentInput,
	ResolveDriftInput,
	DriftFlagItem,
	DecisionEdge,
	CommitmentLevel,
	DecisionSource,
	ConvergenceItem,
} from './dcrTypes.js';
import { generateId } from './dcrTransform.js';
import { RelationshipMapper } from './dcrRelationshipMapper.js';

/* ─── Constants ──────────────────────────────────────────── */

const COMMITMENT_TO_STATUS: Record<CommitmentLevel, string> = {
	exploring: 'proposed',
	tentative: 'proposed',
	adopted: 'accepted',
	committed: 'accepted',
	rejected: 'rejected',
	superseded: 'accepted',
};

const ACTIVE_LEVELS: readonly CommitmentLevel[] = [
	'exploring',
	'tentative',
	'adopted',
	'committed',
];

const CONVERGENCE_THRESHOLD = 7;
const COMMITMENT_DECAY_DAYS = 14;


/* ─── In-Memory Store ────────────────────────────────────── */

interface DCRStore {
	decisions: Map<string, DecisionRegistryEntry>;
	edges: Map<string, DecisionEdge>;
	driftFlags: Map<string, DriftFlagItem>;
}

function createStore(): DCRStore {
	return {
		decisions: new Map(),
		edges: new Map(),
		driftFlags: new Map(),
	};
}


/* ─── DCRegistry ─────────────────────────────────────────── */

export class DCRegistry {
	private store: DCRStore;

	constructor(store?: DCRStore) {
		this.store = store ?? createStore();
	}

	/**
	 * Register a new decision.
	 *
	 * Flow:
	 *   1. Validate input
	 *   2. Compute relationships (no writes yet)
	 *   3. Insert decision
	 *   4. Insert edges + drift flags
	 *   5. Any step fails → compensating rollback
	 */
	registerDecision(input: RegisterDecisionInput): DecisionRegistryEntry {
		this.validateInput(input);

		const commitmentLevel: CommitmentLevel = input.commitmentLevel ?? 'exploring';
		const source: DecisionSource = input.source ?? 'manual';
		const decisionId = generateId('dec');

		// Phase 1: Compute (no writes)
		const existingDecisions = this.getActiveDecisions(input.projectId);
		const mapper = new RelationshipMapper();

		const newEntryBase: DecisionRegistryEntry = {
			id: decisionId,
			projectId: input.projectId,
			branchId: input.branchId ?? null,
			statement: input.statement,
			category: input.category ?? 'scope',
			issue: input.issue ?? null,
			rationale: input.rationale ?? null,
			commitmentLevel,
			legacyStatus: COMMITMENT_TO_STATUS[commitmentLevel] as DecisionRegistryEntry['legacyStatus'],
			alternatives: input.alternatives ?? [],
			assumptions: input.assumptions ?? [],
			source,
			relatedCardIds: input.relatedCardIds ?? [],
			createdAt: new Date().toISOString(),
			lastConfirmedAt: new Date().toISOString(),
			supersededById: null,
			edges: [],
			incomingEdges: [],
			driftFlags: [],
		};

		const pairResults = mapper.detectRelationships(newEntryBase, existingDecisions);
		const projectResults = mapper.detectProjectLevelRisks(newEntryBase, [
			...existingDecisions,
			newEntryBase,
		]);
		const detectionResults = [...pairResults, ...projectResults];

		// Phase 2: Insert decision
		const rolledBackEdges: string[] = [];
		const rolledBackFlags: string[] = [];

		try {
			this.store.decisions.set(decisionId, newEntryBase);

			// Phase 3: Insert edges
			const edges: DecisionEdge[] = [];
			for (const result of detectionResults) {
				const edgeId = generateId('edge');
				const edge: DecisionEdge = {
					id: edgeId,
					sourceDecisionId: decisionId,
					targetDecisionId: result.targetDecisionId,
					relationship: result.relationship,
					rationale: result.rationale ?? null,
					detectedBy: result.detectedBy,
					createdAt: new Date().toISOString(),
				};
				this.store.edges.set(edgeId, edge);
				rolledBackEdges.push(edgeId);
				edges.push(edge);
			}

			// Phase 4: Insert drift flags
			const driftFlags: DriftFlagItem[] = [];
			for (const result of detectionResults) {
				if (result.relationship === 'conflicts-with' && result.shouldFlag) {
					const flagId = generateId('flag');
					const flag: DriftFlagItem = {
						id: flagId,
						projectId: input.projectId,
						decisionId,
						relatedDecisionId: result.targetDecisionId,
						flagType: result.driftFlagType ?? 'direct-conflict',
						severity: result.driftSeverity ?? 'warning',
						description: result.driftDescription ??
							`Decision "${input.statement}" conflicts with "${result.targetStatement}"`,
						resolved: false,
						resolution: null,
						resolvedAt: null,
						createdAt: new Date().toISOString(),
					};
					this.store.driftFlags.set(flagId, flag);
					rolledBackFlags.push(flagId);
					driftFlags.push(flag);
				}
			}

			// Phase 5: Assemble and return
			const entry = this.store.decisions.get(decisionId)!;
			entry.edges = edges;
			entry.driftFlags = driftFlags;
			entry.incomingEdges = [];
			return entry;

		} catch (err) {
			// Compensating rollback
			this.compensateDelete(decisionId, rolledBackEdges, rolledBackFlags);
			throw err;
		}
	}

	/**
	 * Compensating delete: remove all traces of a failed registration.
	 * In-memory equivalent of Supabase ON DELETE CASCADE.
	 */
	private compensateDelete(
		decisionId: string,
		edgeIds: string[],
		flagIds: string[],
	): void {
		this.store.decisions.delete(decisionId);
		for (const edgeId of edgeIds) {
			this.store.edges.delete(edgeId);
		}
		for (const flagId of flagIds) {
			this.store.driftFlags.delete(flagId);
		}
	}

	/**
	 * Upgrade/downgrade a decision's commitment level.
	 */
	updateCommitment(input: UpdateCommitmentInput): void {
		const entry = this.store.decisions.get(input.decisionId);
		if (!entry) {
			throw new Error(`[DCRegistry] Decision not found: ${input.decisionId}`);
		}

		entry.commitmentLevel = input.newLevel;
		entry.lastConfirmedAt = new Date().toISOString();

		if (input.newLevel === 'rejected' || input.newLevel === 'superseded') {
			entry.legacyStatus = 'rejected';
		} else if (input.newLevel === 'adopted' || input.newLevel === 'committed') {
			entry.legacyStatus = 'accepted';
		}

		if (input.supersededById) {
			entry.supersededById = input.supersededById;
		}
	}

	/**
	 * Batch register decisions (for post-conversation confirmation).
	 */
	registerBatch(inputs: RegisterDecisionInput[]): DecisionRegistryEntry[] {
		const results: DecisionRegistryEntry[] = [];
		for (const input of inputs) {
			const entry = this.registerDecision(input);
			results.push(entry);
		}
		return results;
	}

	/**
	 * Get active decisions (commitmentLevel IN exploring/tentative/adopted/committed).
	 */
	getActiveDecisions(projectId: string): DecisionRegistryEntry[] {
		const results: DecisionRegistryEntry[] = [];
		for (const entry of this.store.decisions.values()) {
			if (
				entry.projectId === projectId &&
				ACTIVE_LEVELS.includes(entry.commitmentLevel)
			) {
				results.push(entry);
			}
		}
		results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return results;
	}

	/**
	 * Get the complete decision graph for Board rendering.
	 */
	getDecisionGraph(projectId: string): DecisionGraph {
		const nodes: DecisionRegistryEntry[] = [];

		// Build index: decision_id → edges
		const edgesBySource = new Map<string, DecisionEdge[]>();
		const edgesByTarget = new Map<string, DecisionEdge[]>();
		for (const edge of this.store.edges.values()) {
			const sl = edgesBySource.get(edge.sourceDecisionId) ?? [];
			sl.push(edge);
			edgesBySource.set(edge.sourceDecisionId, sl);
			const tl = edgesByTarget.get(edge.targetDecisionId) ?? [];
			tl.push(edge);
			edgesByTarget.set(edge.targetDecisionId, tl);
		}

		// Build index: decision_id → drift flags
		const flagsByDecision = new Map<string, DriftFlagItem[]>();
		for (const flag of this.store.driftFlags.values()) {
			if (flag.projectId !== projectId) continue;
			const list = flagsByDecision.get(flag.decisionId) ?? [];
			list.push(flag);
			flagsByDecision.set(flag.decisionId, list);
		}

		for (const entry of this.store.decisions.values()) {
			if (entry.projectId !== projectId) continue;
			entry.edges = edgesBySource.get(entry.id) ?? [];
			entry.incomingEdges = edgesByTarget.get(entry.id) ?? [];
			entry.driftFlags = flagsByDecision.get(entry.id) ?? [];
			nodes.push(entry);
		}

		// Deduplicate edges
		const edgeMap = new Map<string, DecisionEdge>();
		for (const edges of edgesBySource.values()) {
			for (const e of edges) {
				edgeMap.set(e.id, e);
			}
		}

		return {
			nodes,
			edges: [...edgeMap.values()],
			openFlags: [...this.store.driftFlags.values()]
				.filter(f => f.projectId === projectId && !f.resolved),
		};
	}

	/**
	 * Get unresolved drift flags.
	 */
	getOpenDriftFlags(projectId: string): DriftFlagItem[] {
		const flags: DriftFlagItem[] = [];
		for (const flag of this.store.driftFlags.values()) {
			if (flag.projectId === projectId && !flag.resolved) {
				flags.push(flag);
			}
		}
		flags.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return flags;
	}

	/**
	 * Resolve a drift flag.
	 */
	resolveDrift(input: ResolveDriftInput): void {
		const flag = this.store.driftFlags.get(input.flagId);
		if (!flag) {
			throw new Error(`[DCRegistry] Drift flag not found: ${input.flagId}`);
		}
		flag.resolved = true;
		flag.resolution = input.resolution;
		flag.resolvedAt = new Date().toISOString();
	}

	/**
	 * Check if convergence review is needed (active decisions > threshold).
	 */
	checkConvergenceRequired(projectId: string): boolean {
		const active = this.getActiveDecisions(projectId);
		return active.length > CONVERGENCE_THRESHOLD;
	}

	/**
	 * Generate convergence review items.
	 */
	requestConvergenceReview(projectId: string): ConvergenceItem[] {
		const active = this.getActiveDecisions(projectId);
		const items: ConvergenceItem[] = [];

		const now = Date.now();
		const dayMs = 86400000;

		for (const d of active) {
			const age = Math.floor((now - new Date(d.createdAt).getTime()) / dayMs);
			const daysSinceConfirm = d.lastConfirmedAt
				? Math.floor((now - new Date(d.lastConfirmedAt).getTime()) / dayMs)
				: age;

			// Decisions with unresolved drift flags — highest priority
			if (d.driftFlags.length > 0 && !d.driftFlags.every(f => f.resolved)) {
				items.push({
					decisionId: d.id,
					statement: d.statement,
					commitmentLevel: d.commitmentLevel,
					age,
					daysSinceConfirm,
					reason: 'conflicting',
					suggestion: 'This decision has unresolved drift flags — prioritize resolution',
				});
				continue;
			}

			// Long-unconfirmed decisions
			if (daysSinceConfirm > COMMITMENT_DECAY_DAYS) {
				items.push({
					decisionId: d.id,
					statement: d.statement,
					commitmentLevel: d.commitmentLevel,
					age,
					daysSinceConfirm,
					reason: 'old',
					suggestion: `${daysSinceConfirm} days since last confirmation — review recommended`,
				});
				continue;
			}

			// Low-commitment stale decisions
			if (d.commitmentLevel === 'exploring' && age > 7) {
				items.push({
					decisionId: d.id,
					statement: d.statement,
					commitmentLevel: d.commitmentLevel,
					age,
					daysSinceConfirm,
					reason: 'low-commitment',
					suggestion: 'This decision has been "exploring" for > 7 days — upgrade or drop',
				});
			}
		}

		return items;
	}


	/* ─── Internal ────────────────────────────────────────── */

	private validateInput(input: RegisterDecisionInput): void {
		if (!input.projectId) throw new Error('[DCRegistry] projectId is required');
		if (!input.statement || input.statement.trim().length === 0) {
			throw new Error('[DCRegistry] statement is required');
		}
		if (input.statement.length > 2000) {
			throw new Error('[DCRegistry] statement exceeds 2000 characters');
		}
	}
}


/* ─── Factory ────────────────────────────────────────────── */

export function createDCRegistry(store?: DCRStore): DCRegistry {
	return new DCRegistry(store);
}