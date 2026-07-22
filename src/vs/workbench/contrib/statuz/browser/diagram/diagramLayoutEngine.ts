/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Diagram Layout Engine — unified layout strategies
 *--------------------------------------------------------------------------------------------*/

import type {
	DiagramNodeDefinition,
	DiagramEdgeDefinition,
	DiagramDefinition,
	LayoutStrategy,
} from './diagramTypes.js';

/* ─── Column Layout Strategy ─────────────────────────────── */

class ColumnLayoutStrategy implements LayoutStrategy {
	name = 'column';

	layout(
		nodes: DiagramNodeDefinition[],
		_edges: DiagramEdgeDefinition[],
		_definition: DiagramDefinition,
	): DiagramNodeDefinition[] {
		const rowHeight = 150;
		const startX = 100;
		const startY = 100;

		return nodes.map((node, i) => ({
			...node,
			position: {
				x: startX,
				y: startY + i * rowHeight,
			},
		}));
	}
}

/* ─── Grouped Layout Strategy (by type) ──────────────────── */

class GroupedLayoutStrategy implements LayoutStrategy {
	name = 'grouped';

	layout(
		nodes: DiagramNodeDefinition[],
		_edges: DiagramEdgeDefinition[],
		_definition: DiagramDefinition,
	): DiagramNodeDefinition[] {
		const groups = new Map<string, DiagramNodeDefinition[]>();

		for (const node of nodes) {
			const list = groups.get(node.type) || [];
			list.push(node);
			groups.set(node.type, list);
		}

		const columnWidth = 350;
		const rowHeight = 150;
		const startX = 100;
		const startY = 100;
		let columnIndex = 0;

		const result: DiagramNodeDefinition[] = [];

		for (const [, groupNodes] of groups) {
			for (let i = 0; i < groupNodes.length; i++) {
				result.push({
					...groupNodes[i],
					position: {
						x: startX + columnIndex * columnWidth,
						y: startY + i * rowHeight,
					},
				});
			}
			columnIndex++;
		}

		return result;
	}
}

/* ─── Dagre Layout Strategy (dynamic require) ────────────── */

class DagreLayoutStrategy implements LayoutStrategy {
	name = 'dagre';

	layout(
		nodes: DiagramNodeDefinition[],
		edges: DiagramEdgeDefinition[],
		_definition: DiagramDefinition,
	): DiagramNodeDefinition[] {
		try {
			const dagre = require('dagre') as any;
			if (!dagre?.graphlib) {
				throw new Error('dagre not available');
			}

			const g = new dagre.graphlib.Graph();
			g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });
			g.setDefaultEdgeLabel(() => ({}));

			for (const node of nodes) {
				g.setNode(node.id, { width: 220, height: 100 });
			}

			for (const edge of edges) {
				g.setEdge(edge.source, edge.target);
			}

			dagre.layout(g);

			return nodes.map(node => {
				const dagreNode = g.node(node.id);
				if (dagreNode) {
					return {
						...node,
						position: {
							x: dagreNode.x - 110,
							y: dagreNode.y - 50,
						},
					};
				}
				return node;
			});
		} catch {
			// Fallback to column layout
			console.warn('[DiagramLayoutEngine] dagre unavailable, falling back to column layout');
			return new ColumnLayoutStrategy().layout(nodes, edges, _definition);
		}
	}
}

/* ─── Diagram Layout Engine ──────────────────────────────── */

export class DiagramLayoutEngine {
	private strategies: Map<string, LayoutStrategy> = new Map();

	constructor() {
		this.registerStrategy(new ColumnLayoutStrategy());
		this.registerStrategy(new GroupedLayoutStrategy());
		this.registerStrategy(new DagreLayoutStrategy());
	}

	registerStrategy(strategy: LayoutStrategy): void {
		this.strategies.set(strategy.name, strategy);
	}

	layout(
		strategyName: string,
		nodes: DiagramNodeDefinition[],
		edges: DiagramEdgeDefinition[],
		definition: DiagramDefinition,
	): DiagramNodeDefinition[] {
		const strategy = this.strategies.get(strategyName);
		if (!strategy) {
			console.warn(`[DiagramLayoutEngine] Unknown strategy "${strategyName}", using column`);
			return this.strategies.get('column')!.layout(nodes, edges, definition);
		}
		return strategy.layout(nodes, edges, definition);
	}

	getAvailableStrategies(): string[] {
		return Array.from(this.strategies.keys());
	}
}