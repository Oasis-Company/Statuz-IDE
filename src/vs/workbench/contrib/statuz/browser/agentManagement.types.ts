/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Re-export all new generic types
export {
	AgentDefinition,
	AgentDefinitionSource,
	AgentDefinitionWithState,
	AgentDefinitionIndex,
	AgentDefinitionFilter,
	AgentRuntimeState,
	LocalAgentSource,
	EccAgentSource,
	MarketplaceAgentSource,
	DEFAULT_FILTER,
} from './agentdef/agentDefinitionTypes.js';

// ─── Deprecated types (kept for backward compatibility) ────────

/**
 * @deprecated Use `AgentDefinition.kind` (string) instead.
 * This enum was a hardcoded copy of ECC's classification system.
 * The new model uses extensible strings.
 */
export type AgentSkillType = 'agent' | 'skill' | 'command' | 'rule';

/**
 * @deprecated Use `AgentRuntimeState` instead.
 */
export type ItemState = 'enabled' | 'disabled' | 'error' | 'installing';

/**
 * @deprecated Use `AgentDefinitionWithState` instead.
 * This interface was ECC-catalog-shaped and included ECC-specific fields
 * like `installPath` and `state` (install state) in the core type.
 */
export interface IAgentSkillItem {
	id: string;
	name: string;
	/** @deprecated Use `AgentDefinition.kind` instead */
	type: AgentSkillType;
	description: string;
	version: string;
	author: string;
	/** @deprecated Use `AgentDefinitionWithState.state` instead */
	state: ItemState;
	iconCodicon: string;
	/** @deprecated ECC-specific. Not in AgentDefinition. */
	installPath: string;
	config: Record<string, any>;
	lastUsed: number;
	usageCount: number;
	tags: string[];
	category: string;
}

/**
 * @deprecated Use `AgentDefinitionFilter` instead.
 */
export interface IAgentSkillFilter {
	query: string;
	/** @deprecated Use `AgentDefinitionFilter.kinds` instead */
	types: AgentSkillType[];
	state: ItemState | 'all';
	sortBy: 'name' | 'lastUsed' | 'usageCount' | 'state';
	sortAsc: boolean;
}

/**
 * @deprecated Use `AgentDefinitionWithState` list rendering instead.
 */
export interface IAgentSkillTemplateData {
	root: HTMLElement;
	element: HTMLElement;
	icon: HTMLElement;
	name: HTMLElement;
	description: HTMLElement;
	typeLabel: HTMLElement;
	stateIndicator: HTMLElement;
	actionContainer: HTMLElement;
	item: IAgentSkillItem | null;
}

/**
 * @deprecated No longer used. List height is handled by the rendering component.
 */
export const AGENT_MGMT_LIST_ELEMENT_HEIGHT = 72;

// ─── Config Snapshot (for version history) ──────────────────

export interface ConfigSnapshot {
	/** Unique snapshot ID (timestamp-based) */
	readonly id: string;
	/** Reference to AgentDefinition.id */
	readonly agentId: string;
	/** Full config at snapshot time */
	readonly config: Record<string, unknown>;
	/** Human-readable label (auto-generated or user-provided) */
	readonly label: string;
	/** Unix ms timestamp */
	readonly timestamp: number;
}

// ─── Agent Template (for quick creation) ─────────────────────

export interface AgentTemplate {
	/** Unique template ID */
	readonly id: string;
	/** Display name */
	readonly name: string;
	/** Short description shown in template card */
	readonly description: string;
	/** Category for grouping */
	readonly category: string;
	/** Tags for search */
	readonly tags: readonly string[];
	/** Icon codicon class */
	readonly icon: string;
	/** Default kind */
	readonly kind: string;
	/** Pre-filled AgentDefinition fields (partial) */
	readonly defaults: {
		description: string;
		config: Record<string, unknown>;
		author: string;
		version: string;
	};
}

// ─── Usage Stats (for performance dashboard) ────────────────

export interface AgentUsageRecord {
	/** Agent ID */
	readonly agentId: string;
	/** Unix ms timestamp */
	readonly timestamp: number;
	/** Prompt sent to LLM (truncated to 500 chars) */
	readonly promptPreview: string;
	/** Response received from LLM (truncated to 500 chars) */
	readonly responsePreview: string;
	/** Token usage */
	readonly tokensIn: number;
	readonly tokensOut: number;
	/** Latency in ms */
	readonly latencyMs: number;
	/** Whether the response was successful */
	readonly success: boolean;
}

export interface AgentUsageStats {
	readonly agentId: string;
	readonly totalCalls: number;
	readonly totalTokensIn: number;
	readonly totalTokensOut: number;
	readonly avgLatencyMs: number;
	readonly successRate: number;
	readonly lastUsed: number;
	readonly recentRecords: readonly AgentUsageRecord[];
}