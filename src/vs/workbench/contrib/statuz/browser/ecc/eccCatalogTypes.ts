/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentSkillType } from '../agentManagement.types.js';

// ─── ECC Component Family ─────────────────────────────────────

export type EccComponentFamily = 'baseline' | 'language' | 'framework' | 'capability' | 'agent' | 'skill' | 'locale';

// ─── ECC Module Metadata ──────────────────────────────────────

export type EccModuleKind = 'rules' | 'agents' | 'commands' | 'hooks' | 'platform' | 'skills' | 'orchestration' | 'docs';

export type EccModuleCost = 'light' | 'medium' | 'heavy';

export type EccModuleStability = 'stable' | 'beta';

export interface EccInstallModule {
	id: string;
	kind: EccModuleKind;
	description: string;
	paths: string[];
	targets: string[];
	dependencies: string[];
	defaultInstall: boolean;
	cost: EccModuleCost;
	stability: EccModuleStability;
}

// ─── ECC Component Metadata ───────────────────────────────────

export interface EccInstallComponent {
	id: string;
	family: EccComponentFamily;
	description: string;
	modules: string[];
}

// ─── ECC Profile Metadata ─────────────────────────────────────

export interface EccInstallProfile {
	description: string;
	modules: string[];
}

// ─── ECC Component Local Metadata (from YAML frontmatter) ─────

export interface EccAgentFrontmatter {
	name: string;
	description: string;
	tools: string[];
	model: string;
}

export interface EccCommandFrontmatter {
	description: string;
	'argument-hint'?: string;
	'disable-model-invocation'?: boolean;
}

// ─── ECC Source Root ──────────────────────────────────────────

export interface EccSourceRoot {
	/** Absolute path to the ECC package root */
	path: string;
	/** Version string from VERSION file */
	version: string;
}

// ─── Catalog Component Metadata (display-ready) ────────────────

export interface EccComponentMeta {
	id: string;
	name: string;
	type: AgentSkillType;
	description: string;
	version: string;
	author: string;
	iconCodicon: string;
	category: string;
	tags: string[];
	sourceUrl?: string;
	installPath: string;
	dependencies?: string[];
	lastUpdated: number;
	fileSize: number;
}

// ─── ECC Catalog (top-level container) ────────────────────────

export interface EccCatalog {
	version: string;
	lastFetched: number;
	components: EccComponentMeta[];
	source: string;
}

// ─── Family-to-Type mapping ───────────────────────────────────

/**
 * Maps ECC component families to our internal AgentSkillType.
 * baseline components are infrastructure and not shown in the catalog.
 */
export function mapFamilyToType(family: EccComponentFamily): AgentSkillType | null {
	switch (family) {
		case 'agent':
			return 'agent';
		case 'skill':
			return 'skill';
		case 'language':
		case 'locale':
			return 'rule';
		case 'framework':
		case 'capability':
			return 'skill';
		case 'baseline':
			return null; // not shown in catalog
		default:
			return 'skill';
	}
}

/**
 * Maps ECC component family to a display category string.
 */
export function mapFamilyToCategory(family: EccComponentFamily): string {
	switch (family) {
		case 'agent': return 'Agent Engineering';
		case 'skill': return 'Development Foundations';
		case 'language': return 'Development Foundations';
		case 'framework': return 'Frontend & UI';
		case 'capability': return 'Operations';
		case 'locale': return 'Other';
		case 'baseline': return 'Other';
		default: return 'Other';
	}
}

/**
 * Maps ECC component family to a codicon class.
 */
export function mapFamilyToIcon(family: EccComponentFamily): string {
	switch (family) {
		case 'agent': return 'codicon-symbol-method';
		case 'skill': return 'codicon-wrench';
		case 'language': return 'codicon-code';
		case 'framework': return 'codicon-symbol-struct';
		case 'capability': return 'codicon-extensions';
		case 'locale': return 'codicon-globe';
		case 'baseline': return 'codicon-primitive-square';
		default: return 'codicon-package';
	}
}