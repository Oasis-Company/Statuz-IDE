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
	// ── Phase 2 fields ──
	/** Time to first token in ms */
	readonly ttftMs?: number;
	/** Error category for classification */
	readonly errorCategory?: 'network' | 'timeout' | 'rate_limit' | 'content_filter' | 'off_topic' | 'unknown' | 'quota' | 'not_found' | 'permission';
	/** Model identifier used */
	readonly modelId?: string;
	/** Whether streaming was used */
	readonly streaming?: boolean;
	/** Number of tool calls made */
	readonly toolCalls?: number;
	/** Associated RunSession ID */
	readonly sessionId?: string;
}

// ─── Run Session (multi-turn conversation lifecycle) ─────────

export interface AgentRunSession {
	/** Unique session ID */
	readonly id: string;
	/** Agent ID */
	readonly agentId: string;
	/** Unix ms start time */
	readonly startTime: number;
	/** Unix ms end time */
	readonly endTime?: number;
	/** Conversation messages */
	readonly messages: { role: string; content: string; timestamp: number }[];
	/** Session metrics */
	readonly metrics: {
		ttftMs?: number;
		totalLatencyMs?: number;
		totalTokensIn: number;
		totalTokensOut: number;
		toolCallCount: number;
	};
	/** Session status */
	readonly status: 'running' | 'completed' | 'error' | 'cancelled';
	/** Error details if status is 'error' */
	readonly error?: { category: string; message: string };
}

// ─── Usage Stats (extended) ──────────────────────────────────

export interface AgentUsageStats {
	readonly agentId: string;
	readonly totalCalls: number;
	readonly totalTokensIn: number;
	readonly totalTokensOut: number;
	readonly avgLatencyMs: number;
	readonly successRate: number;
	readonly lastUsed: number;
	readonly recentRecords: readonly AgentUsageRecord[];
	// ── Phase 2 fields ──
	/** 50th percentile latency */
	readonly p50LatencyMs?: number;
	/** 95th percentile latency */
	readonly p95LatencyMs?: number;
	/** 99th percentile latency */
	readonly p99LatencyMs?: number;
	/** Total error count */
	readonly totalErrors?: number;
	/** Error breakdown by category */
	readonly errorBreakdown?: Record<string, number>;
	/** Total tool call count */
	readonly totalToolCalls?: number;
	/** Model usage distribution */
	readonly modelDistribution?: Record<string, number>;
	/** Token usage trend over time */
	readonly tokenTrend?: { timestamp: number; tokensIn: number; tokensOut: number }[];
	/** Summary status for the agent */
	readonly status?: 'healthy' | 'degraded' | 'error' | 'inactive';
	/** Human-readable summary of agent performance */
	readonly summary?: string;
}