/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/components/flow/board-icons.tsx
 *  Adapted: React JSX → plain SVG string templates
 *--------------------------------------------------------------------------------------------*/

/* ─── Card Icons ─────────────────────────────────────────── */

export const CARD_SVG_ICONS: Record<string, string> = {
	vision: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
		<path d="M8 2C4.5 2 1.5 5 1 8c.5 3 3.5 6 7 6s6.5-3 7-6c-.5-3-3.5-6-7-6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
	</svg>`,

	user: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
		<path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
	</svg>`,

	problem: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M8 2L2 14h12L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
		<line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
		<circle cx="8" cy="12.5" r="0.5" fill="currentColor"/>
	</svg>`,

	mvp: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.5"/>
		<circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
		<line x1="8" y1="3" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
	</svg>`,
};

export const DECISION_SVG_ICONS: Record<string, string> = {
	creation: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
		<line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
		<line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
	</svg>`,

	correction: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M2 10l3-8 4 6 3-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>`,

	pivot: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M10 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		<line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
	</svg>`,

	milestone: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
		<polygon points="7,2 13,7 7,12 1,7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
	</svg>`,

	// Default: generic decision
	default: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
		<line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
		<circle cx="7" cy="3" r="1" fill="currentColor"/>
	</svg>`,
};

/* ─── Constitution Icon ──────────────────────────────────── */

export const CONSTITUTION_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
	<path d="M3 2h10v12H3z" stroke="currentColor" stroke-width="1.5"/>
	<line x1="6" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
	<line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
	<line x1="6" y1="10" x2="9" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

/* ─── Placeholder Icon ───────────────────────────────────── */

export const PLACEHOLDER_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
	<line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
	<line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/* ─── Status Dot Colors ──────────────────────────────────── */

export const STATUS_COLORS: Record<string, string> = {
	Approved: '#10b981',
	Review: '#f59e0b',
	Draft: '#a8a29e',
	Rejected: '#ef4444',
	Pending: '#6b7280',
};

/* ─── Card Type Border Colors ────────────────────────────── */

export const CARD_TYPE_COLORS: Record<string, string> = {
	vision: '#8b5cf6',
	user: '#3b82f6',
	problem: '#f59e0b',
	mvp: '#10b981',
};

/* ─── Commitment Level Border Styles ─────────────────────── */

export const COMMITMENT_BORDER_STYLES: Record<string, string> = {
	exploring: '1.5,4',
	tentative: 'none',
	adopted: 'none',
	committed: 'none',
	rejected: '3,2',
	superseded: '2,2',
};

export const COMMITMENT_BORDER_WIDTHS: Record<string, number> = {
	exploring: 1.5,
	tentative: 1.5,
	adopted: 2,
	committed: 3,
	rejected: 1.5,
	superseded: 1.5,
};