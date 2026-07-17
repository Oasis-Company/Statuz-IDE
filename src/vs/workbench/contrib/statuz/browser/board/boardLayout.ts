/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/components/flow/boardUtils.ts
 *  Adapted: React Flow types → native FlowNodeLayout/FlowEdgeData
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type { SandboxCard, Constitution, FlowNodeLayout, FlowEdgeData } from './boardTypes.js';

/* ─── Constants ──────────────────────────────────────────── */

const CARD_SPACING_Y = 130;
const CARD_START_Y = 100;
const CARD_ANCHOR_X = 100;
const DECISION_OFFSET_X = 420;
const DECISION_SPACING_Y = 100;
const CONSTITUTION_ANCHOR = { x: 100, y: 20 };

/** Column layout: positions constitution at anchor, cards vertically, decisions at right */
const CARD_ORDER = ['vision', 'user', 'problem', 'mvp'] as const;


/* ─── Build Nodes ────────────────────────────────────────── */

export function buildNodes(
	cards: SandboxCard[],
	constitution: Constitution | null | undefined,
	decisions: Array<{ id: string; type: string; description: string }>,
	nodeLayouts: FlowNodeLayout[],
	highlightedNodeIds: string[] = [],
	importingCardIds: Set<string> = new Set(),
): FlowNodeLayout[] {
	const layoutMap = new Map<string, FlowNodeLayout>();
	for (const layout of nodeLayouts) {
		layoutMap.set(layout.id, layout);
	}

	const result: FlowNodeLayout[] = [];

	// 1. Constitution node
	if (constitution) {
		const nodeId = `constitution-${constitution.vision.substring(0, 8)}`;
		const existing = layoutMap.get(nodeId);
		result.push({
			id: nodeId,
			type: 'constitution',
			position: existing?.position ?? { ...CONSTITUTION_ANCHOR },
			size: existing?.size ?? 'medium',
			collapsed: existing?.collapsed ?? false,
		});
	}

	// 2. Strategy cards — ordered by CARD_ORDER, fallback to creation order
	const cardMap = new Map<string, SandboxCard>();
	for (const card of cards) {
		cardMap.set(card.type, card);
	}

	let cardIndex = 0;
	for (const cardType of CARD_ORDER) {
		const card = cardMap.get(cardType);
		if (!card) continue;

		const nodeId = card.id;
		const existing = layoutMap.get(nodeId);
		const position = existing?.position ?? {
			x: CARD_ANCHOR_X,
			y: CARD_START_Y + cardIndex * CARD_SPACING_Y,
		};

		result.push({
			id: nodeId,
			type: 'card',
			position,
			size: existing?.size ?? 'medium',
			collapsed: existing?.collapsed ?? false,
		});

		cardIndex++;
	}

	// Add any cards not in CARD_ORDER
	for (const card of cards) {
		if (CARD_ORDER.includes(card.type as typeof CARD_ORDER[number])) continue;

		const nodeId = card.id;
		const existing = layoutMap.get(nodeId);
		const position = existing?.position ?? {
			x: CARD_ANCHOR_X,
			y: CARD_START_Y + cardIndex * CARD_SPACING_Y,
		};

		result.push({
			id: nodeId,
			type: 'card',
			position,
			size: existing?.size ?? 'medium',
			collapsed: existing?.collapsed ?? false,
		});

		cardIndex++;
	}

	// 3. Decision nodes
	let decisionIndex = 0;
	for (const decision of decisions) {
		const nodeId = decision.id;
		const existing = layoutMap.get(nodeId);
		const position = existing?.position ?? {
			x: DECISION_OFFSET_X,
			y: 100 + decisionIndex * DECISION_SPACING_Y,
		};

		result.push({
			id: nodeId,
			type: 'decision',
			position,
			size: existing?.size ?? 'small',
			collapsed: existing?.collapsed ?? false,
		});

		decisionIndex++;
	}

	return result;
}


/* ─── Build Edges ────────────────────────────────────────── */

export function buildEdges(
	cards: SandboxCard[],
	storedEdges: FlowEdgeData[],
): FlowEdgeData[] {
	const result: FlowEdgeData[] = [];
	const edgeKeySet = new Set<string>();

	// Helper to add edge without duplicates
	const addEdge = (edge: FlowEdgeData): void => {
		const key = `${edge.source}|${edge.target}|${edge.type}`;
		if (edgeKeySet.has(key)) return;
		edgeKeySet.add(key);
		result.push(edge);
	};

	// Auto-generate card chain edges (user→problem→mvp→vision)
	const cardMap = new Map<string, SandboxCard>();
	for (const card of cards) {
		cardMap.set(card.type, card);
	}

	const chain = CARD_ORDER.filter(type => cardMap.has(type));
	for (let i = 0; i < chain.length - 1; i++) {
		const sourceCard = cardMap.get(chain[i]);
		const targetCard = cardMap.get(chain[i + 1]);
		if (sourceCard && targetCard) {
			addEdge({
				id: `chain-${sourceCard.id}-${targetCard.id}`,
				source: sourceCard.id,
				target: targetCard.id,
				type: 'informs',
			});
		}
	}

	// Add stored edges (user-created)
	for (const edge of storedEdges) {
		addEdge(edge);
	}

	return result;
}


/* ─── Dagre Auto-Layout ──────────────────────────────────── */

const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;

/**
 * Compute dagre-based auto-layout for nodes.
 * Dagre is an optional dependency. If not installed, falls back to column layout.
 */
export function computeDagreLayout(
	nodes: FlowNodeLayout[],
	edges: FlowEdgeData[],
): FlowNodeLayout[] {
	try {
		// Dynamic require — dagre is optional
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const dagre = require('@dagrejs/dagre');
		const graphlib = dagre.graphlib;

		if (!graphlib) throw new Error('dagre graphlib not available');

		const dagreGraph = new graphlib.Graph();
		dagreGraph.setDefaultEdgeLabel(() => ({}));
		dagreGraph.setGraph({
			rankdir: 'TB',
			nodesep: 80,
			ranksep: 120,
			align: 'UL',
		});

		for (const node of nodes) {
			dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
		}

		for (const edge of edges) {
			dagreGraph.setEdge(edge.source, edge.target);
		}

		graphlib.layout(dagreGraph);

		return nodes.map(node => {
			const dagreNode = dagreGraph.node(node.id);
			if (!dagreNode) return node;
			return {
				...node,
				position: {
					x: dagreNode.x - NODE_WIDTH / 2,
					y: dagreNode.y - NODE_HEIGHT / 2,
				},
			};
		});
	} catch (err) {
		console.warn('[boardLayout] Dagre not available, using column layout:', err);
		return nodes.map((n, i) => ({
			...n,
			position: { x: 100, y: 100 + i * 120 },
		}));
	}
}


/* ─── Column Layout (Reset) ──────────────────────────────── */

export function computeColumnLayout(
	cards: SandboxCard[],
	decisions: Array<{ id: string; type: string; description: string }>,
): FlowNodeLayout[] {
	const result: FlowNodeLayout[] = [];

	// Cards
	let cardIndex = 0;
	const cardMap = new Map<string, SandboxCard>();
	for (const card of cards) {
		cardMap.set(card.type, card);
	}

	for (const cardType of CARD_ORDER) {
		const card = cardMap.get(cardType);
		if (!card) continue;
		result.push({
			id: card.id,
			type: 'card',
			position: { x: CARD_ANCHOR_X, y: CARD_START_Y + cardIndex * CARD_SPACING_Y },
			size: 'medium',
		});
		cardIndex++;
	}

	// Decisions
	let decisionIndex = 0;
	for (const decision of decisions) {
		result.push({
			id: decision.id,
			type: 'decision',
			position: { x: DECISION_OFFSET_X, y: 100 + decisionIndex * DECISION_SPACING_Y },
			size: 'small',
		});
		decisionIndex++;
	}

	return result;
}