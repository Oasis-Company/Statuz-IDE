/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentDefinition, EccAgentSource } from './agentDefinitionTypes.js';
import { EccComponentMeta, EccCatalog } from '../ecc/eccCatalogTypes.js';

/**
 * Maps an ECC component to a generic AgentDefinition.
 *
 * This adapter is the ONLY place where ECC-specific mapping logic lives.
 * No other module should directly convert EccComponentMeta to AgentDefinition.
 *
 * Key design decisions:
 * - id: "ecc:" + componentId (prefix distinguishes from local definitions)
 * - kind: string (not enum) — directly uses EccComponentMeta.type value
 * - source: EccAgentSource with componentId and eccVersion
 * - installPath, dependencies, fileSize are STRIPPED (ECC-specific fields)
 * - state (enabled/disabled/error) is NOT part of AgentDefinition
 */
export function eccComponentToAgentDefinition(
	component: EccComponentMeta,
	catalog: EccCatalog,
): AgentDefinition {
	const source: EccAgentSource = {
		type: 'ecc',
		componentId: component.id,
		eccVersion: catalog.version,
	};

	return {
		id: `ecc:${component.id}`,
		name: component.name,
		kind: component.type, // string, not enum — direct mapping
		description: component.description,
		version: component.version,
		author: component.author,
		source,
		icon: component.iconCodicon,
		category: component.category,
		tags: [...component.tags, 'ecc'],
		config: {},
		createdAt: component.lastUpdated || Date.now(),
		updatedAt: component.lastUpdated || Date.now(),
	};
}

/**
 * Batch-convert all components in a catalog to AgentDefinitions.
 */
export function eccCatalogToAgentDefinitions(catalog: EccCatalog): AgentDefinition[] {
	return catalog.components.map(comp => eccComponentToAgentDefinition(comp, catalog));
}

/**
 * Legacy mapping: extract an ECC component ID from an AgentDefinition
 * for use with IEccInstallService during the migration period.
 */
export function extractEccComponentId(definition: AgentDefinition): string | null {
	if (definition.source.type === 'ecc') {
		return definition.source.componentId;
	}
	return null;
}