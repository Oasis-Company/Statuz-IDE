/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IAgentSkillItem } from '../agentManagement.types.js';
import { AGENT_SVG_ICONS, AGENT_TYPE_COLORS, AGENT_TYPE_LABELS, STATUS_DOT_COLORS } from './agentCanvasIcons.js';

// ─── Node Dimensions ─────────────────────────────────────────

export const AGENT_NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
	agent: { width: 220, height: 110 },
	skill: { width: 200, height: 100 },
	command: { width: 180, height: 90 },
	rule: { width: 180, height: 80 },
};

export function getNodeDimensions(type: string): { width: number; height: number } {
	return AGENT_NODE_DIMENSIONS[type] || AGENT_NODE_DIMENSIONS.skill;
}

// ─── Node Layout ─────────────────────────────────────────────

export interface AgentNodeLayout {
	id: string;
	type: string;
	position: { x: number; y: number };
}

// ─── SVG Helper ──────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSVGElement<T extends SVGElement>(tag: string, attrs: Record<string, string | number | boolean> = {}): T {
	const el = document.createElementNS(SVG_NS, tag) as T;
	for (const [key, value] of Object.entries(attrs)) {
		el.setAttribute(key, String(value));
	}
	return el;
}

// ─── Short text truncation helper ────────────────────────────

function truncate(text: string, maxLen: number): string {
	return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

// ─── Render Agent Node ───────────────────────────────────────

export interface AgentNodeCallbacks {
	onInstall?: (id: string) => void;
	onUninstall?: (id: string) => void;
	onDoubleClick?: (id: string) => void;
	onActionClick?: (id: string, action: string) => void;
}

export function renderAgentNode(
	layout: AgentNodeLayout,
	item: IAgentSkillItem,
	dimmed: boolean,
	selected: boolean,
	highlighted: boolean,
	callbacks?: AgentNodeCallbacks,
): SVGGElement {
	const dims = getNodeDimensions(layout.type);
	const w = dims.width;
	const h = dims.height;
	const typeColor = AGENT_TYPE_COLORS[layout.type] || '#9e9e9e';
	const typeLabel = AGENT_TYPE_LABELS[layout.type] || 'ITEM';
	const statusColor = STATUS_DOT_COLORS[item.state] || STATUS_DOT_COLORS.disabled;
	const iconSvg = AGENT_SVG_ICONS[layout.type] || AGENT_SVG_ICONS.skill;
	const isInstalled = item.state === 'enabled' || item.state === 'error';

	// Root group
	const g = createSVGElement<SVGGElement>('g', {
		'data-node-id': layout.id,
		'data-node-type': layout.type,
		transform: `translate(${layout.position.x}, ${layout.position.y})`,
		class: 'agent-canvas-node',
	});
	if (dimmed) {
		g.setAttribute('opacity', '0.35');
	}

	// ── Background ──
	const bg = createSVGElement<SVGRectElement>('rect', {
		x: 0, y: 0, width: w, height: h,
		rx: 8, ry: 8,
		class: 'agent-node-bg',
	});
	if (selected) {
		bg.classList.add('selected');
	}
	g.appendChild(bg);

	// ── Type color bar (left side) ──
	// Clip the bottom-left corner
	const barClip = createSVGElement<SVGRectElement>('rect', {
		x: 0, y: 0, width: 4, height: h - 8,
		rx: 0, ry: 0,
		fill: typeColor,
	});
	g.appendChild(barClip);

	// ── Icon (foreignObject) ──
	const iconFo = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: 12, y: 10, width: 20, height: 20,
	});
	const iconDiv = document.createElement('div');
	iconDiv.innerHTML = iconSvg;
	iconDiv.style.cssText = 'width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:' + typeColor;
	iconFo.appendChild(iconDiv);
	g.appendChild(iconFo);

	// ── Name ──
	const nameEl = createSVGElement<SVGTextElement>('text', {
		x: 38, y: 24, class: 'agent-node-name',
	});
	nameEl.textContent = truncate(item.name, 24);
	g.appendChild(nameEl);

	// ── Type label ──
	const typeEl = createSVGElement<SVGTextElement>('text', {
		x: 38, y: 36, class: 'agent-node-type-label',
	});
	typeEl.textContent = `${typeLabel} v${item.version || '?'}`;
	g.appendChild(typeEl);

	// ── Description (foreignObject) ──
	const descY = 44;
	const descH = 36;
	const descFo = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: 12, y: descY, width: w - 24, height: descH,
	});
	const descDiv = document.createElement('div');
	descDiv.className = 'agent-node-desc';
	descDiv.textContent = item.description || '';
	descFo.appendChild(descDiv);
	g.appendChild(descFo);

	// ── Footer bar ──
	const footerY = h - 16;
	const footer = createSVGElement<SVGRectElement>('rect', {
		x: 0, y: footerY, width: w, height: 16,
		class: 'agent-node-footer',
	});
	g.appendChild(footer);

	// ── Status dot ──
	const dot = createSVGElement<SVGCircleElement>('circle', {
		cx: 16, cy: footerY + 8, r: 4,
		fill: statusColor,
		class: 'agent-node-status-dot',
	});
	if (item.state === 'installing') {
		dot.classList.add('installing');
	}
	g.appendChild(dot);

	// ── Status text ──
	const statusText = createSVGElement<SVGTextElement>('text', {
		x: 24, y: footerY + 12, class: 'agent-node-status-text',
	});
	const stateLabel: Record<string, string> = {
		enabled: 'Enabled',
		disabled: 'Disabled',
		error: 'Error',
		installing: 'Installing…',
	};
	statusText.textContent = stateLabel[item.state] || item.state;
	g.appendChild(statusText);

	// ── Action button (foreignObject) ──
	const btnW = 52;
	const btnH = 22;
	const btnX = w - btnW - 10;
	const btnY = 5;
	const btnFo = createSVGElement<SVGForeignObjectElement>('foreignObject', {
		x: btnX, y: btnY, width: btnW, height: btnH,
	});
	const btn = document.createElement('button');
	btn.className = 'agent-node-action-btn';
	btn.dataset.nodeId = layout.id;
	if (isInstalled) {
		btn.textContent = 'Uninstall';
		btn.classList.add('danger');
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks?.onUninstall?.(layout.id);
		});
	} else {
		btn.textContent = 'Install';
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks?.onInstall?.(layout.id);
		});
	}
	btnFo.appendChild(btn);
	g.appendChild(btnFo);

	// ── Connection handles (4 ports) ──
	const handleR = 5;
	// Top
	const hTop = createSVGElement<SVGCircleElement>('circle', {
		cx: w / 2, cy: 0, r: handleR,
		class: 'agent-connection-handle',
		'data-port': 'top', 'data-node-id': layout.id,
		fill: typeColor, stroke: 'var(--vscode-editor-background)', 'stroke-width': 2,
	});
	// Bottom
	const hBottom = createSVGElement<SVGCircleElement>('circle', {
		cx: w / 2, cy: h, r: handleR,
		class: 'agent-connection-handle',
		'data-port': 'bottom', 'data-node-id': layout.id,
		fill: typeColor, stroke: 'var(--vscode-editor-background)', 'stroke-width': 2,
	});
	// Left
	const hLeft = createSVGElement<SVGCircleElement>('circle', {
		cx: 0, cy: h / 2, r: handleR,
		class: 'agent-connection-handle',
		'data-port': 'left', 'data-node-id': layout.id,
		fill: typeColor, stroke: 'var(--vscode-editor-background)', 'stroke-width': 2,
	});
	// Right
	const hRight = createSVGElement<SVGCircleElement>('circle', {
		cx: w, cy: h / 2, r: handleR,
		class: 'agent-connection-handle',
		'data-port': 'right', 'data-node-id': layout.id,
		fill: typeColor, stroke: 'var(--vscode-editor-background)', 'stroke-width': 2,
	});

	g.appendChild(hTop);
	g.appendChild(hBottom);
	g.appendChild(hLeft);
	g.appendChild(hRight);

	return g;
}