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