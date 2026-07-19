/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Generic Agent Definition data model.
 *
 * DESIGN PRINCIPLE: This model is source-agnostic. It does NOT import from
 * ecc/ or any other source-specific module. Adapters (like eccAdapter.ts)
 * are responsible for mapping external formats to this model.
 *
 * DESIGN PRINCIPLE: `kind` is a `string`, not an enum. This prevents
 * overfitting to ECC's classification (agent/skill/command/rule).
 * Any source can define any kind, and the UI uses `icon` + `category`
 * for rendering decisions, not `kind` value.
 */

// ─── Source (Discriminated Union) ──────────────────────────────

export interface LocalAgentSource {
	readonly type: 'local';
	/** Path relative to workspace root, e.g. ".statuzide/definitions/my-agent.yaml" */
	readonly path: string;
}

export interface EccAgentSource {
	readonly type: 'ecc';
	/** ECC component ID, e.g. "agent:code-reviewer" */
	readonly componentId: string;
	/** ECC version at time of import */
	readonly eccVersion: string;
	/** Whether a newer ECC version is available */
	readonly updateAvailable?: boolean;
}

export interface MarketplaceAgentSource {
	readonly type: 'marketplace';
	/** Marketplace package URL */
	readonly url: string;
	/** Package identifier */
	readonly packageId: string;
}

export type AgentDefinitionSource = LocalAgentSource | EccAgentSource | MarketplaceAgentSource;

// ─── AgentDefinition ───────────────────────────────────────────

export interface AgentDefinition {
	/** Unique identifier. Local: "local:<name>", ECC: "ecc:<componentId>" */
	readonly id: string;
	/** Display name */
	readonly name: string;
	/** Capability kind. Common values: "agent", "skill", "command", "rule". Extensible. */
	readonly kind: string;
	/** Human-readable description */
	readonly description: string;
	/** Semantic version */
	readonly version: string;
	/** Author or source organization */
	readonly author: string;
	/** Source information (discriminated union) */
	readonly source: AgentDefinitionSource;
	/** UI icon (codicon class name, e.g. "codicon-symbol-method") */
	readonly icon: string;
	/** UI display category */
	readonly category: string;
	/** Tags for filtering and search */
	readonly tags: readonly string[];
	/** Extensible configuration (harness, pipeline, etc.) */
	readonly config: Record<string, unknown>;
	/** Creation timestamp (Unix ms) */
	readonly createdAt: number;
	/** Last update timestamp (Unix ms) */
	readonly updatedAt: number;
}

// ─── Runtime State (separated from data model) ─────────────────

export type AgentRuntimeState = 'disabled' | 'enabled' | 'error' | 'installing';

export interface AgentDefinitionWithState {
	readonly definition: AgentDefinition;
	state: AgentRuntimeState;
	lastUsed: number;
	usageCount: number;
}

// ─── Index ─────────────────────────────────────────────────────

export interface AgentDefinitionIndex {
	/** Index format version */
	readonly version: 1;
	/** Definition ID → relative file path */
	readonly entries: Record<string, string>;
	/** Last update timestamp */
	readonly updatedAt: number;
}

// ─── Filter (source-agnostic) ──────────────────────────────────

export interface AgentDefinitionFilter {
	query: string;
	kinds: string[];        // empty = all kinds
	sourceTypes: Array<'local' | 'ecc' | 'marketplace'>;  // empty = all sources
	state: AgentRuntimeState | 'all';
	sortBy: 'name' | 'kind' | 'lastUsed' | 'usageCount';
	sortAsc: boolean;
}

export const DEFAULT_FILTER: AgentDefinitionFilter = {
	query: '',
	kinds: [],
	sourceTypes: [],
	state: 'all',
	sortBy: 'name',
	sortAsc: true,
};