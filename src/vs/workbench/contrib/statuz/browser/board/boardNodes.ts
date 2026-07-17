/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/components/flow/FlowBoardNodes.tsx
 *  Adapted: React JSX → native SVG <g> DOM elements
 *--------------------------------------------------------------------------------------------*/

import type { FlowNodeLayout, SandboxCard, Constitution } from './boardTypes.js';
import { CARD_SVG_ICONS, DECISION_SVG_ICONS, CONSTITUTION_ICON, STATUS_COLORS, CARD_TYPE_COLORS, COMMITMENT_BORDER_STYLES, COMMITMENT_BORDER_WIDTHS } from './boardIcons.js';

/* ─── Constants ──────────────────────────────────────────── */

const NODE_RADIUS = 8;

/* ─── SVG Utilities ──────────────────────────────────────── */

function createSVGElement<T extends SVGElement>(tag: string, attrs: Record<string, string> = {}): T {
	const el = document.createElementNS('http://www.w3.org/2000/svg', tag) as T;
	for (const [key, value] of Object.entries(attrs)) {
		el.setAttribute(key, value);
	}
	return el;
}

/* ─── Constitution Node ──────────────────────────────────── */

export function renderConstitutionNode(
	layout: FlowNodeLayout,
	constitution: Constitution,
	onDoubleClick?: () => void,
): SVGGElement {
	const g = createSVGElement<SVGGElement>('g', {
		'data-node-id': layout.id,
		'data-node-type': 'constitution',
		transform: `translate(${layout.position.x}, ${layout.position.y})`,
	});

	const width = 240;
	const height = 100;

	// Background
	const rect = createSVGElement<SVGRectElement>('rect', {
		class: 'board-node constitution',
		x: '0', y: '0',
		width: String(width), height: String(height),
		rx: String(NODE_RADIUS), ry: String(NODE_RADIUS),
	});
	g.appendChild(rect);

	// Icon
	const iconWrapper = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: '12', y: '12', width: '20', height: '20',
	});
	iconWrapper.innerHTML = CONSTITUTION_ICON;
	g.appendChild(iconWrapper);

	// Title
	const title = createSVGElement<SVGTextElement>('text', {
		x: '40', y: '26',
		class: 'board-node-title',
	});
	title.textContent = 'Constitution';
	g.appendChild(title);

	// Vision text (truncated)
	const visionText = constitution.vision || '(No vision set)';
	const truncated = visionText.length > 60 ? visionText.substring(0, 57) + '...' : visionText;

	const foreignObj = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: '12', y: '42', width: String(width - 24), height: String(height - 54),
	});
	const div = document.createElement('div');
	div.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground);line-height:1.4;' +
		'overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';
	div.textContent = truncated;
	foreignObj.appendChild(div);
	g.appendChild(foreignObj);

	if (onDoubleClick) {
		g.addEventListener('dblclick', onDoubleClick);
	}

	return g;
}


/* ─── Strategy Card Node ─────────────────────────────────── */

export function renderStrategyCardNode(
	layout: FlowNodeLayout,
	card: SandboxCard,
	highlighted: boolean = false,
	dimmed: boolean = false,
	isImporting: boolean = false,
	onDoubleClick?: () => void,
): SVGGElement {
	const g = createSVGElement<SVGGElement>('g', {
		'data-node-id': layout.id,
		'data-node-type': 'card',
		'data-card-type': card.type,
		transform: `translate(${layout.position.x}, ${layout.position.y})`,
	});

	const width = 220;
	const height = 90;
	const borderColor = CARD_TYPE_COLORS[card.type] || '#a8a29e';
	const statusColor = STATUS_COLORS[card.status] || '#a8a29e';
	const opacity = dimmed ? '0.3' : highlighted ? '1' : '0.9';

	// Border glow for highlighted
	if (highlighted) {
		const glow = createSVGElement<SVGRectElement>('rect', {
			x: '-3', y: '-3',
			width: String(width + 6), height: String(height + 6),
			rx: String(NODE_RADIUS + 3), ry: String(NODE_RADIUS + 3),
			fill: 'none', stroke: borderColor, 'stroke-width': '2',
			opacity: '0.5',
		});
		g.appendChild(glow);
	}

	// Background
	const rect = createSVGElement<SVGRectElement>('rect', {
		class: `board-node card ${isImporting ? 'importing' : ''}`,
		x: '0', y: '0',
		width: String(width), height: String(height),
		rx: String(NODE_RADIUS), ry: String(NODE_RADIUS),
		fill: 'var(--vscode-editor-background)',
		stroke: borderColor, 'stroke-width': '2',
		opacity,
	});
	g.appendChild(rect);

	// Status dot
	const dot = createSVGElement<SVGCircleElement>('circle', {
		cx: String(width - 14), cy: '14', r: '4',
		fill: statusColor,
	});
	g.appendChild(dot);

	// Icon
	const iconWrapper = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: '12', y: '12', width: '18', height: '18',
		color: borderColor,
	});
	iconWrapper.innerHTML = CARD_SVG_ICONS[card.type] || CARD_SVG_ICONS.vision;
	g.appendChild(iconWrapper);

	// Type label
	const typeLabel = createSVGElement<SVGTextElement>('text', {
		x: '36', y: '26',
		class: 'board-node-type-label',
		fill: borderColor,
	});
	typeLabel.textContent = card.type.toUpperCase();
	g.appendChild(typeLabel);

	// Content text
	const contentText = card.content || '(No content)';
	const truncated = contentText.length > 50 ? contentText.substring(0, 47) + '...' : contentText;

	const foreignObj = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: '12', y: '38', width: String(width - 24), height: String(height - 50),
	});
	const div = document.createElement('div');
	div.style.cssText = 'font-size:12px;color:var(--vscode-foreground);line-height:1.4;' +
		'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';
	div.textContent = truncated;
	foreignObj.appendChild(div);
	g.appendChild(foreignObj);

	// Status text
	const statusText = createSVGElement<SVGTextElement>('text', {
		x: String(width - 20), y: '28',
		class: 'board-node-status',
		fill: statusColor,
		'text-anchor': 'end',
	});
	statusText.textContent = card.status;
	g.appendChild(statusText);

	if (onDoubleClick) {
		g.addEventListener('dblclick', onDoubleClick);
	}

	return g;
}


/* ─── Decision Node ──────────────────────────────────────── */

interface DecisionData {
	id: string;
	type: string;
	description: string;
	commitment?: string;
	time?: string;
}

export function renderDecisionNode(
	layout: FlowNodeLayout,
	decision: DecisionData,
	highlighted: boolean = false,
	dimmed: boolean = false,
	onDoubleClick?: () => void,
): SVGGElement {
	const g = createSVGElement<SVGGElement>('g', {
		'data-node-id': layout.id,
		'data-node-type': 'decision',
		transform: `translate(${layout.position.x}, ${layout.position.y})`,
	});

	const width = 180;
	const height = 100;
	const opacity = dimmed ? '0.3' : '1';

	const commitment = decision.commitment || 'tentative';
	const dashArray = COMMITMENT_BORDER_STYLES[commitment] || 'none';
	const borderWidth = COMMITMENT_BORDER_WIDTHS[commitment] || 1.5;

	// Diamond shape polygon
	const cx = width / 2;
	const cy = height / 2;
	const hw = width / 2 - 10;
	const hh = height / 2 - 10;
	const points = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;

	const polygon = createSVGElement<SVGPolygonElement>('polygon', {
		class: 'board-node decision',
		points,
		fill: 'var(--vscode-editor-background)',
		stroke: 'var(--vscode-foreground)',
		'stroke-width': String(borderWidth),
		'stroke-dasharray': dashArray,
		opacity,
	});
	g.appendChild(polygon);

	if (highlighted) {
		const glow = createSVGElement<SVGPolygonElement>('polygon', {
			points,
			fill: 'none', stroke: 'var(--vscode-textLink-foreground)',
			'stroke-width': '3', opacity: '0.5',
		});
		g.appendChild(glow);
	}

	// Decision type icon
	const iconKey = decision.type || 'default';
	const iconSvg = DECISION_SVG_ICONS[iconKey] || DECISION_SVG_ICONS.default;
	const iconWrapper = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: String(cx - 8), y: String(cy - 20), width: '16', height: '16',
		color: 'var(--vscode-descriptionForeground)',
	});
	iconWrapper.innerHTML = iconSvg;
	g.appendChild(iconWrapper);

	// Description text
	const desc = decision.description || '';
	const truncated = desc.length > 40 ? desc.substring(0, 37) + '...' : desc;

	const foreignObj = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: String(cx - 60), y: String(cy + 4), width: '120', height: '36',
	});
	const div = document.createElement('div');
	div.style.cssText = 'font-size:11px;color:var(--vscode-foreground);text-align:center;line-height:1.3;' +
		'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';
	div.textContent = truncated;
	foreignObj.appendChild(div);
	g.appendChild(foreignObj);

	if (onDoubleClick) {
		g.addEventListener('dblclick', onDoubleClick);
	}

	return g;
}


/* ─── Placeholder Node ───────────────────────────────────── */

export function renderPlaceholderNode(
	layout: FlowNodeLayout,
	label: string = 'New Card',
	onClick?: () => void,
): SVGGElement {
	const g = createSVGElement<SVGGElement>('g', {
		'data-node-id': layout.id,
		'data-node-type': 'placeholder',
		transform: `translate(${layout.position.x}, ${layout.position.y})`,
	});

	const width = 220;
	const height = 70;

	// Dashed border
	const rect = createSVGElement<SVGRectElement>('rect', {
		class: 'board-node placeholder',
		x: '0', y: '0',
		width: String(width), height: String(height),
		rx: String(NODE_RADIUS), ry: String(NODE_RADIUS),
		fill: 'transparent',
		stroke: 'var(--vscode-descriptionForeground)',
		'stroke-width': '1.5',
		'stroke-dasharray': '6,3',
		opacity: '0.5',
	});
	g.appendChild(rect);

	// + icon
	const plusIcon = createSVGElement<SVGTextElement>('text', {
		x: String(width / 2), y: String(height / 2 - 2),
		'text-anchor': 'middle', 'dominant-baseline': 'central',
		fill: 'var(--vscode-descriptionForeground)',
		opacity: '0.5', 'font-size': '18',
	});
	plusIcon.textContent = '+';
	g.appendChild(plusIcon);

	// Label
	const labelText = createSVGElement<SVGTextElement>('text', {
		x: String(width / 2), y: String(height / 2 + 20),
		'text-anchor': 'middle',
		fill: 'var(--vscode-descriptionForeground)',
		opacity: '0.5', 'font-size': '11',
	});
	labelText.textContent = label;
	g.appendChild(labelText);

	if (onClick) {
		g.addEventListener('click', onClick);
		g.style.cursor = 'pointer';
	}

	return g;
}


/* ─── Connection Handle ──────────────────────────────────── */

// Connection handles are now rendered via boardEdges.renderConnectionHandles()