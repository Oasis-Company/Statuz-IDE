/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Diagram Node Renderer Registry — global registration of node type configs
 *--------------------------------------------------------------------------------------------*/

import type { DiagramNodeTypeConfig } from './diagramTypes.js';

/* ─── Registry ───────────────────────────────────────────── */

const nodeTypeRegistry = new Map<string, DiagramNodeTypeConfig>();

export function registerNodeType(config: DiagramNodeTypeConfig): void {
	if (nodeTypeRegistry.has(config.type)) {
		console.warn(`[DiagramNodeRegistry] Overwriting node type "${config.type}"`);
	}
	nodeTypeRegistry.set(config.type, config);
}

export function getNodeTypeConfig(type: string): DiagramNodeTypeConfig | undefined {
	return nodeTypeRegistry.get(type);
}

export function hasNodeType(type: string): boolean {
	return nodeTypeRegistry.has(type);
}

export function getAllNodeTypes(): DiagramNodeTypeConfig[] {
	return Array.from(nodeTypeRegistry.values());
}

export function clearNodeTypeRegistry(): void {
	nodeTypeRegistry.clear();
}