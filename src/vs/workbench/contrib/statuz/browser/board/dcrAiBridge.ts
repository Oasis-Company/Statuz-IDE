/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/dcr/ai-bridge.ts
 *  Adapted: AI provider dependency removed; generic config interface
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type {
	DecisionRegistryEntry,
	DecisionCategory,
	RegisterDecisionInput,
} from './dcrTypes.js';
import type { RelationshipDetectionResult } from './dcrRelationshipMapper.js';

/* ─── AI Provider Config ─────────────────────────────────── */

export interface AIProviderConfig {
	provider: string;
	apiKey: string;
	model: string;
	customBaseUrl?: string;
}

/* ─── AI Detection Output ────────────────────────────────── */

interface AIRelationship {
	sourceIndex: number;
	targetIndex: number;
	relationship: 'depends-on' | 'conflicts-with';
	rationale: string;
	driftSeverity?: 'info' | 'warning' | 'critical';
}

interface AIRelationshipOutput {
	relationships: AIRelationship[];
	newDecisions: Array<{
		statement: string;
		reason: string;
	}>;
}

/* ─── System Prompt ──────────────────────────────────────── */

const AI_DETECTION_SYSTEM_PROMPT = `You are a product strategy analyst. Given a list of decisions made about a project, identify:

1. RELATIONSHIPS between decisions that may be in tension or dependency.
   Return as JSON array with: sourceIndex, targetIndex, relationship ("depends-on"|"conflicts-with"), rationale, driftSeverity ("info"|"warning"|"critical").

2. IMPLICIT DECISIONS that the user hasn't explicitly stated but are implied by their choices.
   Return as JSON array with: statement, reason.

Focus on tensions the rule engine would MISS:
- Cross-category tension (e.g. "use Rust" + "ship in 2 weeks")
- Implicit dependencies (e.g. "WebGL" depends on "browser support")
- Resource constraints (e.g. two features competing for same engineering time)
- Hidden assumptions (e.g. "mobile-first" + "desktop app" assumes different teams)

Rules:
- Only flag real tensions, not every difference
- severity="critical" only when two decisions are truly incompatible
- severity="warning" when there is significant tension but workable
- severity="info" for minor concerns
- If no tensions found, return empty array
- Output valid JSON only, no markdown`;


/* ─── AI Bridge Service ──────────────────────────────────── */

/**
 * AI-assisted relationship detector.
 *
 * Called when the rule engine can't determine relationships:
 *   1. Cross-category semantic conflicts
 *   2. Complex dependency chains
 *   3. Implicit assumption conflicts
 *
 * This is an optional enhancement — AI unavailability does not block registration.
 */
export class AIRelationshipDetector {
	private config: AIProviderConfig | null;

	constructor(config?: AIProviderConfig | null) {
		this.config = config ?? null;
	}

	get isAvailable(): boolean {
		return this.config !== null && !!this.config.apiKey;
	}

	/**
	 * Use AI to detect relationships the rule engine missed.
	 * Falls back to empty array if AI is unavailable.
	 */
	async detectRelationships(
		newDecision: DecisionRegistryEntry,
		allDecisions: DecisionRegistryEntry[],
		generateFn?: (prompt: {
			messages: Array<{ role: string; content: string }>;
			temperature: number;
			maxTokens: number;
		}) => Promise<{ success: boolean; data?: unknown }>,
	): Promise<RelationshipDetectionResult[]> {
		if (!this.isAvailable || !this.config) return [];

		if (!generateFn) {
			console.warn('[AIRelationshipDetector] No AI generate function provided — skipping');
			return [];
		}

		try {
			const decisionsText = allDecisions.map((d, i) =>
				`[${i}] ${d.statement} (category: ${d.category}, commitment: ${d.commitmentLevel})`,
			).join('\n');

			const userMessage =
				`Current decisions:\n${decisionsText}\n\n` +
				`New decision: "${newDecision.statement}" (category: ${newDecision.category}, commitment: ${newDecision.commitmentLevel})\n\n` +
				`Analyze relationships between the new decision and existing ones. Return JSON.`;

			const response = await generateFn({
				messages: [
					{ role: 'system', content: AI_DETECTION_SYSTEM_PROMPT },
					{ role: 'user', content: userMessage },
				],
				temperature: 0.2,
				maxTokens: 1024,
			});

			if (!response.success || !response.data) return [];

			const parsed = this.parseResponse(response.data);
			if (!parsed) return [];

			const results: RelationshipDetectionResult[] = [];

			for (const rel of parsed.relationships) {
				const source = allDecisions[rel.sourceIndex];
				const target = allDecisions[rel.targetIndex];
				if (!source || !target) continue;

				results.push({
					sourceDecisionId: source.id,
					targetDecisionId: target.id,
					targetStatement: target.statement,
					relationship: rel.relationship,
					rationale: `[AI-detected] ${rel.rationale}`,
					detectedBy: 'ai-detected',
					shouldFlag: rel.relationship === 'conflicts-with',
					driftFlagType: rel.relationship === 'conflicts-with' ? 'direct-conflict' : undefined,
					driftSeverity: rel.driftSeverity ?? 'info',
					driftDescription: rel.relationship === 'conflicts-with'
						? `AI detected conflict: "${source.statement}" vs "${target.statement}" — ${rel.rationale}`
						: undefined,
				});
			}

			return results;

		} catch (err) {
			console.warn('[AIRelationshipDetector] AI detection failed (non-blocking):', err);
			return [];
		}
	}

	/**
	 * Parse AI response — handles JSON strings and markdown-wrapped JSON.
	 */
	private parseResponse(data: unknown): AIRelationshipOutput | null {
		if (!data) return null;

		// Already an object
		if (typeof data === 'object' && !Array.isArray(data)) {
			const obj = data as Record<string, unknown>;
			if (Array.isArray(obj.relationships) || Array.isArray(obj.newDecisions)) {
				return {
					relationships: (obj.relationships ?? []) as AIRelationship[],
					newDecisions: (obj.newDecisions ?? []) as AIRelationshipOutput['newDecisions'],
				};
			}
		}

		// String — try JSON.parse
		if (typeof data === 'string') {
			try {
				const jsonMatch = data.match(/```(?:json)?\s*([\s\S]*?)```/);
				const jsonStr = jsonMatch ? jsonMatch[1] : data;
				const parsed = JSON.parse(jsonStr);
				return this.parseResponse(parsed);
			} catch {
				return null;
			}
		}

		return null;
	}
}


/* ─── Decision Extraction Helper ─────────────────────────── */

export interface ExtractedDecision {
	type: string;
	description: string;
	confidence: number;
	sourceQuote: string;
}

export interface ExtractedTension {
	quoteA: string;
	quoteB: string;
	description: string;
	confidence: number;
}

export interface ConversationAnalysisOutput {
	decisions: ExtractedDecision[];
	tensions: ExtractedTension[];
}

/**
 * Convert conversation-extracted decisions into DCR registration inputs.
 */
export function extractDecisionsFromConversation(
	analysis: ConversationAnalysisOutput,
	projectId: string,
	relatedCardIds?: string[],
): RegisterDecisionInput[] {
	return analysis.decisions
		.filter(d => d.confidence >= 0.5)
		.map(d => ({
			projectId,
			statement: d.description,
			category: categorizeConversationDecision(d),
			commitmentLevel: 'tentative' as const,
			source: 'skill' as const,
			rationale: `Extracted from conversation: ${d.sourceQuote}`,
			relatedCardIds,
		}));
}

function categorizeConversationDecision(d: {
	type: string;
	description: string;
}): DecisionCategory {
	const desc = d.description.toLowerCase();
	if (
		desc.includes('技术') || desc.includes('语言') || desc.includes('框架') ||
		desc.includes('架构') || desc.includes('数据库') || desc.includes('api')
	) {
		return 'technology';
	}
	if (
		desc.includes('价格') || desc.includes('收费') || desc.includes('市场') ||
		desc.includes('客户') || desc.includes('商业')
	) {
		return 'business';
	}
	if (
		desc.includes('设计') || desc.includes('体验') || desc.includes('界面') ||
		desc.includes('ui') || desc.includes('ux')
	) {
		return 'design';
	}
	if (
		desc.includes('流程') || desc.includes('时间') || desc.includes('计划') ||
		desc.includes('路线') || desc.includes('周期')
	) {
		return 'process';
	}
	return 'scope';
}