/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/dcr/relationship-mapper.ts
 *  No Supabase dependencies — kept as-is
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type {
	DecisionRegistryEntry,
	DecisionRelationship,
	DetectionSource,
	DriftFlagType,
	DriftSeverity,
	CommitmentLevel,
} from './dcrTypes.js';

/* ─── Detection Result ───────────────────────────────────── */

export interface RelationshipDetectionResult {
	sourceDecisionId: string;
	targetDecisionId: string;
	targetStatement: string;
	relationship: DecisionRelationship;
	rationale: string | null;
	detectedBy: DetectionSource;
	shouldFlag: boolean;
	driftFlagType?: DriftFlagType;
	driftSeverity?: DriftSeverity;
	driftDescription?: string;
}

/* ─── Exclusive Pairs ────────────────────────────────────── */

interface ExclusivePair {
	termA: string;
	termB: string;
	category: 'technology' | 'business' | 'design' | 'scope' | 'any';
	label: string;
}

const EXCLUSIVE_PAIRS: ExclusivePair[] = [
	// Technology
	{ termA: 'rust', termB: 'typescript', category: 'technology', label: 'Tech stack conflict: Rust vs TypeScript' },
	{ termA: 'rust', termB: 'javascript', category: 'technology', label: 'Tech stack conflict: Rust vs JavaScript' },
	{ termA: 'rust', termB: 'go', category: 'technology', label: 'Tech stack conflict: Rust vs Go' },
	{ termA: 'rust', termB: 'python', category: 'technology', label: 'Tech stack conflict: Rust vs Python' },
	{ termA: 'webgl', termB: 'canvas 2d', category: 'technology', label: 'Render tech conflict: WebGL vs Canvas 2D' },
	{ termA: 'webgl', termB: 'canvas2d', category: 'technology', label: 'Render tech conflict: WebGL vs Canvas 2D' },
	{ termA: 'webgl', termB: 'svg', category: 'technology', label: 'Render tech conflict: WebGL vs SVG' },
	{ termA: 'webgpu', termB: 'webgl', category: 'technology', label: 'Render tech conflict: WebGPU vs WebGL' },
	{ termA: 'monolith', termB: 'microservice', category: 'technology', label: 'Architecture conflict: Monolith vs Microservices' },
	{ termA: 'monolithic', termB: 'microservice', category: 'technology', label: 'Architecture conflict: Monolith vs Microservices' },
	{ termA: 'sql', termB: 'nosql', category: 'technology', label: 'Data storage conflict: SQL vs NoSQL' },
	{ termA: 'sql', termB: 'no-sql', category: 'technology', label: 'Data storage conflict: SQL vs NoSQL' },
	{ termA: 'sql', termB: 'mongodb', category: 'technology', label: 'Data storage conflict: Relational vs Document' },
	{ termA: 'postgresql', termB: 'mongodb', category: 'technology', label: 'Data storage conflict: PostgreSQL vs MongoDB' },
	{ termA: 'mysql', termB: 'postgresql', category: 'technology', label: 'Database conflict: MySQL vs PostgreSQL' },
	{ termA: 'react native', termB: 'flutter', category: 'technology', label: 'Cross-platform conflict: React Native vs Flutter' },
	{ termA: 'react native', termB: 'swift', category: 'technology', label: 'Mobile tech conflict: React Native vs Native Swift' },
	{ termA: 'firebase', termB: 'supabase', category: 'technology', label: 'Backend conflict: Firebase vs Supabase' },
	{ termA: 'rest', termB: 'graphql', category: 'technology', label: 'API style conflict: REST vs GraphQL' },
	{ termA: 'soap', termB: 'rest', category: 'technology', label: 'API style conflict: SOAP vs REST' },
	{ termA: 'grpc', termB: 'rest', category: 'technology', label: 'API style conflict: gRPC vs REST' },
	{ termA: 'server-side', termB: 'client-side', category: 'technology', label: 'Render location conflict: Server vs Client' },
	{ termA: 'server', termB: 'client-only', category: 'technology', label: 'Architecture conflict: Server vs Client-only' },
	{ termA: 'pwa', termB: 'native', category: 'technology', label: 'Architecture conflict: PWA vs Native' },
	{ termA: 'progressive web', termB: 'native', category: 'technology', label: 'Architecture conflict: PWA vs Native' },
	{ termA: 'virtual dom', termB: 'real dom', category: 'technology', label: 'Render strategy conflict: Virtual DOM vs Real DOM' },
	{ termA: 'reactive', termB: 'imperative', category: 'technology', label: 'Paradigm conflict: Reactive vs Imperative' },

	// Business
	{ termA: 'self-hosted', termB: 'cloud-only', category: 'business', label: 'Deployment conflict: Self-hosted vs Cloud-only' },
	{ termA: 'on-premise', termB: 'saas', category: 'business', label: 'Delivery conflict: On-premise vs SaaS' },
	{ termA: 'on-prem', termB: 'cloud', category: 'business', label: 'Deployment conflict: On-prem vs Cloud' },
	{ termA: 'free', termB: 'paid-only', category: 'business', label: 'Pricing conflict: Free vs Paid-only' },
	{ termA: 'freemium', termB: 'paid-only', category: 'business', label: 'Pricing conflict: Freemium vs Paid-only' },
	{ termA: 'subscription', termB: 'one-time', category: 'business', label: 'Pricing conflict: Subscription vs One-time' },
	{ termA: 'b2b', termB: 'b2c', category: 'business', label: 'Market conflict: B2B vs B2C' },
	{ termA: 'enterprise', termB: 'consumer', category: 'business', label: 'Target conflict: Enterprise vs Consumer' },

	// Design
	{ termA: 'minimalist', termB: 'feature-rich', category: 'design', label: 'Design philosophy conflict: Minimalist vs Feature-rich' },
	{ termA: 'simple', termB: 'powerful', category: 'design', label: 'Product philosophy conflict: Simple vs Powerful' },
	{ termA: 'lightweight', termB: 'comprehensive', category: 'design', label: 'Product positioning conflict: Lightweight vs Comprehensive' },
	{ termA: 'mobile-first', termB: 'desktop-first', category: 'design', label: 'Design strategy conflict: Mobile-first vs Desktop-first' },
	{ termA: 'dark mode', termB: 'light mode', category: 'design', label: 'Design language conflict: Dark vs Light mode' },
	{ termA: 'material design', termB: 'custom design', category: 'design', label: 'Design system conflict: Material vs Custom' },

	// Scope
	{ termA: 'desktop', termB: 'mobile', category: 'scope', label: 'Platform conflict: Desktop vs Mobile' },
	{ termA: 'desktop', termB: 'mobile-first', category: 'scope', label: 'Platform conflict: Desktop vs Mobile-first' },
	{ termA: 'ios', termB: 'android', category: 'scope', label: 'Platform conflict: iOS vs Android' },
	{ termA: 'mvp', termB: 'full-feature', category: 'scope', label: 'Scope conflict: MVP vs Full-feature' },
	{ termA: 'prototype', termB: 'production', category: 'scope', label: 'Delivery conflict: Prototype vs Production' },
	{ termA: 'quick', termB: 'comprehensive', category: 'scope', label: 'Delivery conflict: Quick vs Comprehensive' },
	{ termA: '2-week', termB: '6-month', category: 'scope', label: 'Timeline conflict: 2 weeks vs 6 months' },
	{ termA: 'lean', termB: 'enterprise-grade', category: 'scope', label: 'Delivery philosophy conflict: Lean vs Enterprise-grade' },

	// Chinese cross-language pairs
	{ termA: 'rust', termB: 'typescript', category: 'any', label: 'Tech stack conflict: Rust vs TypeScript' },
	{ termA: 'rust', termB: '脚本语言', category: 'any', label: 'Tech stack conflict: Rust vs scripting language' },
	{ termA: '微信', termB: '支付宝', category: 'scope', label: 'Platform conflict: WeChat vs Alipay' },
	{ termA: '小程序', termB: 'h5', category: 'scope', label: 'Tech conflict: Mini-program vs H5' },
	{ termA: '小程序', termB: 'web', category: 'scope', label: 'Tech conflict: Mini-program vs Web' },
	{ termA: 'ios', termB: '安卓', category: 'scope', label: 'Platform priority conflict: iOS vs Android' },
	{ termA: '苹果', termB: '安卓', category: 'scope', label: 'Platform priority conflict: Apple vs Android' },
	{ termA: '免费', termB: '收费', category: 'business', label: 'Pricing conflict: Free vs Paid' },
	{ termA: '订阅', termB: '买断', category: 'business', label: 'Pricing model conflict: Subscription vs One-time purchase' },
	{ termA: '自建', termB: '外包', category: 'business', label: 'Development strategy conflict: In-house vs Outsourced' },
	{ termA: '自研', termB: '采购', category: 'business', label: 'Tech strategy conflict: Self-developed vs Procured' },
	{ termA: '开源', termB: '闭源', category: 'business', label: 'Open-source strategy conflict: Open vs Closed' },
	{ termA: '简单', termB: '复杂', category: 'design', label: 'Design philosophy conflict: Simple vs Complex' },
	{ termA: '最小', termB: '全面', category: 'scope', label: 'Scope conflict: Minimal vs Comprehensive' },
];

/* ─── Thresholds ─────────────────────────────────────────── */

const MAX_SCOPE_DECISIONS = 3;
const SIGNIFICANT_LEVELS: CommitmentLevel[] = ['adopted', 'committed'];


/* ─── Rule Engine ────────────────────────────────────────── */

export class RelationshipMapper {

	/**
	 * Detect pairwise relationships between a new decision and existing ones.
	 */
	detectRelationships(
		newDecision: DecisionRegistryEntry,
		existingDecisions: DecisionRegistryEntry[],
	): RelationshipDetectionResult[] {
		const results: RelationshipDetectionResult[] = [];

		for (const existing of existingDecisions) {
			if (existing.id === newDecision.id) continue;

			const contradiction = this.detectContradiction(newDecision, existing);
			if (contradiction) results.push(contradiction);

			const alternative = this.detectAlternative(newDecision, existing);
			if (alternative) results.push(alternative);

			const reinforcement = this.detectReinforcement(newDecision, existing);
			if (reinforcement) results.push(reinforcement);
		}

		return results;
	}

	/**
	 * Detect project-level structural risks.
	 */
	detectProjectLevelRisks(
		newDecision: DecisionRegistryEntry | null,
		allDecisions: DecisionRegistryEntry[],
	): RelationshipDetectionResult[] {
		const results: RelationshipDetectionResult[] = [];
		const target = newDecision ?? allDecisions[allDecisions.length - 1];
		if (!target) return results;

		// PL-1: Scope creep
		const scopeRisk = this.detectScopeCreepRisk(target, allDecisions);
		if (scopeRisk) results.push(scopeRisk);

		// PL-2: Commitment divergence
		const divergenceRisk = this.detectCommitmentDivergence(allDecisions);
		if (divergenceRisk) results.push(divergenceRisk);

		return results;
	}

	/* ─── PL-1: Scope Creep ────────────────────────────────── */

	private detectScopeCreepRisk(
		newDecision: DecisionRegistryEntry,
		allDecisions: DecisionRegistryEntry[],
	): RelationshipDetectionResult | null {
		if (newDecision.category !== 'scope') return null;

		const existingScopeCount = allDecisions.filter(d =>
			d.id !== newDecision.id &&
			d.category === 'scope' &&
			SIGNIFICANT_LEVELS.includes(d.commitmentLevel),
		).length;

		if (existingScopeCount >= MAX_SCOPE_DECISIONS) {
			return {
				sourceDecisionId: newDecision.id,
				targetDecisionId: allDecisions.find(d =>
					d.category === 'scope' && d.id !== newDecision.id
				)?.id ?? newDecision.id,
				targetStatement: `Decision #${existingScopeCount + 1} in scope category`,
				relationship: 'conflicts-with',
				rationale: `Scope creep: ${existingScopeCount} adopted scope decisions already exist. ` +
					`Adding "${newDecision.statement}" may cause scope inflation.`,
				detectedBy: 'rule-based',
				shouldFlag: true,
				driftFlagType: 'scope-creep',
				driftSeverity: existingScopeCount >= MAX_SCOPE_DECISIONS + 1 ? 'critical' : 'warning',
				driftDescription: `Scope creep detected: ${existingScopeCount + 1} scope decisions ` +
					`(threshold: ${MAX_SCOPE_DECISIONS}). New: "${newDecision.statement}"`,
			};
		}

		return null;
	}

	/* ─── PL-2: Commitment Divergence ──────────────────────── */

	private detectCommitmentDivergence(
		allDecisions: DecisionRegistryEntry[],
	): RelationshipDetectionResult | null {
		const total = allDecisions.length;
		if (total < 5) return null;

		const exploring = allDecisions.filter(d => d.commitmentLevel === 'exploring').length;
		const exploringRatio = exploring / total;

		if (exploringRatio > 0.6) {
			const firstExploring = allDecisions.find(d => d.commitmentLevel === 'exploring');
			if (!firstExploring) return null;

			return {
				sourceDecisionId: firstExploring.id,
				targetDecisionId: firstExploring.id,
				targetStatement: firstExploring.statement,
				relationship: 'conflicts-with',
				rationale: `Commitment divergence: ${exploring}/${total} decisions are still "exploring" ` +
					`(${Math.round(exploringRatio * 100)}%). Too many uncommitted decisions block execution.`,
				detectedBy: 'rule-based',
				shouldFlag: true,
				driftFlagType: 'scope-creep',
				driftSeverity: exploringRatio > 0.8 ? 'critical' : 'warning',
				driftDescription: `${exploring}/${total} decisions still "exploring". ` +
					`Project has commitment divergence risk.`,
			};
		}

		return null;
	}

	/* ─── Rule 1: Contradiction Detection ──────────────────── */

	private detectContradiction(
		a: DecisionRegistryEntry,
		b: DecisionRegistryEntry,
	): RelationshipDetectionResult | null {
		if (!SIGNIFICANT_LEVELS.includes(a.commitmentLevel) && !SIGNIFICANT_LEVELS.includes(b.commitmentLevel)) {
			return null;
		}

		const lowerA = a.statement.toLowerCase();
		const lowerB = b.statement.toLowerCase();

		for (const pair of EXCLUSIVE_PAIRS) {
			if (pair.category !== 'any' && pair.category !== a.category) continue;
			if (pair.category !== 'any' && pair.category !== b.category) continue;

			const aHasA = lowerA.includes(pair.termA);
			const bHasB = lowerB.includes(pair.termB);
			const aHasB = lowerA.includes(pair.termB);
			const bHasA = lowerB.includes(pair.termA);

			if ((aHasA && bHasB) || (aHasB && bHasA)) {
				return {
					sourceDecisionId: a.id,
					targetDecisionId: b.id,
					targetStatement: b.statement,
					relationship: 'conflicts-with',
					rationale: `${pair.label}: "${a.statement}" vs "${b.statement}"`,
					detectedBy: 'rule-based',
					shouldFlag: a.commitmentLevel === 'committed' || b.commitmentLevel === 'committed',
					driftFlagType: 'direct-conflict',
					driftSeverity: a.commitmentLevel === 'committed' && b.commitmentLevel === 'committed'
						? 'critical'
						: 'warning',
					driftDescription: `Decision "${a.statement}" directly conflicts with "${b.statement}" — ${pair.label}`,
				};
			}
		}

		return null;
	}

	/* ─── Rule 2: Alternative Detection ────────────────────── */

	private detectAlternative(
		a: DecisionRegistryEntry,
		b: DecisionRegistryEntry,
	): RelationshipDetectionResult | null {
		if (a.issue && b.issue && a.issue === b.issue) {
			if (a.statement !== b.statement) {
				return {
					sourceDecisionId: b.id,
					targetDecisionId: a.id,
					targetStatement: a.statement,
					relationship: 'alternative',
					rationale: `Both answer the same question: "${a.issue}"`,
					detectedBy: 'rule-based',
					shouldFlag: false,
				};
			}
		}

		return null;
	}

	/* ─── Rule 3: Reinforcement Detection ──────────────────── */

	private detectReinforcement(
		a: DecisionRegistryEntry,
		b: DecisionRegistryEntry,
	): RelationshipDetectionResult | null {
		if (a.category !== b.category) return null;
		if (!SIGNIFICANT_LEVELS.includes(a.commitmentLevel) || !SIGNIFICANT_LEVELS.includes(b.commitmentLevel)) {
			return null;
		}

		const wordsA = new Set(this.extractSignificantWords(a.statement));
		const wordsB = this.extractSignificantWords(b.statement);
		const overlap = wordsB.filter(w => wordsA.has(w));

		if (overlap.length >= 2) {
			return {
				sourceDecisionId: b.id,
				targetDecisionId: a.id,
				targetStatement: a.statement,
				relationship: 'reinforces',
				rationale: `Shared ${overlap.length} key concepts: ${overlap.join(', ')}`,
				detectedBy: 'rule-based',
				shouldFlag: false,
			};
		}

		return null;
	}


	/* ─── Helpers ──────────────────────────────────────────── */

	private extractSignificantWords(text: string): string[] {
		const enWords = this.extractEnglishWords(text);
		const cnTokens = this.extractChineseBigrams(text);
		const combined = [...enWords, ...cnTokens];
		const stopWords = this.getStopWords();
		return combined.filter(w => w.length > 2 && !stopWords.has(w));
	}

	private extractEnglishWords(text: string): string[] {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, ' ')
			.split(/\s+/)
			.filter(w => w.length > 0);
	}

	private extractChineseBigrams(text: string): string[] {
		const chars = text.replace(/[^\u4e00-\u9fff]/g, '');
		if (chars.length < 2) return [];
		if (chars.length === 2) return [chars];

		const bigrams: string[] = [];
		for (let i = 0; i < chars.length - 1; i++) {
			bigrams.push(chars.substring(i, i + 2));
		}
		return bigrams;
	}

	private getStopWords(): Set<string> {
		return new Set([
			'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
			'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
			'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
			'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'not',
			'no', 'nor', 'so', 'if', 'then', 'else', 'than', 'that', 'this',
			'these', 'those', 'it', 'its', 'we', 'our', 'us', 'you', 'your',
			'i', 'me', 'my', 'they', 'them', 'their', 'he', 'she', 'him', 'her',
			'use', 'using', 'used', 'make', 'need', 'want', 'build', 'create',
			'get', 'set', 'put', 'take', 'go', 'come', 'work', 'like', 'just',
			'also', 'very', 'really',
			'支持', '使用', '需要', '实现', '提供', '可以', '能够', '应该',
			'必须', '可能', '不会', '不要', '这个', '那个', '什么', '怎么',
			'一个', '一些', '一种', '进行', '通过', '基于', '采用', '用于',
			'以及', '或者', '并且', '但是', '因为', '所以', '如果', '虽然',
			'没有', '就是', '不是', '而且', '还有', '其中', '之后',
		]);
	}
}