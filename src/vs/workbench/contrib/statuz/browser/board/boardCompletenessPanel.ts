/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Strategic completeness panel — visual score + breakdown
 *--------------------------------------------------------------------------------------------*/

import type { SandboxCard, Constitution } from './boardTypes.js';
import { calculateCompleteness } from './boardCompleteness.js';
import type { CompletenessResult } from './boardCompleteness.js';

/* ─── Types ──────────────────────────────────────────────── */

export interface CompletenessPanelCallbacks {
	onCreateCard?: (type: string) => void;
	onEditConstitution?: () => void;
}

/* ─── Panel ──────────────────────────────────────────────── */

export class BoardCompletenessPanel {
	private container: HTMLElement;
	private parent: HTMLElement;
	private callbacks: CompletenessPanelCallbacks;
	private isCollapsed = false;

	constructor(
		parent: HTMLElement,
		callbacks: CompletenessPanelCallbacks = {},
	) {
		this.parent = parent;
		this.callbacks = callbacks;

		this.container = this.build();
		parent.appendChild(this.container);
	}

	/* ─── Build ─────────────────────────────────────────────── */

	private build(): HTMLElement {
		const panel = document.createElement('div');
		panel.className = 'board-completion-panel';

		// Header
		const header = document.createElement('div');
		header.className = 'board-completion-header';
		header.addEventListener('click', () => this.toggle());

		const title = document.createElement('span');
		title.className = 'board-completion-title';
		title.textContent = 'Strategic Completeness';

		const toggle = document.createElement('span');
		toggle.className = 'board-completion-toggle codicon codicon-chevron-down';
		toggle.id = 'board-completion-toggle';

		header.appendChild(title);
		header.appendChild(toggle);
		panel.appendChild(header);

		// Body
		const body = document.createElement('div');
		body.className = 'board-completion-body';
		body.id = 'board-completion-body';
		panel.appendChild(body);

		return panel;
	}

	/* ─── Update ────────────────────────────────────────────── */

	update(cards: SandboxCard[], constitution: Constitution | null): void {
		const result = calculateCompleteness(cards, constitution);
		const body = this.container.querySelector('#board-completion-body');
		if (!body) return;

		body.innerHTML = '';

		// Score ring
		body.appendChild(this.buildScoreRing(result.score));

		// Card breakdown
		body.appendChild(this.buildCardBreakdown(result));

		// Constitution section
		body.appendChild(this.buildConstitutionSection(result));

		// Missing items
		if (result.missingItems.length > 0) {
			body.appendChild(this.buildMissingItems(result));
		}
	}

	/* ─── Score Ring ────────────────────────────────────────── */

	private buildScoreRing(score: number): HTMLElement {
		const container = document.createElement('div');
		container.className = 'board-completion-score';

		// Simple SVG ring
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 80 80');
		svg.setAttribute('width', '80');
		svg.setAttribute('height', '80');

		const radius = 32;
		const circumference = 2 * Math.PI * radius;
		const progress = score / 100;
		const strokeDashoffset = circumference * (1 - progress);

		// Background circle
		const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		bgCircle.setAttribute('cx', '40');
		bgCircle.setAttribute('cy', '40');
		bgCircle.setAttribute('r', String(radius));
		bgCircle.setAttribute('fill', 'none');
		bgCircle.setAttribute('stroke', 'var(--vscode-input-border)');
		bgCircle.setAttribute('stroke-width', '6');
		svg.appendChild(bgCircle);

		// Progress circle
		const progressColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
		const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		progressCircle.setAttribute('cx', '40');
		progressCircle.setAttribute('cy', '40');
		progressCircle.setAttribute('r', String(radius));
		progressCircle.setAttribute('fill', 'none');
		progressCircle.setAttribute('stroke', progressColor);
		progressCircle.setAttribute('stroke-width', '6');
		progressCircle.setAttribute('stroke-linecap', 'round');
		progressCircle.setAttribute('stroke-dasharray', String(circumference));
		progressCircle.setAttribute('stroke-dashoffset', String(strokeDashoffset));
		progressCircle.setAttribute('transform', 'rotate(-90 40 40)');
		svg.appendChild(progressCircle);

		// Score text
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text.setAttribute('x', '40');
		text.setAttribute('y', '40');
		text.setAttribute('text-anchor', 'middle');
		text.setAttribute('dominant-baseline', 'central');
		text.setAttribute('fill', 'var(--vscode-foreground)');
		text.setAttribute('font-size', '18');
		text.setAttribute('font-weight', '600');
		text.textContent = String(score);
		svg.appendChild(text);

		const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		label.setAttribute('x', '40');
		label.setAttribute('y', '56');
		label.setAttribute('text-anchor', 'middle');
		label.setAttribute('fill', 'var(--vscode-descriptionForeground)');
		label.setAttribute('font-size', '9');
		label.textContent = '/ 100';
		svg.appendChild(label);

		container.appendChild(svg);
		return container;
	}

	/* ─── Card Breakdown ────────────────────────────────────── */

	private buildCardBreakdown(result: CompletenessResult): HTMLElement {
		const section = document.createElement('div');
		section.className = 'board-completion-section';

		const title = document.createElement('div');
		title.className = 'board-completion-section-title';
		title.textContent = 'Core Cards';
		section.appendChild(title);

		for (const card of result.breakdown.cards) {
			const row = document.createElement('div');
			row.className = 'board-completion-row';

			const statusDot = document.createElement('span');
			statusDot.className = 'board-completion-dot';
			statusDot.style.backgroundColor = card.exists
				? card.status === 'approved' ? '#10b981' : '#f59e0b'
				: '#ef4444';
			row.appendChild(statusDot);

			const label = document.createElement('span');
			label.className = 'board-completion-row-label';
			label.textContent = card.label;
			row.appendChild(label);

			const status = document.createElement('span');
			status.className = 'board-completion-row-status';
			status.textContent = card.exists ? card.status : 'Missing';
			row.appendChild(status);

			section.appendChild(row);

			if (!card.exists) {
				const createBtn = document.createElement('button');
				createBtn.className = 'board-completion-create-btn';
				createBtn.textContent = `+ Create ${card.label}`;
				createBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.callbacks.onCreateCard?.(card.type);
				});
				section.appendChild(createBtn);
			}
		}

		return section;
	}

	/* ─── Constitution Section ──────────────────────────────── */

	private buildConstitutionSection(result: CompletenessResult): HTMLElement {
		const section = document.createElement('div');
		section.className = 'board-completion-section';

		const title = document.createElement('div');
		title.className = 'board-completion-section-title';
		title.textContent = 'Constitution';
		section.appendChild(title);

		const c = result.breakdown.constitution;

		const items: Array<{ label: string; value: string }> = [
			{ label: 'Vision', value: c.vision ? 'Defined' : 'Missing' },
			{ label: 'Principles', value: `${c.principles} defined` },
			{ label: 'Constraints', value: `${c.constraints} defined` },
			{ label: 'Metrics', value: `${c.metrics} defined` },
		];

		for (const item of items) {
			const row = document.createElement('div');
			row.className = 'board-completion-row';

			const dot = document.createElement('span');
			dot.className = 'board-completion-dot';
			dot.style.backgroundColor = item.value === 'Missing' ? '#ef4444' : '#a8a29e';
			row.appendChild(dot);

			const label = document.createElement('span');
			label.className = 'board-completion-row-label';
			label.textContent = item.label;
			row.appendChild(label);

			const value = document.createElement('span');
			value.className = 'board-completion-row-value';
			value.textContent = item.value;
			row.appendChild(value);

			section.appendChild(row);
		}

		return section;
	}

	/* ─── Missing Items ─────────────────────────────────────── */

	private buildMissingItems(result: CompletenessResult): HTMLElement {
		const section = document.createElement('div');
		section.className = 'board-completion-section';

		const title = document.createElement('div');
		title.className = 'board-completion-section-title';
		title.textContent = 'Missing Items';
		section.appendChild(title);

		for (const item of result.missingItems) {
			const row = document.createElement('div');
			row.className = 'board-completion-missing-item';

			const icon = document.createElement('span');
			icon.className = 'codicon codicon-warning';
			icon.style.color = '#f59e0b';
			icon.style.marginRight = '6px';
			row.appendChild(icon);

			const text = document.createElement('span');
			text.textContent = item.reason;
			row.appendChild(text);

			section.appendChild(row);
		}

		return section;
	}

	/* ─── Toggle ────────────────────────────────────────────── */

	private toggle(): void {
		this.isCollapsed = !this.isCollapsed;
		const body = this.container.querySelector('#board-completion-body') as HTMLElement;
		const toggle = this.container.querySelector('#board-completion-toggle') as HTMLElement;

		if (body) {
			body.style.display = this.isCollapsed ? 'none' : 'block';
		}
		if (toggle) {
			toggle.className = `board-completion-toggle codicon codicon-chevron-${this.isCollapsed ? 'right' : 'down'}`;
		}
	}

	destroy(): void {
		if (this.parent.contains(this.container)) {
			this.parent.removeChild(this.container);
		}
	}
}