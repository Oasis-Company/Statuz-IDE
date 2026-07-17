/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/* ─── Agent Type SVG Icons ────────────────────────────────── */

export const AGENT_SVG_ICONS: Record<string, string> = {
	agent: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
		<path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
		<circle cx="8" cy="8" r="1" fill="currentColor" opacity="0.3"/>
	</svg>`,

	skill: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<polygon points="8,2 12,6 10,12 6,12 4,6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
		<circle cx="8" cy="7" r="1.5" fill="currentColor"/>
		<line x1="8" y1="8.5" x2="8" y2="11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
	</svg>`,

	command: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
		<line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
		<line x1="5" y1="9" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
		<circle cx="11" cy="9" r="1" fill="currentColor"/>
	</svg>`,

	rule: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M3 2h8l3 3v9H3V2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
		<path d="M11 2v3h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
		<line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
		<line x1="5" y1="9" x2="10" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
		<line x1="5" y1="11" x2="8" y2="11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
	</svg>`,
};

/* ─── Agent Type Colors ───────────────────────────────────── */

export const AGENT_TYPE_COLORS: Record<string, string> = {
	agent: '#4fc3f7',
	skill: '#81c784',
	command: '#ffb74d',
	rule: '#ce93d8',
};

/* ─── Agent Type Labels ───────────────────────────────────── */

export const AGENT_TYPE_LABELS: Record<string, string> = {
	agent: 'AGENT',
	skill: 'SKILL',
	command: 'CMD',
	rule: 'RULE',
};

/* ─── Status Dot Colors ───────────────────────────────────── */

export const STATUS_DOT_COLORS: Record<string, string> = {
	enabled: '#4caf50',
	disabled: '#9e9e9e',
	error: '#f44336',
	installing: '#ff9800',
};