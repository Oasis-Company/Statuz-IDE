/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

/**
 * Structured prompt configuration extracted from AgentDefinition.config.
 *
 * DESIGN PRINCIPLE (IR Decoupling): This is the Intermediate Representation
 * between the raw, open-ended AgentDefinition.config (Record<string, unknown>)
 * and the final System Prompt string. The IR layer isolates the LLM-facing
 * prompt format from the storage format, allowing either to evolve independently.
 *
 * DESIGN PRINCIPLE (Zero-Trust Config): Every field has a fallback default.
 * The extractor must handle empty, malformed, or irrelevant config gracefully.
 */
export interface AgentPromptConfig {
	/** Agent's role definition (e.g., "Senior code reviewer") */
	readonly role: string;
	/** Behavioral constraints the agent must follow */
	readonly constraints: readonly string[];
	/** Tools the agent is allowed to use (whitelist) */
	readonly tools: readonly string[];
	/** Response style (e.g., "concise", "academic", "socratic") */
	readonly style: string;
	/** Domain knowledge context (e.g., "React 18, TypeScript, Node.js") */
	readonly domain: string;
}

export const DEFAULT_PROMPT_CONFIG: AgentPromptConfig = {
	role: '',
	constraints: [],
	tools: [],
	style: '',
	domain: '',
};

/** Service identifier for DI */
export const IAgentConfigPromptAdapter = createDecorator<IAgentConfigPromptAdapter>('IAgentConfigPromptAdapter');

/**
 * Converts AgentDefinition.config into a structured prompt fragment
 * suitable for injection into the LLM System Prompt.
 */
export interface IAgentConfigPromptAdapter {
	readonly _serviceBrand: undefined;

	/**
	 * Extract a typed AgentPromptConfig from raw config data.
	 * Zero-trust: all fields have fallback defaults.
	 */
	extractPromptConfig(config: Record<string, unknown>): AgentPromptConfig;

	/**
	 * Convert a typed AgentPromptConfig into a prompt-ready string fragment.
	 * Returns empty string if all config fields are empty (graceful degradation).
	 */
	toPromptFragment(config: AgentPromptConfig): string;
}

/**
 * Default implementation of IAgentConfigPromptAdapter.
 *
 * Output format uses XML-style tags for LLM readability:
 * ```
 * <AGENT_DEFINITION>
 * Role: ...
 * Domain: ...
 * Style: ...
 * Constraints:
 * - ...
 * Available Tools:
 * - ...
 * </AGENT_DEFINITION>
 * ```
 */
export class AgentConfigPromptAdapter implements IAgentConfigPromptAdapter {
	readonly _serviceBrand: undefined;

	extractPromptConfig(config: Record<string, unknown>): AgentPromptConfig {
		return {
			role: typeof config.role === 'string' ? config.role : '',
			constraints: Array.isArray(config.constraints)
				? config.constraints.filter((c): c is string => typeof c === 'string')
				: [],
			tools: Array.isArray(config.tools)
				? config.tools.filter((t): t is string => typeof t === 'string')
				: [],
			style: typeof config.style === 'string' ? config.style : '',
			domain: typeof config.domain === 'string' ? config.domain : '',
		};
	}

	toPromptFragment(config: AgentPromptConfig): string {
		const hasContent = config.role
			|| config.constraints.length > 0
			|| config.tools.length > 0
			|| config.style
			|| config.domain;

		if (!hasContent) {
			return '';
		}

		const lines: string[] = ['<AGENT_DEFINITION>'];
		if (config.role) { lines.push(`Role: ${config.role}`); }
		if (config.domain) { lines.push(`Domain: ${config.domain}`); }
		if (config.style) { lines.push(`Style: ${config.style}`); }
		if (config.constraints.length > 0) {
			lines.push('Constraints:');
			for (const c of config.constraints) {
				lines.push(`- ${c}`);
			}
		}
		if (config.tools.length > 0) {
			lines.push('Available Tools:');
			for (const t of config.tools) {
				lines.push(`- ${t}`);
			}
		}
		lines.push('</AGENT_DEFINITION>');
		return lines.join('\n');
	}
}